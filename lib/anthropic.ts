import Anthropic from "@anthropic-ai/sdk";
import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { classifyConversationIntent, continuationSignal, greetingAnswer, isClosingMessage, isCustomerContextRequest, isFeedbackMessage, isGreetingOnly, isPointTopic, isSarcasticOrDismissive, missingContextMessage, pointAnswer, requiredContext, reviseCustomerDraft, sourceLine } from "./retrieval";
import { withRetry } from "./retry";
import { enforceMissingContextInvariant } from "./assistant-check";
import { filterDocumentsByProject, historyForProject, resolveProjectScope } from "./project-scope";

const DEFAULT_MODEL = "claude-sonnet-5";

function configuredApiKey() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key && !/^(your[_-].*|change[_-]?me|replace[_-]?me|xxx+)$/i.test(key) ? key : undefined;
}

function client() {
  const apiKey = configuredApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 });
}

function isUnavailableAnthropicError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; message?: unknown };
  const status = value.status;
  const message = typeof value.message === "string" ? value.message : "";
  return status === 401 || status === 403 || status === 404 || /no active credentials|model_not_found|invalid api key|authentication/i.test(message);
}

function words(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9À-ɏ]+/g) ?? []);
}

// Claude never sees document UUIDs (kept out of the prompt so it can't leak
// them into customer text), so it can only cite REFERENCE N. The model's
// output shape is validated separately from the app-wide GroundedAnswer type,
// then reference_index is mapped back to a real document_id server-side.
type ModelCitation = { reference_index: number; quote: string };
type ModelAnswer = Omit<GroundedAnswer, "citations"> & { citations: ModelCitation[] };

const MAX_QUOTE_LENGTH = 600;

function isModelAnswer(value: unknown): value is ModelAnswer {
  if (!value || typeof value !== "object") return false;
  const answer = value as Record<string, unknown>;
  const strings = ["intent", "summary", "recommended_action", "answer", "draft_reply"];
  if (strings.some((key) => typeof answer[key] !== "string")) return false;
  if (!Array.isArray(answer.missing_context) || answer.missing_context.some((item) => typeof item !== "string")) return false;
  if (!["low", "medium", "high"].includes(String(answer.confidence))) return false;
  if (!Array.isArray(answer.citations)) return false;
  return answer.citations.every((citation) => {
    if (!citation || typeof citation !== "object") return false;
    const item = citation as Record<string, unknown>;
    return (
      Number.isInteger(item.reference_index) && (item.reference_index as number) >= 1 &&
      typeof item.quote === "string" && item.quote.length > 0 && item.quote.length <= MAX_QUOTE_LENGTH
    );
  });
}

// Scans for the first balanced top-level {...} object, string- and
// escape-aware, so stray braces inside prose or quoted strings elsewhere in
// the model's output can't widen or corrupt the match (the previous greedy
// regex matched from the first "{" to the very last "}" in the text).
export function extractFirstJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

// reference_index is 1-based and matches the REFERENCE N order sent in the
// prompt. Out-of-range indexes are dropped rather than failing the whole
// answer — a slightly wrong citation shouldn't sink an otherwise-valid reply.
export function mapCitations(citations: ModelCitation[], documents: KnowledgeDocument[]): GroundedAnswer["citations"] {
  return citations
    .map((citation) => {
      const document = documents[citation.reference_index - 1];
      if (!document || !document.content.includes(citation.quote)) return undefined;
      return { document_id: document.id, title: document.title, url: document.url, quote: citation.quote };
    })
    .filter((citation): citation is GroundedAnswer["citations"][number] => Boolean(citation));
}

function suppliedClarificationDetails(issue: string, history: Array<{ role: "user" | "assistant"; content: string }>) {
  const scope = resolveProjectScope(issue, history);
  const scopedHistory = scope.project ? historyForProject(history, scope.project) : history;
  const userMessages = scopedHistory.filter((message) => message.role === "user");
  // A Points-topic message marks a topic switch away from whatever issue
  // (e.g. login) was being clarified before it — details supplied before
  // that switch no longer apply to the current checklist.
  const lastTopicShiftIndex = userMessages.reduce((last, message, index) => (isPointTopic(message.content) ? index : last), -1);
  const relevantHistory = userMessages.slice(lastTopicShiftIndex + 1);
  const customerText = [...relevantHistory.map((message) => message.content), issue].join(" ");
  return {
    error: /["“][^"”]+["”]/.test(customerText) || /\b(error|pesan(?:nya)?|message)\b/i.test(customerText),
    steps: /\b(langkah|sudah\s+dicoba|udah\s+dicoba|dicoba|troubleshoot|wifi|login\s+lagi)\b/i.test(customerText),
    account: /\b(?:akun|account)\b.{0,40}(?:saya|ini|terdampak|user)\b|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b\d{6,}\b/i.test(customerText),
  };
}

function isNewQuestion(issue: string) {
  return /[?]\s*$|^(apa|apakah|bagaimana|gimana|kenapa|mengapa|bisakah|boleh|cara)\b/i.test(issue.trim());
}

function latestPointTopic(history: Array<{ role: "user" | "assistant"; content: string }>) {
  return [...history].reverse().find((message) => message.role === "user" && isPointTopic(message.content));
}

function hasExplicitIssueTopic(issue: string) {
  return /\b(login|akun|account|error|pesan|masalah|kendala|gagal|pembayaran|refund|order|pesanan)\b/i.test(issue);
}


function isFollowUpQuestion(issue: string) {
  return /\b(berapa lama|kapan|estimasi waktu|timeline|durasi|siapa|menangani|handle|status)\b/i.test(issue);
}

export function fallback(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = [], currentDraft = ""): GroundedAnswer {
  const scope = resolveProjectScope(issue, history);
  const projects = scope.projects;
  const scopedDocuments = filterDocumentsByProject(documents, scope.project);
  const intent = classifyConversationIntent(issue, history, currentDraft);
  if (intent === "draft_regeneration" || intent === "draft_feedback" || intent === "draft_edit") {
    const source = scopedDocuments.find((document) => sourceLine(document.content, "Customer Reply"));
    const reply = source ? sourceLine(source.content, "Customer Reply") : "";
    if (source && reply) {
      return {
        intent: "Draft revision",
        summary: "The existing customer-facing draft was revised using the active knowledge source.",
        missing_context: [],
        recommended_action: "Review the revised customer-facing draft before sending.",
        answer: sourceLine(source.content, "Customer Safe Summary") || reply,
        draft_reply: reviseCustomerDraft(reply, intent, currentDraft),
        citations: [{ document_id: source.id, title: source.title, url: source.url, quote: source.content.slice(0, 240) }],
        confidence: "high",
      };
    }
  }
  if (scope.ambiguous && !isClosingMessage(issue) && !isFeedbackMessage(issue)) {
    const projectList = scope.projects.map((project) => `Project ${project}`).join(", ").replace(/, ([^,]*)$/, " atau $1");
    return {
      intent: "Needs clarification",
      summary: "The latest message is ambiguous between multiple recent projects.",
      missing_context: [`Project belum jelas: ${scope.projects.join(", ")}.`],
      recommended_action: "Ask which project the customer means before preparing a reply.",
      answer: `Maksudnya ${projectList}?`,
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }
  // A follow-up is ambiguous between projects either the usual way
  // (continuationSignal: "itu", bare IDs, ...) or by asking a fresh-looking
  // question ("gimana statusnya?") without naming any issue topic — that
  // shape carries no keyword tying it to one project either.
  const ambiguousFollowUp = continuationSignal(issue, history) || (isNewQuestion(issue) && !hasExplicitIssueTopic(issue));
  if (projects.length >= 2 && ambiguousFollowUp && !scope.explicit && !isFeedbackMessage(issue)) {
    const projectList = projects.map((project) => `Project ${project}`).join(", ").replace(/, ([^,]*)$/, " atau $1");
    return {
      intent: "Needs clarification",
      summary: "The latest message is ambiguous between multiple recent projects.",
      missing_context: [`Project belum jelas: ${projects.join(", ")}.`],
      recommended_action: "Ask which project the customer means before preparing a reply.",
      answer: `Maksudnya ${projectList}?`,
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }

  if (isClosingMessage(issue)) {
    return {
      intent: "Conversation closed",
      summary: "The customer conversation was acknowledged.",
      missing_context: [],
      recommended_action: "No further action is required.",
      answer: "Sama-sama! 😊 Apakah penjelasan tadi sudah membantu dan sesuai dengan yang Anda butuhkan? Jika masih ada bagian yang kurang jelas, silakan beri tahu saya.",
      draft_reply: "Sama-sama! 😊 Apakah penjelasan tadi sudah membantu dan sesuai dengan yang Anda butuhkan? Jika masih ada bagian yang kurang jelas, silakan beri tahu kami.",
      citations: [],
      confidence: "high",
    };
  }

  // Follow-up questions ("menurutmu kenapa?") carry no keywords of their own;
  // rank against the whole thread's user turns so context carries over.
  const contextText = continuationSignal(issue, history)
    ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), issue].join(" ")
    : issue;
  if (isSarcasticOrDismissive(issue)) {
    return {
      intent: "Needs clarification",
      summary: "The latest message may be a sarcastic or dismissive reaction and does not add reliable issue details.",
      missing_context: ["Mohon jelaskan bagian issue yang masih belum jelas atau informasi apa yang ingin ditindaklanjuti."],
      recommended_action: "Clarify the customer's intended question before preparing a reply.",
      answer: "Bagian mana yang masih belum jelas atau ingin ditindaklanjuti?",
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }
  const contextWords = words(contextText);
  const ranked = scopedDocuments
    .map((document, index) => ({ document, index, score: [...words(`${document.title} ${document.content}`)].filter((word) => contextWords.has(word)).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter(({ score }) => score > 0)
    .slice(0, 3)
    .map(({ document }) => document);

  if (isFollowUpQuestion(issue)) {
    const bestReply = ranked[0] ? sourceLine(ranked[0].content, "Customer Reply") : "";
    const asksTimeline = /\b(berapa lama|kapan|estimasi waktu|timeline|durasi)\b/i.test(issue);
    const asksOwner = /\b(siapa|menangani|handle)\b/i.test(issue);
    const asksStatus = /\bstatus\b/i.test(issue);
    const supportedTimeline = /\b\d+\s*(?:menit|jam|hari|minggu|bulan|tahun)\b|\b(?:hari|minggu|bulan)\s+kerja\b/i.test(bestReply);
    const supportedOwner = asksOwner && /\b(?:tim|team|oleh)\b/i.test(bestReply);
    const supportedStatus = asksStatus && bestReply.length > 0;
    const supportedFollowUp = (asksTimeline && supportedTimeline) || supportedOwner || supportedStatus;
    const followUpContext = ranked[0] ? requiredContext(sourceLine(ranked[0].content, "Customer Action"), sourceLine(ranked[0].content, "Required Context")) : null;
    const followUpQuery = continuationSignal(issue, history)
      ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), issue].join(" ")
      : issue;
    const followUpMissing = followUpContext ? missingContextMessage(followUpContext, followUpQuery) : null;
    if (supportedFollowUp && bestReply && !followUpMissing) {
      return {
        intent: "Support issue",
        summary: "The requested timeline or ownership is supported by the active knowledge.",
        missing_context: [],
        recommended_action: "Use the supported timeline or ownership wording from the cited knowledge.",
        answer: bestReply,
        draft_reply: `Terima kasih sudah menghubungi kami. ${bestReply}`,
        citations: [{ document_id: ranked[0].id, title: ranked[0].title, url: ranked[0].url, quote: ranked[0].content.slice(0, 240) }],
        confidence: "medium",
      };
    }
    return {
      intent: "Needs clarification",
      summary: "The customer asks for a timeline that is not provided by the available knowledge.",
      missing_context: [followUpMissing ?? "Estimasi waktu penyelesaian belum tersedia di knowledge perusahaan."],
      recommended_action: "Confirm the timeline or current status with the responsible team before replying.",
      answer: asksTimeline
        ? "Estimasi waktu penyelesaian belum tersedia di knowledge perusahaan dan perlu dikonfirmasi ke tim terkait."
        : "Status kasus belum dapat dikonfirmasi dari knowledge perusahaan dan perlu diverifikasi ke tim terkait.",
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }

  if (!ranked.length) {
    // The account/error/steps checklist belongs to whatever issue is
    // currently active. If the conversation has since moved to a different
    // topic (e.g. Points) and the latest message is ambiguous rather than a
    // fresh question about that old issue, reviving the old checklist would
    // misdirect the customer — ask about the CURRENT topic instead.
    const recentTopic = latestPointTopic(history);
    const topicShifted = recentTopic && !isPointTopic(issue) && !hasExplicitIssueTopic(issue);
    if (topicShifted) {
      const question = "Boleh diperjelas, bagian mana dari topik poin sebelumnya yang masih kurang jelas, atau apakah ini pertanyaan baru?";
      return {
        intent: "Needs clarification",
        summary: "The latest message is ambiguous relative to the current topic.",
        missing_context: ["Klarifikasi diperlukan terkait topik yang sedang dibahas."],
        recommended_action: "Ask the customer to clarify relative to the current topic before replying.",
        answer: question,
        draft_reply: "",
        citations: [],
        confidence: "low",
      };
    }

    const supplied = suppliedClarificationDetails(issue, history);
    const missing = [
      !supplied.account && "akun yang terdampak",
      !supplied.error && "pesan error yang muncul",
      !supplied.steps && "langkah yang sudah dicoba",
    ].filter((item): item is string => Boolean(item));
    const question = missing.length
      ? `Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Bisa tolong kirimkan ${missing.join(", ")}?`
      : isNewQuestion(issue)
        ? "Belum ada knowledge perusahaan yang menjelaskan pertanyaan ini. Kasus ini perlu diverifikasi oleh tim Customer Support."
        : "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Detail yang diberikan sudah tercatat; kasus ini perlu diverifikasi secara manual oleh tim Customer Support.";
    return {
      intent: "Needs clarification",
      summary: "No matching company knowledge was found.",
      missing_context: missing.length ? [`Relevant company documentation is unavailable. Confirm ${missing.join(", ")}.`] : [],
      recommended_action: "Collect the missing details and verify the case manually before replying.",
      answer: question,
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }

  const citations = ranked.map((document) => ({
    document_id: document.id,
    title: document.title,
    url: document.url,
    quote: document.content.slice(0, 240),
  }));
  const best = ranked[0];
  // Answer with the document's own customer-safe content first; sources stay attached as citations.
  const summaryLine = sourceLine(best.content, "Customer Safe Summary");
  const actionLine = sourceLine(best.content, "Customer Action");
  // Customer Action is an internal CS instruction, never customer-facing —
  // only Customer Reply may become draft_reply (same rule as pointAnswer).
  const replyLine = sourceLine(best.content, "Customer Reply");
  const explicitContext = sourceLine(best.content, "Required Context");
  const context = requiredContext(actionLine, explicitContext);
  const contextQuery = continuationSignal(issue, history)
    ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), issue].join(" ")
    : issue;
  const missingContext = missingContextMessage(context, contextQuery);
  const missing = [
    ...(missingContext ? [missingContext] : []),
    ...(!replyLine ? ["Artikel ini belum memiliki field Customer Reply. Tinjau dan lengkapi di Notion sebelum draft dapat dibuat otomatis."] : []),
  ];
  const answer = summaryLine ? `Kemungkinan penyebab: ${summaryLine}.` : "Kami sedang meninjau kendala yang disampaikan dan akan memverifikasi penanganan yang sesuai.";
  return {
    intent: intent === "guidance_follow_up" ? "Customer guidance" : "Support issue",
    summary: `Kemungkinan penyebab dari: ${best.title}.`,
    missing_context: missing,
    recommended_action: actionLine || "Review the cited knowledge and confirm it applies to this customer's case before responding.",
    answer,
    draft_reply: missing.length
      ? (replyLine && isCustomerContextRequest(replyLine) ? `Terima kasih sudah menghubungi kami. ${replyLine}` : "")
      : `Terima kasih sudah menghubungi kami. ${replyLine}`,
    citations,
    confidence: missing.length ? "low" : "medium",
    ...(missing.length ? { knowledge_gap: true } : {}),
  };
}

const system = `You are CSCoPilot, an internal Customer Support decision-support assistant.
Handle greetings naturally and briefly. For greeting-only messages, reply in the user's language with one friendly greeting and one short question; do not explain capabilities or mention sources. For a greeting plus an issue, acknowledge it briefly, then answer the issue using the supplied sources. In an existing conversation, preserve context when the user greets again.
The messages before the final one are prior conversation history, for context only. Always answer the CURRENT CLIENT MESSAGE in the final user turn — never answer an earlier question instead, even if it is easier to answer or still unresolved.
When the conversation mentions more than one project, product, or system, first identify which one the CURRENT CLIENT MESSAGE concerns — from an explicit name in that message, or otherwise the nearest prior message that clearly set the current topic. Use and cite only sources and context belonging to that project; never combine facts, causes, or solutions from a different project into the same answer, even if both were discussed earlier in this conversation.
If you cannot tell which project or prior issue the CURRENT CLIENT MESSAGE refers to (for example, two projects were just discussed and the message only says "this"/"ini"/"itu"), do not guess. Say so and ask a short clarifying question in draft_reply, and note the ambiguity in missing_context, instead of answering for one project.
Respond in Indonesian for Indonesian input, English for English input, and mirror mixed language naturally.
Notion sources are the only authority for company-specific claims. Use only supplied sources.
Treat source metadata as internal evidence only. Never copy SOURCE labels, IDs, UUIDs, titles, URLs, scores, or metadata into answer or draft_reply. Put source IDs only in structured citations.
Only put something in missing_context if the customer's message truly lacks it and the agent cannot proceed without it. Never list information already provided (order number, account, error message, etc.) or "nice to have" details. Routine manual verification steps that the agent always performs as part of the SOP (checking a database, confirming a balance) belong in recommended_action, not missing_context — missing_context is only for what the customer still needs to supply.
Never invent policies, refunds, timelines, credentials, or troubleshooting steps.
Every supported company-specific claim needs a citation using the REFERENCE number it came from.
Clarification Flow: before answering, check whether the issue plus the supplied history and sources are actually enough to give a grounded, specific reply. If not, do not guess — set missing_context to what is still needed, put ONE short, specific question in answer (e.g. ask for the exact error message or order number, not "can you give more details?"). Leave draft_reply empty unless the cited Customer Reply is itself a safe, customer-facing request for the missing identifier; in that exception, preserve that request as the draft. Set confidence to "low" when clarification is needed. Never ask again for something the customer or agent already stated earlier in the history. If the message is ambiguous, indirect ("itu", "yang tadi", "masih sama"), or sarcastic, first try to resolve it from the conversation history; only ask a clarifying question if it genuinely cannot be resolved that way. If the conversation is discussing more than one distinct issue, identify which one the current message is about; if that itself is unclear, ask which issue it refers to instead of mixing information between them.
Produce an editable customer-facing draft, never send it, and never claim it was sent. Draft regeneration or feedback must revise the supplied CURRENT DRAFT using only the active source's Customer Reply. A greeting edit must preserve the draft body and add one greeting only. A supplied customer identifier satisfies the matching Required Context; do not repeat the request or expose the identifier in the draft. A customer-guidance follow-up should answer the active topic using Customer Safe Summary and Customer Action as internal guidance, while using only Customer Reply for customer-facing wording. Never copy Customer Action into draft_reply.
Return JSON matching the requested schema.`;

export async function generateGroundedAnswer(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = [], contextSummary = "", currentDraft = ""): Promise<GroundedAnswer> {
  if (isGreetingOnly(issue)) return greetingAnswer(issue, history);
  if (isClosingMessage(issue)) return fallback(issue, documents, history, currentDraft);
  const scope = resolveProjectScope(issue, history);
  if (scope.ambiguous) return fallback(issue, documents, history, currentDraft);
  const scopedDocuments = scope.project ? filterDocumentsByProject(documents, scope.project) : documents;
  const modelHistory = scope.project ? historyForProject(history, scope.project) : history;
  const deterministicPointAnswer = pointAnswer(issue, scopedDocuments, modelHistory, currentDraft);
  if (deterministicPointAnswer) return deterministicPointAnswer;
  if (!scopedDocuments.length || !configuredApiKey() || process.env.CSCOPILOT_NO_AI === "1") return fallback(issue, scopedDocuments, modelHistory, currentDraft);
  const context = scopedDocuments.map((doc, index) => `REFERENCE ${index + 1}\nCONTENT:\n${doc.content}`).join("\n\n");
  let response;
  try {
    response = await withRetry(() => client().messages.create({
      model: process.env.ANTHROPIC_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 1800,
      thinking: { type: "adaptive" } as never,
      system,
messages: [
  ...modelHistory,
  {
    role: "user",
    content: `CURRENT CLIENT MESSAGE (answer this; the messages above are context only):
${issue}

ACTIVE CONTEXT (unverified unless explicitly marked verified):
${contextSummary || "None"}

KNOWLEDGE CONTEXT:
${context || "No reliable source found."}

Return only JSON with this shape:
{
  "intent": "short issue category",
  "summary": "concise grounded summary",
  "missing_context": [],
  "recommended_action": "internal CS next step",
  "answer": "customer-facing answer",
  "draft_reply": "customer-facing suggested reply",
  "citations": [{"reference_index": 1, "quote": "short quote"}],
  "confidence": "high"
}

Use an array of strings for missing_context. If missing_context is non-empty, answer must be the targeted clarifying question, draft_reply must be empty, and confidence must be low.
Each reference_index must be a 1-based reference number from KNOWLEDGE CONTEXT.
Do not invent facts not supported by the knowledge context or conversation.`
  },
],
    } as never));
  } catch (error) {
    if (isUnavailableAnthropicError(error)) return fallback(issue, scopedDocuments, history, currentDraft);
    throw error;
  }
  if ((response as { stop_reason?: string }).stop_reason === "refusal") throw new Error("Claude refused this request");
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returned no answer");
  const jsonText = extractFirstJsonObject(text);
  let parsed: unknown;
  try {
    if (!jsonText) throw new Error("missing JSON object");
    parsed = JSON.parse(jsonText);
  } catch {
    // A malformed model response must not break the support workflow. The
    // deterministic answer still uses only the retrieved customer-safe fields.
    console.warn("Claude returned non-JSON output; using grounded fallback");
    return fallback(issue, scopedDocuments, history, currentDraft);
  }
  if (!isModelAnswer(parsed)) {
    console.warn("Claude returned an unexpected schema; using grounded fallback");
    return fallback(issue, scopedDocuments, history, currentDraft);
  }
  const citations = mapCitations(parsed.citations, scopedDocuments);
  const grounded = citations.length === parsed.citations.length && citations.length > 0;
  return enforceMissingContextInvariant({
    ...parsed,
    citations,
    ...(grounded ? {} : {
      answer: "Jawaban ini belum memiliki sumber knowledge yang valid dan perlu ditinjau ulang oleh tim Customer Support.",
      draft_reply: "",
      confidence: "low" as const,
      missing_context: ["Sumber knowledge yang valid belum tersedia untuk jawaban ini."],
    }),
  });
}

export { fallback as generateNoAiAnswer };

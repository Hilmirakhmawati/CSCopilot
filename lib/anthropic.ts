import Anthropic from "@anthropic-ai/sdk";
import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { classifyConversationIntent, continuationSignal, greetingAnswer, isClosingMessage, isCustomerContextRequest, isFeedbackMessage, isGreetingOnly, isPointTopic, isSarcasticOrDismissive, missingContextMessage, pointAnswer, requiredContext, reviseCustomerDraft, sourceLine, suppliedIdentifier, withThanksGreeting } from "./retrieval";
import { withRetry } from "./retry";
import { enforceMissingContextInvariant, sanitizeAnswer } from "./answer-safety";
import { buildGuidance } from "./case-guidance";
import { filterDocumentsByProject, historyForProject, resolveProjectScope } from "./project-scope";
import { detectLanguage, type ResponseLanguage } from "./language";

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
  return status === 401 || status === 403 || status === 404 || status === 529 || /no active credentials|model_not_found|invalid api key|authentication/i.test(message);
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

export function fallback(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = [], currentDraft = "", lang: ResponseLanguage = detectLanguage(issue)): GroundedAnswer {
  const scope = resolveProjectScope(issue, history);
  const projects = scope.projects;
  const english = lang === "en";
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
    const projectList = scope.projects.map((project) => `Project ${project}`).join(", ").replace(/, ([^,]*)$/, english ? " or $1" : " atau $1");
    return {
      intent: "Needs clarification",
      summary: "The latest message is ambiguous between multiple recent projects.",
      missing_context: [english ? `Project is unclear: ${scope.projects.join(", ")}.` : `Project belum jelas: ${scope.projects.join(", ")}.`],
      recommended_action: "Ask which project the customer means before preparing a reply.",
      answer: english ? `Do you mean ${projectList}?` : `Maksudnya ${projectList}?`,
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
    const projectList = projects.map((project) => `Project ${project}`).join(", ").replace(/, ([^,]*)$/, english ? " or $1" : " atau $1");
    return {
      intent: "Needs clarification",
      summary: "The latest message is ambiguous between multiple recent projects.",
      missing_context: [english ? `Project is unclear: ${projects.join(", ")}.` : `Project belum jelas: ${projects.join(", ")}.`],
      recommended_action: "Ask which project the customer means before preparing a reply.",
      answer: english ? `Do you mean ${projectList}?` : `Maksudnya ${projectList}?`,
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }

  if (isClosingMessage(issue) && english) {
    return {
      intent: "Conversation closed",
      summary: "The customer conversation was acknowledged.",
      missing_context: [],
      recommended_action: "No further action is required.",
      answer: "You're welcome! 😊 Did that help and match what you needed? If any part is still unclear, just let me know.",
      draft_reply: "You're welcome! 😊 Did that help and match what you needed? If any part is still unclear, just let us know.",
      citations: [],
      confidence: "high",
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
  if (isSarcasticOrDismissive(issue) && english) {
    return {
      intent: "Needs clarification",
      summary: "The latest message may be a sarcastic or dismissive reaction and does not add reliable issue details.",
      missing_context: ["Please explain which part of the issue is still unclear or what should be followed up."],
      recommended_action: "Clarify the customer's intended question before preparing a reply.",
      answer: "Which part is still unclear or needs follow-up?",
      draft_reply: "",
      citations: [],
      confidence: "low",
    };
  }
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
    const followUpContext = ranked[0] ? requiredContext(sourceLine(ranked[0].content, "Customer Action"), sourceLine(ranked[0].content, "Required Context"), ranked[0].title) : null;
    const followUpQuery = continuationSignal(issue, history)
      ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), issue].join(" ")
      : issue;
    const followUpMissing = followUpContext ? missingContextMessage(followUpContext, followUpQuery, lang) : null;
    if (supportedFollowUp && bestReply && !followUpMissing) {
      return {
        intent: "Support issue",
        summary: "The requested timeline or ownership is supported by the active knowledge.",
        missing_context: [],
        recommended_action: "Use the supported timeline or ownership wording from the cited knowledge.",
        answer: bestReply,
        draft_reply: withThanksGreeting(bestReply),
        citations: [{ document_id: ranked[0].id, title: ranked[0].title, url: ranked[0].url, quote: ranked[0].content.slice(0, 240) }],
        confidence: "medium",
      };
    }
    return {
      intent: "Needs clarification",
      summary: "The customer asks for a timeline that is not provided by the available knowledge.",
      missing_context: [followUpMissing ?? (english ? "The resolution timeline is not available in company knowledge." : "Estimasi waktu penyelesaian belum tersedia di knowledge perusahaan.")],
      recommended_action: "Confirm the timeline or current status with the responsible team before replying.",
      answer: english
        ? asksTimeline
          ? "The resolution timeline is not available in company knowledge and needs to be confirmed with the responsible team."
          : "The case status cannot be confirmed from company knowledge and needs to be verified with the responsible team."
        : asksTimeline
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
    const suppliedIdentifierFollowUp = Boolean(suppliedIdentifier(issue) && continuationSignal(issue, history));
    const topicShifted = recentTopic && !isPointTopic(issue) && !continuationSignal(issue, history) && !suppliedIdentifierFollowUp && !hasExplicitIssueTopic(issue);
    if (topicShifted) {
      const question = english
        ? "Could you clarify which part of the previous points topic is still unclear, or is this a new question?"
        : "Boleh diperjelas, bagian mana dari topik poin sebelumnya yang masih kurang jelas, atau apakah ini pertanyaan baru?";
      return {
        intent: "Needs clarification",
        summary: "The latest message is ambiguous relative to the current topic.",
        missing_context: [english ? "Clarification is needed about the topic being discussed." : "Klarifikasi diperlukan terkait topik yang sedang dibahas."],
        recommended_action: "Ask the customer to clarify relative to the current topic before replying.",
        answer: question,
        draft_reply: "",
        citations: [],
        confidence: "low",
      };
    }

    const supplied = suppliedClarificationDetails(issue, history);
    const missing = [
      !supplied.account && (english ? "the affected account" : "akun yang terdampak"),
      !supplied.error && (english ? "the error message" : "pesan error yang muncul"),
      !supplied.steps && (english ? "the steps already tried" : "langkah yang sudah dicoba"),
    ].filter((item): item is string => Boolean(item));
    if (english) {
      const question = missing.length
        ? `There is not enough relevant company knowledge to answer this issue. Please provide ${missing.join(", ")}.`
        : isNewQuestion(issue)
          ? "The available knowledge does not explain this question. The case needs to be verified manually by Customer Support."
          : "There is not enough relevant company knowledge to answer this issue. The details provided have been recorded; the case needs manual verification by Customer Support.";
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
  const context = requiredContext(actionLine, explicitContext, best.title);
  const contextQuery = continuationSignal(issue, history)
    ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), issue].join(" ")
    : issue;
  const missingContext = missingContextMessage(context, contextQuery, lang);
  const missing = [
    ...(missingContext ? [missingContext] : []),
    ...(!replyLine ? ["Artikel ini belum memiliki field Customer Reply. Tinjau dan lengkapi di Notion sebelum draft dapat dibuat otomatis."] : []),
  ];
  const answer = summaryLine ? `Kemungkinan penyebab: ${summaryLine}.` : "Knowledge yang tersedia belum menjelaskan penyebab kendala ini. Kasus perlu diverifikasi secara manual oleh CS.";
  const continuation = continuationSignal(issue, history);
  const suppliedDetails = continuation && /\b(?:akun|akunnya|account|nomor\s+akun|pesanan|order|email)\b/i.test(issue);
  const currentTurnAnswer = suppliedDetails
    ? (lang === "en"
      ? "The details have been received and noted as case information. I don't have direct access to the customer's account data, so I cannot verify it from here. CS needs to check it manually using the steps in the available knowledge."
      : "Informasi sudah diterima dan dicatat sebagai info case. Saya tidak memiliki akses langsung ke data akun customer, sehingga tidak dapat memverifikasinya dari sini. CS perlu memeriksanya secara manual sesuai langkah pada knowledge yang tersedia.")
    : answer;
  return {
    intent: intent === "guidance_follow_up" ? "Customer guidance" : suppliedDetails ? "Identifier received" : "Support issue",
    summary: `Kemungkinan penyebab dari: ${best.title}.`,
    missing_context: missing,
    recommended_action: actionLine || "Review the cited knowledge and confirm it applies to this customer's case before responding.",
    answer: currentTurnAnswer,
    draft_reply: missing.length
      ? (replyLine && isCustomerContextRequest(replyLine) ? withThanksGreeting(replyLine) : "")
      : withThanksGreeting(replyLine),
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
Respond in Indonesian for Indonesian input, English for English input, and mirror mixed language naturally. Use the RESPONSE LANGUAGE given in the final user turn (it already accounts for conversation history and explicit language switches), and use that one language for every text field: answer, draft_reply, missing_context, recommended_action, and summary. When the language is English but the sources are Indonesian, translate the supported content faithfully into English without adding, removing, or changing any fact, step, or policy. Quotes in citations stay verbatim in the source language. The Indonesian phrases quoted in the rules below are examples, not required wording.
Notion sources are the only authority for company-specific claims. Use only supplied sources.
Treat source metadata as internal evidence only. Never copy SOURCE labels, IDs, UUIDs, titles, URLs, scores, or metadata into answer or draft_reply. Put source IDs only in structured citations.
Only put something in missing_context if the customer's message truly lacks it and the agent cannot proceed without it. Never list information already provided (order number, account, error message, etc.) or "nice to have" details. Routine manual verification steps that the agent always performs as part of the SOP (checking a database, confirming a balance) belong in recommended_action, not missing_context — missing_context is only for what the customer still needs to supply.
Never invent policies, refunds, timelines, credentials, or troubleshooting steps.
You have NO access to any database, API, account, order, or production system. Never say or imply that you or "our team" have checked, are checking, or will check an account/order, and never state account data (balance, status, history). Account/order numbers, error messages, and attachments supplied by the agent are unverified case information: acknowledge them as "dicatat sebagai info case", never as verified. In answer and recommended_action, phrase verification as a step the agent (CS) can take, using only steps present in the cited sources (e.g. "perlu diverifikasi melalui riwayat poin"). If the sources contain no checking steps, say so instead of inventing them. Distinguish knowledge-based action from data verification: "CS can check the point history" / "CS dapat mengecek riwayat poin" (what a human agent can do per the sources) is allowed; "I checked" / "I can see" / "your balance is" / "sudah saya cek" (claiming you inspected real data) is forbidden. When an identifier is supplied, say it was received, that you have no direct access to the customer's account data so you cannot verify it, and name what CS should check. In draft_reply, describe checks as upcoming ("akan kami bantu cek") and never as completed ("sudah dicek", "sudah dikembalikan", "sudah diperbaiki") unless the agent explicitly reported that result.
Every supported company-specific claim needs a citation using the REFERENCE number it came from.
Clarification Flow: before answering, check whether the issue plus the supplied history and sources are actually enough to give a grounded, specific reply. If not, do not guess — set missing_context to what is still needed, put ONE short, specific question in answer (e.g. ask for the exact error message or order number, not "can you give more details?"). Leave draft_reply empty unless the cited Customer Reply is itself a safe, customer-facing request for the missing identifier; in that exception, preserve that request as the draft. Set confidence to "low" when clarification is needed. Never ask again for something the customer or agent already stated earlier in the history. If the message is ambiguous, indirect ("itu", "yang tadi", "masih sama"), or sarcastic, first try to resolve it from the conversation history; only ask a clarifying question if it genuinely cannot be resolved that way. If the conversation is discussing more than one distinct issue, identify which one the current message is about; if that itself is unclear, ask which issue it refers to instead of mixing information between them. When the current message supplies an account/order number or email, answer that current turn with a concise acknowledgement and next verification step; do not repeat the previous issue summary as if the identifier was not received. Never infer whether an unlabeled number is an account or order when the active source requires that distinction; ask the user to label it.
Produce an editable customer-facing draft, never send it, and never claim it was sent. Draft regeneration or feedback must revise the supplied CURRENT DRAFT using only the active source's Customer Reply. A greeting edit must preserve the draft body and add one greeting only. A supplied customer identifier satisfies the matching Required Context; do not repeat the request or expose the identifier in the draft. A customer-guidance follow-up should answer the active topic using Customer Safe Summary and Customer Action as internal guidance, while using only Customer Reply for customer-facing wording. Never copy Customer Action into draft_reply.
Return JSON matching the requested schema.`;

// Guidance (steps, case understanding, knowledge status) is derived from the
// cited article only, for every path, so the model never writes it.
export async function generateGroundedAnswer(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = [], contextSummary = "", currentDraft = "", lang: ResponseLanguage = detectLanguage(issue)): Promise<GroundedAnswer> {
  const guided = buildGuidance(await generateBaseAnswer(issue, documents, history, contextSummary, currentDraft, lang), documents, issue, history, Date.now(), lang);
  return lang === "en" ? translateGuidance(guided) : guided;
}

function deterministicGuidanceEnglish(value: string) {
  const replacements: Array<[string, string]> = [
    ["Minta nomor akun/nomor pesanan customer.", "Ask for the customer's account number or order number."],
    ["Sampaikan bahwa saldo akan dicek dan disesuaikan bila terbukti ada selisih.", "Explain that the balance will be checked and adjusted if a discrepancy is confirmed."],
    ["Jangan menjanjikan jumlah poin sebelum verifikasi selesai", "Do not promise a point amount before verification is complete"],
    ["Konfirmasi nomor akun atau nomor pesanan terkait.", "Confirm the related account number or order number."],
    ["Bandingkan saldo poin dengan riwayat poin dan transaksi terkait.", "Compare the point balance with the point history and related transactions."],
    ["Catat bila ada adjustment manual atau perbedaan riwayat", "Record any unrecognized manual adjustment or history discrepancy"],
    ["Saldo tetap 0 setelah riwayat poin dan transaksi dibandingkan.", "The balance remains 0 after comparing the point history and related transactions."],
    ["Ada adjustment manual yang tidak dikenal atau tidak dapat dijelaskan", "An unrecognized or unexplained manual adjustment is found"],
    ["Ada adjustment manual tidak dikenal", "An unrecognized manual adjustment is found"],
    ["Minta nomor akun atau nomor pesanan customer", "Ask for the customer's account number or order number"],
    ["Minta nomor akun customer", "Ask for the customer's account number"],
    ["Minta customer mengirimkan nomor akun", "Ask the customer to provide the account number"],
    ["Periksa riwayat poin", "Check the point history"],
    ["Periksa saldo poin", "Check the point balance"],
    ["Periksa transaksi terkait", "Check the related transactions"],
    ["Cek transaksi terkait", "Check the related transactions"],
    ["Cek riwayat poin", "Check the point history"],
    ["Cek saldo poin", "Check the point balance"],
    ["Bandingkan dengan riwayat pesanan", "Compare it with the order history"],
    ["Jika ditemukan selisih", "If a discrepancy is found"],
    ["Jika tidak ada selisih", "If there is no discrepancy"],
    ["Eskalasi ke tim terkait", "Escalate to the relevant team"],
    ["Eskalasi ke tim", "Escalate to the team"],
    ["Lakukan penyesuaian", "Make the adjustment"],
    ["Jangan menjanjikan", "Do not promise"],
    ["sebelum diverifikasi", "before it is verified"],
    ["setelah diverifikasi", "after it is verified"],
    ["saldo poin", "point balance"],
    ["riwayat poin", "point history"],
    ["nomor akun", "account number"],
    ["nomor pesanan", "order number"],
  ];
  return replacements.reduce((text, [source, target]) => text.replaceAll(source, target), value);
}

// Internal CS guidance is copied from (Indonesian) Notion fields. For English
// askers, translate it faithfully; retry any item the first response leaves untranslated.
async function translateGuidance(answer: GroundedAnswer): Promise<GroundedAnswer> {
  const originalItems = [
    ...(answer.next_actions ?? []),
    ...(answer.escalate_when ?? []),
    ...(answer.recommended_action ? [answer.recommended_action] : []),
    ...answer.missing_context,
  ];
  const items = originalItems.map(deterministicGuidanceEnglish);
  const apply = (out: string[]) => {
    let i = 0;
    const take = (count: number) => out.slice(i, i += count);
    const next_actions = answer.next_actions ? take(answer.next_actions.length) : undefined;
    const escalate_when = answer.escalate_when ? take(answer.escalate_when.length) : undefined;
    const recommended_action = answer.recommended_action ? take(1)[0] : answer.recommended_action;
    const missing_context = take(answer.missing_context.length);
    return { ...answer, ...(next_actions ? { next_actions } : {}), ...(escalate_when ? { escalate_when } : {}), recommended_action, missing_context };
  };
  if (!items.some((item) => detectLanguage(item) === "id")) return apply(items);
  if (!configuredApiKey() || process.env.CSCOPILOT_NO_AI === "1") return apply(items);

  const translate = async (values: string[]) => {
    const response = await withRetry(() => client().messages.create({
      model: process.env.ANTHROPIC_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 1500,
      system: "Translate every string in the JSON array into English. Preserve meaning exactly; do not add, remove, or change any fact, step, or policy. Do not claim anything was checked or verified. Return only a JSON array with the same length and order.",
      messages: [{ role: "user", content: JSON.stringify(values) }],
    } as never));
    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    const parsed: unknown = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    return Array.isArray(parsed) && parsed.length === values.length && parsed.every((item) => typeof item === "string") ? parsed as string[] : values;
  };

  try {
    const out = await translate(items);
    for (let pass = 0; pass < 2; pass += 1) {
      const remainingIndexes = out.map((item, index) => detectLanguage(item) === "id" ? index : -1).filter((index) => index >= 0);
      if (!remainingIndexes.length) break;
      const retried = await translate(remainingIndexes.map((index) => items[index]));
      remainingIndexes.forEach((index, retryIndex) => { out[index] = retried[retryIndex]; });
    }
    return apply(out);
  } catch (error) {
    console.error("Guidance translation failed", error);
    return apply(items);
  }
}

async function generateBaseAnswer(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = [], contextSummary = "", currentDraft = "", lang: ResponseLanguage = detectLanguage(issue)): Promise<GroundedAnswer> {
  if (isGreetingOnly(issue)) return greetingAnswer(issue, history, lang);
  if (isClosingMessage(issue)) return fallback(issue, documents, history, currentDraft, lang);
  const scope = resolveProjectScope(issue, history);
  if (scope.ambiguous) return fallback(issue, documents, history, currentDraft, lang);
  const scopedDocuments = scope.project ? filterDocumentsByProject(documents, scope.project) : documents;
  const modelHistory = scope.project ? historyForProject(history, scope.project) : history;
  const deterministicPointAnswer = pointAnswer(issue, scopedDocuments, modelHistory, currentDraft, lang);
  const canTranslatePointAnswer = lang === "en" && Boolean(deterministicPointAnswer?.citations.length) && Boolean(configuredApiKey()) && process.env.CSCOPILOT_NO_AI !== "1";
  // The deterministic point answer comes straight from the (Indonesian) article. When an English asker gets it untranslated,
  // tell CS in `answer` only; draft_reply is customer-facing and must stay clean.
  const untranslatedPointAnswer = () => {
    const safe = sanitizeAnswer(deterministicPointAnswer!, lang);
    if (lang !== "en" || detectLanguage(safe.answer) !== "id") return safe;
    const identifierReceived = safe.intent === "Identifier received";
    const identifier = /\bakun\b/i.test(safe.answer) ? "account number" : /\bpesanan\b/i.test(safe.answer) ? "order number" : "provided identifier";
    const answer = identifierReceived
      ? `The ${identifier} has been received. I don't have direct access to the customer's account data, so I cannot verify the current point balance from here. Please check the point balance, point history, and related transactions.`
      : "The knowledge base notes that some accounts may display a point balance of 0 because of a technical issue. I don't have direct access to account data, so I cannot verify the current point balance from here. Please check the point balance, point history, and related transactions.";
    const draft_reply = identifierReceived
      ? `Thank you, we have received the ${identifier}. We will follow up on the point balance once the case has been reviewed.`
      : "Hi, we're sorry for the inconvenience. Some accounts may temporarily display a 0-point balance due to a technical issue. Could you please provide the customer's account number so we can verify the balance?";
    return { ...safe, answer, draft_reply };
  };
  const safePointFallback = () => deterministicPointAnswer ? untranslatedPointAnswer() : undefined;
  if (deterministicPointAnswer && !canTranslatePointAnswer) return untranslatedPointAnswer();
  if (!scopedDocuments.length || !configuredApiKey() || process.env.CSCOPILOT_NO_AI === "1") return sanitizeAnswer(fallback(issue, scopedDocuments, modelHistory, currentDraft, lang), lang);
  const context = scopedDocuments.map((doc, index) => `REFERENCE ${index + 1}\nCONTENT:\n${doc.content}`).join("\n\n");
  let response;
  try {
    response = await withRetry(() => client().messages.create({
      model: process.env.ANTHROPIC_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 1800,
      system,
messages: [
  ...modelHistory,
  {
    role: "user",
    content: `RESPONSE LANGUAGE: ${lang === "en" ? "English" : "Indonesian"} (the language of this conversation; use it for every text field, even if the current message is only a number or "ok").

CURRENT CLIENT MESSAGE (answer this; the messages above are context only):
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
    if (isUnavailableAnthropicError(error)) return safePointFallback() ?? sanitizeAnswer(fallback(issue, scopedDocuments, history, currentDraft, lang), lang);
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
    return safePointFallback() ?? sanitizeAnswer(fallback(issue, scopedDocuments, history, currentDraft, lang), lang);
  }
  if (!isModelAnswer(parsed)) {
    console.warn("Claude returned an unexpected schema; using grounded fallback");
    return safePointFallback() ?? sanitizeAnswer(fallback(issue, scopedDocuments, history, currentDraft, lang), lang);
  }
  const citations = mapCitations(parsed.citations, scopedDocuments);
  const grounded = citations.length === parsed.citations.length && citations.length > 0;
  return (grounded ? undefined : safePointFallback()) ?? sanitizeAnswer(enforceMissingContextInvariant({
    ...parsed,
    citations,
    ...(grounded ? {} : {
      answer: "Jawaban ini belum memiliki sumber knowledge yang valid dan perlu ditinjau ulang oleh tim Customer Support.",
      draft_reply: "",
      confidence: "low" as const,
      missing_context: ["Sumber knowledge yang valid belum tersedia untuk jawaban ini."],
    }),
  }), lang);
}

export { fallback as generateNoAiAnswer };

import Anthropic from "@anthropic-ai/sdk";
import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { continuationSignal, greetingAnswer, isClosingMessage, isGreetingOnly, pointAnswer } from "./retrieval";
import { withRetry } from "./retry";
import { enforceMissingContextInvariant } from "./assistant-check";

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
    .map((citation) => documents[citation.reference_index - 1] && { document_id: documents[citation.reference_index - 1].id, title: documents[citation.reference_index - 1].title, url: documents[citation.reference_index - 1].url, quote: citation.quote })
    .filter((citation): citation is GroundedAnswer["citations"][number] => Boolean(citation));
}

export function fallback(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = []): GroundedAnswer {
  if (isClosingMessage(issue)) {
    return {
      intent: "Conversation closed",
      summary: "The customer conversation was acknowledged.",
      missing_context: [],
      recommended_action: "No further action is required.",
      answer: "Sama-sama. Jika ada issue lain, silakan kirimkan detailnya.",
      draft_reply: "Sama-sama. Jika ada kendala lain, silakan kabari kami.",
      citations: [],
      confidence: "high",
    };
  }

  // Follow-up questions ("menurutmu kenapa?") carry no keywords of their own;
  // rank against the whole thread's user turns so context carries over.
  const contextText = continuationSignal(issue)
    ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), issue].join(" ")
    : issue;
  const contextWords = words(contextText);
  const ranked = documents
    .map((document, index) => ({ document, index, score: [...words(`${document.title} ${document.content}`)].filter((word) => contextWords.has(word)).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter(({ score }) => score > 0)
    .slice(0, 3)
    .map(({ document }) => document);

  if (!ranked.length) {
    return {
      intent: "Needs clarification",
      summary: "No matching company knowledge was found.",
      missing_context: ["Relevant company documentation is unavailable. Confirm the account, error message, and steps already tried."],
      recommended_action: "Collect the missing details and verify the case manually before replying.",
      answer: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Bisa tolong kirimkan pesan error yang muncul, akun yang terdampak, dan langkah yang sudah dicoba?",
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
  const summaryLine = best.content.split("\n").find((line) => line.startsWith("Customer Safe Summary:"))?.replace("Customer Safe Summary:", "").trim();
  const actionLine = best.content.split("\n").find((line) => line.startsWith("Customer Action:"))?.replace("Customer Action:", "").trim();
  // Customer Action is an internal CS instruction, never customer-facing —
  // only Customer Reply may become draft_reply (same rule as pointAnswer).
  const replyLine = best.content.split("\n").find((line) => line.startsWith("Customer Reply:"))?.replace("Customer Reply:", "").trim();
  const answer = summaryLine ? `Kemungkinan penyebab: ${summaryLine}.` : "Kami sedang meninjau kendala yang disampaikan dan akan memverifikasi penanganan yang sesuai.";
  return {
    intent: "Support issue",
    summary: `Kemungkinan penyebab dari: ${best.title}.`,
    missing_context: replyLine ? [] : ["Artikel ini belum memiliki field Customer Reply. Tinjau dan lengkapi di Notion sebelum draft dapat dibuat otomatis."],
    recommended_action: actionLine || "Review the cited knowledge and confirm it applies to this customer's case before responding.",
    answer,
    draft_reply: replyLine ? `Terima kasih sudah menghubungi kami. ${replyLine}` : "",
    citations,
    confidence: replyLine ? "medium" : "low",
    ...(replyLine ? {} : { knowledge_gap: true }),
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
Clarification Flow: before answering, check whether the issue plus the supplied history and sources are actually enough to give a grounded, specific reply. If not, do not guess — set missing_context to what is still needed, put ONE short, specific question in answer (e.g. ask for the exact error message or order number, not "can you give more details?"), and leave draft_reply empty; set confidence to "low". Never ask again for something the customer or agent already stated earlier in the history. If the message is ambiguous, indirect ("itu", "yang tadi", "masih sama"), or sarcastic, first try to resolve it from the conversation history; only ask a clarifying question if it genuinely cannot be resolved that way. If the conversation is discussing more than one distinct issue, identify which one the current message is about; if that itself is unclear, ask which issue it refers to instead of mixing information between them.
Produce an editable customer-facing draft, never send it, and never claim it was sent. When missing_context is non-empty, draft_reply must be "".
Return JSON matching the requested schema.`;

export async function generateGroundedAnswer(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = [], contextSummary = ""): Promise<GroundedAnswer> {
  if (isGreetingOnly(issue)) return greetingAnswer(issue, history);
  const deterministicPointAnswer = pointAnswer(issue, documents, history);
  if (deterministicPointAnswer) return deterministicPointAnswer;
  if (!configuredApiKey() || process.env.CSCOPILOT_NO_AI === "1") return fallback(issue, documents, history);
  const context = documents.map((doc, index) => `REFERENCE ${index + 1}\nCONTENT:\n${doc.content}`).join("\n\n");
  let response;
  try {
    response = await withRetry(() => client().messages.create({
      model: process.env.ANTHROPIC_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL,
      max_tokens: 1800,
      thinking: { type: "adaptive" } as never,
      system,
messages: [
  ...history,
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
    if (isUnavailableAnthropicError(error)) return fallback(issue, documents, history);
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
    return fallback(issue, documents, history);
  }
  if (!isModelAnswer(parsed)) {
    console.warn("Claude returned an unexpected schema; using grounded fallback");
    return fallback(issue, documents, history);
  }
  return enforceMissingContextInvariant({ ...parsed, citations: mapCitations(parsed.citations, documents) });
}

export { fallback as generateNoAiAnswer };

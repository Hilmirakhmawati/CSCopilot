import Anthropic from "@anthropic-ai/sdk";
import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { continuationSignal, isClosingMessage } from "./retrieval";
import { withRetry } from "./retry";

function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 0 });
}

function words(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9À-ɏ]+/g) ?? []);
}

function isGroundedAnswer(value: unknown): value is GroundedAnswer {
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
    return typeof item.document_id === "string" && typeof item.title === "string" && typeof item.quote === "string" && (item.url === null || typeof item.url === "string");
  });
}

function fallback(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = []): GroundedAnswer {
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
      answer: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini.",
      draft_reply: "Terima kasih sudah menghubungi kami. Kami sedang meninjau kendala ini. Mohon kirimkan pesan error yang muncul, akun yang terdampak, dan langkah yang sudah dicoba.",
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
  const answer = [summaryLine && `Kemungkinan penyebab: ${summaryLine}.`, actionLine && `Langkah penanganan: ${actionLine}.`].filter(Boolean).join("\n\n") || `Dokumen relevan ditemukan: ${best.title}. Respons final memerlukan review Customer Support.`;
  return {
    intent: "Support issue",
    summary: `Kemungkinan penyebab dari: ${best.title}.`,
    missing_context: [],
    recommended_action: "Review the cited knowledge and confirm it applies to this customer's case before responding.",
    answer,
    draft_reply: actionLine ? `Terima kasih sudah menghubungi kami. ${actionLine}` : "Terima kasih sudah menghubungi kami. Kami sedang meninjau kendala yang disampaikan dan akan memverifikasi langkah penanganan yang sesuai.",
    citations,
    confidence: "medium",
  };
}

const system = `You are CSCoPilot, an internal Customer Support decision-support assistant.
Notion sources are the only authority for company-specific claims. Use only supplied sources.
If sources are insufficient, ask focused clarification questions and say what is missing.
Never invent policies, refunds, timelines, credentials, or troubleshooting steps.
Every supported company-specific claim needs a citation using the exact source ID.
Produce an editable customer-facing draft, never send it, and never claim it was sent.
Return JSON matching the requested schema.`;

export async function generateGroundedAnswer(issue: string, documents: KnowledgeDocument[], history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<GroundedAnswer> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.CSCOPILOT_NO_AI === "1") return fallback(issue, documents, history);
  const context = documents.map((doc, index) => `SOURCE ${index + 1}\nID: ${doc.id}\nTITLE: ${doc.title}\nURL: ${doc.url ?? ""}\nCONTENT:\n${doc.content}`).join("\n\n");
  const response = await withRetry(() => client().messages.create({
    model: "claude-opus-5",
    max_tokens: 1800,
    thinking: { type: "adaptive" } as never,
    system,
    messages: [
      ...history,
      { role: "user", content: `ISSUE:\n${issue}\n\nKNOWLEDGE CONTEXT:\n${context || "No reliable source found."}\n\nReturn JSON with keys: intent, summary, missing_context, recommended_action, answer, draft_reply, citations (document_id,title,url,quote), confidence (low|medium|high).` },
    ],
  } as never));
  if ((response as { stop_reason?: string }).stop_reason === "refusal") throw new Error("Claude refused this request");
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returned no answer");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Claude returned invalid answer");
  }
  if (!isGroundedAnswer(parsed)) throw new Error("Claude returned invalid answer");
  return parsed;
}

export { fallback as generateNoAiAnswer };

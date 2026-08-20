import Anthropic from "@anthropic-ai/sdk";
import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";

function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function words(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9À-ɏ]+/g) ?? []);
}

function fallback(issue: string, documents: KnowledgeDocument[]): GroundedAnswer {
  const issueWords = words(issue);
  const ranked = documents
    .map((document, index) => ({ document, index, score: [...words(`${document.title} ${document.content}`)].filter((word) => issueWords.has(word)).length }))
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
  const titles = ranked.map((document) => document.title).join(", ");
  return {
    intent: "Support issue",
    summary: `Relevant knowledge found in: ${titles}.`,
    missing_context: [],
    recommended_action: "Review the cited knowledge and confirm it applies to this customer's case before responding.",
    answer: "Dokumen relevan ditemukan. Respons final memerlukan review Customer Support.",
    draft_reply: "Terima kasih sudah menghubungi kami. Kami sedang meninjau kendala yang disampaikan dan akan memverifikasi langkah penanganan yang sesuai.",
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

export async function generateGroundedAnswer(issue: string, documents: KnowledgeDocument[]): Promise<GroundedAnswer> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.CSCOPILOT_NO_AI === "1") return fallback(issue, documents);
  const context = documents.map((doc, index) => `SOURCE ${index + 1}\nID: ${doc.id}\nTITLE: ${doc.title}\nURL: ${doc.url ?? ""}\nCONTENT:\n${doc.content}`).join("\n\n");
  const response = await client().messages.create({
    model: "claude-opus-5",
    max_tokens: 1800,
    thinking: { type: "adaptive" } as never,
    system,
    messages: [{ role: "user", content: `ISSUE:\n${issue}\n\nKNOWLEDGE CONTEXT:\n${context || "No reliable source found."}\n\nReturn JSON with keys: intent, summary, missing_context, recommended_action, answer, draft_reply, citations (document_id,title,url,quote), confidence (low|medium|high).` }],
  } as never);
  if ((response as { stop_reason?: string }).stop_reason === "refusal") throw new Error("Claude refused this request");
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returned no answer");
  return JSON.parse(text) as GroundedAnswer;
}

export { fallback as generateNoAiAnswer };

import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { continuationSignal, isAccountLabelOnly, isOrderLabelOnly, requiredContext, sourceLine, suppliedIdentifier } from "./retrieval";

type Turn = { role: "user" | "assistant"; content: string };
type Kind = "account" | "order" | "email" | "unknown";

// CS reporting a check they did themselves ("sudah saya cek ..."). Only this
// phrasing counts; the AI never produces such results.
const csResultPattern = /\b(?:sudah|udah|telah)\s+(?:saya|aku|kami|gue)?\s*(?:cek|periksa|dicek|diperiksa)\b|\bhasil(?:nya)?\s+(?:cek|pengecekan|pemeriksaan)\b/i;
const NO_DOC_STEPS = [
  "Kumpulkan info case dari customer (nomor akun/pesanan, pesan error, waktu kejadian).",
  "Cek apakah ada artikel serupa di knowledge base.",
  "Eskalasi ke atasan atau PIC terkait bila belum ada panduan.",
];
const kindLabel: Record<Kind, string> = {
  account: "nomor akun (belum diverifikasi)",
  order: "nomor pesanan (belum diverifikasi)",
  email: "email akun (belum diverifikasi)",
  unknown: "nomor tanpa label (akun atau pesanan belum jelas)",
};

// Notion sync joins multi-line values with " | " so sourceLine() can read them.
export function splitItems(value: string) {
  return value.split("|").map((item) => item.trim().replace(/^(?:\d+[.)]|[-•])\s*/, "")).filter(Boolean);
}

function significantWords(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
}

function satisfied(context: string, kinds: Set<Kind>) {
  if (context === "nomor pesanan terkait") return kinds.has("order") || kinds.has("unknown");
  if (context === "nomor atau email akun terkait") return kinds.has("account") || kinds.has("email");
  return kinds.has("account") || kinds.has("order") || kinds.has("email");
}

function suppliedKinds(query: string, history: Turn[]) {
  const recent = continuationSignal(query, history) ? history.filter((m) => m.role === "user").slice(-3).map((m) => m.content) : [];
  const kinds = new Set<Kind>();
  for (const text of [...recent, query]) {
    const kind = suppliedIdentifier(text)?.kind;
    if (kind) kinds.add(kind);
  }
  // A label-only follow-up assigns the preceding bare number's kind.
  if (isAccountLabelOnly(query) && kinds.delete("unknown")) kinds.add("account");
  if (isOrderLabelOnly(query) && kinds.delete("unknown")) kinds.add("order");
  return kinds;
}

export function buildGuidance(answer: GroundedAnswer, documents: KnowledgeDocument[], query: string, history: Turn[] = [], now = Date.now()): GroundedAnswer {
  const document = documents.find((item) => item.id === answer.citations?.[0]?.document_id);
  if (!document) {
    if (documents.length || answer.intent === "Greeting" || answer.intent === "Conversation closed") return answer;
    return { ...answer, knowledge_status: "unavailable", next_actions: NO_DOC_STEPS };
  }

  const steps = splitItems(sourceLine(document.content, "Troubleshooting Steps"));
  const escalate = splitItems(sourceLine(document.content, "Escalate When"));
  const hasReply = Boolean(sourceLine(document.content, "Customer Reply"));
  const knowledge_missing = [!steps.length && "Troubleshooting Steps", !hasReply && "Customer Reply"].filter((item): item is string => Boolean(item));
  const lastVerified = sourceLine(document.content, "Last Verified");
  const verifiedAt = Date.parse(lastVerified);

  const kinds = suppliedKinds(query, history);
  const context = requiredContext(sourceLine(document.content, "Customer Action"), sourceLine(document.content, "Required Context"));
  const missing = context && !satisfied(context, kinds) ? [context] : [];
  const reportedResult = csResultPattern.test(query);
  const queryWords = significantWords(query);
  const matchesEscalation = reportedResult && escalate.some((entry) => [...significantWords(entry)].filter((word) => queryWords.has(word)).length >= 2);
  const stage = matchesEscalation ? "escalate" : reportedResult ? "cs_result" : kinds.size ? "info_received" : null;

  return {
    ...answer,
    ...(stage ? { case_understanding: { received: [...kinds].map((kind) => kindLabel[kind]), missing, stage } } : {}),
    ...(steps.length ? { next_actions: steps } : {}),
    ...(escalate.length ? { escalate_when: escalate } : {}),
    knowledge_status: knowledge_missing.length ? "partial" : "complete",
    ...(knowledge_missing.length ? { knowledge_missing } : {}),
    ...(lastVerified ? { last_verified: lastVerified } : {}),
    ...(Number.isFinite(verifiedAt) && now - verifiedAt > 90 * 86_400_000 ? { knowledge_stale: true } : {}),
  };
}

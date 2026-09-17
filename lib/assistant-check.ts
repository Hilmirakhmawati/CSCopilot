import assert from "assert/strict";
import { mapCitations, extractFirstJsonObject } from "./anthropic";
import { POINT_ARTICLE_TITLE_MATCHES, continuationSignal, pointArticleTitle, isPointTopic } from "./retrieval";
import { activeContextForPrompt, trimHistoryToBudget, updateActiveContext } from "./context";
import type { Citation, KnowledgeDocument } from "./assistant-types";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const sourceMarkerPattern = new RegExp(`(?:\\bSOURCE\\s+\\d+\\b|\\b(?:ID|TITLE|URL|CONTENT|SCORE|RELEVANCE|SIMILARITY)\\s*:)`, "i");
const uuidRegex = new RegExp(`\\b${uuidPattern}\\b`, "i");

export function validateCitations(citations: Citation[], documentIds: Set<string>) {
  return citations.filter((citation) => documentIds.has(citation.document_id));
}

export function hasCustomerFacingSourceLeak(value: string) {
  return sourceMarkerPattern.test(value) || uuidRegex.test(value);
}

// Code-level guarantee for the Clarification Flow: if the model (or a
// fallback path) reports missing_context, don't trust it to also have left
// draft_reply empty — enforce it here so a Suggested Reply can never appear
// alongside an unanswered "what's still missing" state.
export function enforceMissingContextInvariant<T extends { missing_context: string[]; draft_reply: string }>(answer: T): T {
  return answer.missing_context.length > 0 ? { ...answer, draft_reply: "" } : answer;
}

if (process.argv[1]?.endsWith("assistant-check.ts")) {
  assert.equal(validateCitations([{ document_id: "known", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 1);
  assert.equal(validateCitations([{ document_id: "unknown", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 0);
  assert.equal(hasCustomerFacingSourceLeak("SOURCE 1\\nID: 0863960c-7058-4822-b749-8d931bec649c"), true);
  assert.equal(hasCustomerFacingSourceLeak("Mohon kirim nomor akun atau nomor pesanan terkait."), false);

  const docs: KnowledgeDocument[] = [
    { id: "doc-1", title: "A", url: null, content: "", category: null, synced_at: "" },
    { id: "doc-2", title: "B", url: "https://x", content: "", category: null, synced_at: "" },
  ];
  const mapped = mapCitations([{ reference_index: 2, quote: "q" }, { reference_index: 9, quote: "dropped" }], docs);
  assert.deepEqual(mapped, [{ document_id: "doc-2", title: "B", url: "https://x", quote: "q" }]);
  assert.equal(extractFirstJsonObject(`prefix {"answer":"brace } inside"} suffix {"ignored":true}`), '{"answer":"brace } inside"}');
  assert.equal(extractFirstJsonObject("no JSON here"), undefined);

  assert.equal(pointArticleTitle("Saldo poin customer tampil 0 padahal sebelumnya ada"), POINT_ARTICLE_TITLE_MATCHES[0]);
  assert.equal(pointArticleTitle("Riwayat poin tidak sesuai dengan pesanan"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Perhitungan penggunaan poin saya salah"), POINT_ARTICLE_TITLE_MATCHES[2]);
  assert.equal(pointArticleTitle("Riwayat poin pada pesanan umum tidak konsisten"), POINT_ARTICLE_TITLE_MATCHES[3]);
  assert.equal(pointArticleTitle("Ada selisih saldo poin, minta audit"), POINT_ARTICLE_TITLE_MATCHES[4]);
  assert.equal(isPointTopic("Poin saya tiba-tiba jadi nol"), true);
  assert.equal(isPointTopic("Bagaimana cara reset password customer?"), false);
  assert.equal(isPointTopic("Bagaimana proses refund order?"), false);

  // Regression: an explicit new topic must not inherit the previous point
  // topic just because it is short. Only genuine follow-ups ("masih sama")
  // should be treated as continuations that borrow prior context.
  assert.equal(continuationSignal("Pembayaran saya gagal"), false);
  assert.equal(continuationSignal("Masih sama"), true);
  assert.equal(continuationSignal("itu"), true);
  assert.equal(continuationSignal("Cari SOP refund"), false);
  const context = updateActiveContext("Poin saya jadi 0", {}, false, "2026-01-01T00:00:00Z");
  assert.match(activeContextForPrompt(context), /Poin saya jadi 0/);
  assert.equal(updateActiveContext("Pembayaran saya gagal", context, false).topic.value, "Pembayaran saya gagal");
  assert.equal(trimHistoryToBudget([{ content: "a".repeat(1000) }, { content: "latest" }], 2).length, 1);

  assert.deepEqual(
    enforceMissingContextInvariant({ missing_context: ["nomor pesanan"], draft_reply: "Terima kasih..." }),
    { missing_context: ["nomor pesanan"], draft_reply: "" },
  );
  assert.deepEqual(
    enforceMissingContextInvariant({ missing_context: [], draft_reply: "Terima kasih..." }),
    { missing_context: [], draft_reply: "Terima kasih..." },
  );

  console.log("assistant-check passed");
}

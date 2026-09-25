import assert from "assert/strict";
import { fallback, mapCitations, extractFirstJsonObject } from "./anthropic";
import { POINT_ARTICLE_TITLE_MATCHES, continuationSignal, pointAnswer, pointArticleTitle, isPointTopic } from "./retrieval";
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
  assert.equal(pointArticleTitle("Kenapa riwayat poin beda?"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Kenapa riwayat poin tidak sesuai?"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Perhitungan penggunaan poin saya salah"), POINT_ARTICLE_TITLE_MATCHES[2]);
  assert.equal(pointArticleTitle("Riwayat poin pada pesanan umum tidak konsisten"), POINT_ARTICLE_TITLE_MATCHES[3]);
  assert.equal(pointArticleTitle("Ada selisih saldo poin, minta audit"), POINT_ARTICLE_TITLE_MATCHES[4]);
  assert.equal(isPointTopic("Poin saya tiba-tiba jadi nol"), true);
  assert.equal(isPointTopic("Bagaimana cara reset password customer?"), false);
  assert.equal(isPointTopic("Bagaimana proses refund order?"), false);

  // Legacy row: no Customer Reply field yet. Must never surface Customer
  // Action as a customer-facing draft — the app has to hold back and ask
  // for the Notion row to be completed instead.
  const legacyDocuments: KnowledgeDocument[] = [{
    id: "point-1",
    title: POINT_ARTICLE_TITLE_MATCHES[1],
    url: "https://notion.so/point-1",
    content: "Customer Safe Summary: Riwayat poin dapat berbeda dari riwayat pesanan.\nCustomer Action: Minta nomor pesanan terkait untuk verifikasi.",
    category: "points",
    synced_at: "",
  }];
  const legacyPoint = pointAnswer("Kenapa riwayat poin beda?", legacyDocuments);
  assert.ok(legacyPoint);
  assert.equal(legacyPoint?.draft_reply, "");
  assert.equal(legacyPoint?.recommended_action, "Minta nomor pesanan terkait untuk verifikasi");
  assert.equal(legacyPoint?.missing_context.length > 0, true);
  assert.equal(legacyPoint?.citations.length, 1);
  assert.equal(legacyPoint?.answer.includes("Kemungkinan penyebab"), false);
  assert.equal(legacyPoint?.answer.includes("Minta nomor pesanan"), false);

  // Same legacy-row shape through the generic fallback() path (no Anthropic
  // response) — Customer Action must never leak into draft_reply here either.
  const legacyFallback = fallback("saldo poin saya bermasalah", legacyDocuments);
  assert.equal(legacyFallback.draft_reply, "");
  assert.equal(legacyFallback.draft_reply.includes("Minta nomor pesanan terkait untuk verifikasi"), false);
  assert.equal(legacyFallback.knowledge_gap, true);

  const pointDocuments: KnowledgeDocument[] = [{
    id: "point-1b",
    title: POINT_ARTICLE_TITLE_MATCHES[1],
    url: "https://notion.so/point-1b",
    content:
      "Customer Safe Summary: Riwayat poin dapat berbeda dari riwayat pesanan.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk verifikasi.\n" +
      "Customer Reply: Terima kasih sudah menghubungi kami, mohon kirimkan nomor pesanan terkait agar kami bisa memeriksa riwayat poin",
    category: "points",
    synced_at: "",
  }];
  const point = pointAnswer("Kenapa riwayat poin beda?", pointDocuments);
  assert.ok(point);
  assert.equal(point?.draft_reply, "");
  assert.deepEqual(point?.missing_context, ["Mohon minta nomor pesanan terkait sebelum kasus ini diverifikasi."]);
  assert.equal(point?.citations.length, 1);
  assert.equal(point?.answer.includes("Kemungkinan penyebab"), false);
  // Customer Action (internal) must never leak into the customer-facing draft.
  assert.equal(point?.recommended_action, "Minta nomor pesanan terkait untuk verifikasi");

  const zeroBalanceDocuments: KnowledgeDocument[] = [{
    id: "point-0",
    title: POINT_ARTICLE_TITLE_MATCHES[0],
    url: "https://notion.so/point-0",
    content:
      "Customer Safe Summary: Saldo poin dapat menampilkan 0 karena kendala sinkronisasi.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk verifikasi.\n" +
      "Required Context: Nomor order\n" +
      "Customer Reply: Terima kasih sudah menghubungi kami, mohon kirimkan nomor pesanan terkait agar tim kami bisa memeriksa saldo poin Anda",
    category: "points",
    synced_at: "",
  }];
  assert.equal(continuationSignal("123344555"), true);
  assert.equal(continuationSignal("customer@example.com"), true);
  const verifiedBareIdentifier = pointAnswer("123344555", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(verifiedBareIdentifier?.missing_context.length, 0);
  assert.notEqual(verifiedBareIdentifier?.draft_reply, "");
  const verifiedPoint = pointAnswer("1223243144 ini adalah no pesanannya", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(verifiedPoint?.missing_context.length, 0);
  assert.notEqual(verifiedPoint?.draft_reply, "");
  assert.equal(verifiedPoint?.draft_reply.includes("Minta nomor pesanan terkait untuk verifikasi"), false);
  assert.equal(point?.answer.includes("akan disesuaikan"), false);

  const calculationDocuments: KnowledgeDocument[] = [{
    id: "point-calculation",
    title: POINT_ARTICLE_TITLE_MATCHES[2],
    url: "https://notion.so/point-calculation",
    content:
      "Customer Safe Summary: Perhitungan penggunaan poin perlu ditinjau ulang.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk meninjau ulang perhitungan poin. Jika perlu, minta screenshot melalui channel yang mendukung attachment.\n" +
      "Required Context: Nomor pesanan\n" +
      "Customer Reply: Mohon kirimkan nomor pesanan terkait agar kami dapat meninjau perhitungan poin Anda",
    category: "points",
    synced_at: "",
  }];
  const calculationWithoutContext = pointAnswer("Cara cek perhitungan poin?", calculationDocuments);
  assert.deepEqual(calculationWithoutContext?.missing_context, [
    "Mohon minta nomor pesanan terkait sebelum kasus ini diverifikasi.",
  ]);
  // Regression: mentioning "screenshot" in the chat must not be treated as a
  // real attachment — the app has no attachment upload path yet.
  const calculationScreenshotOnly = pointAnswer("ini screenshot perhitungannya, terlampir ya", calculationDocuments, [{ role: "user", content: "Cara cek perhitungan poin?" }]);
  assert.equal(calculationScreenshotOnly?.missing_context.length, 1);
  const calculationVerified = pointAnswer("1234567890 ini nomor pesanannya", calculationDocuments, [{ role: "user", content: "Cara cek perhitungan poin?" }]);
  assert.equal(calculationVerified?.missing_context.length, 0);
  assert.notEqual(calculationVerified?.draft_reply, "");

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

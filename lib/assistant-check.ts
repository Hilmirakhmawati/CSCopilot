import assert from "node:assert/strict";
import { mapCitations, extractFirstJsonObject } from "./anthropic";
import { POINT_ARTICLE_TITLE_MATCHES, pointArticleTitle, isPointTopic } from "./retrieval";
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

  console.log("assistant-check passed");
}

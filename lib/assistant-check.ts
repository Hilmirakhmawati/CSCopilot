import assert from "node:assert/strict";
import type { Citation } from "./assistant-types";

export function validateCitations(citations: Citation[], documentIds: Set<string>) {
  return citations.filter((citation) => documentIds.has(citation.document_id));
}

if (process.argv[1]?.endsWith("assistant-check.ts")) {
  assert.equal(validateCitations([{ document_id: "known", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 1);
  assert.equal(validateCitations([{ document_id: "unknown", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 0);
  console.log("assistant-check passed");
}

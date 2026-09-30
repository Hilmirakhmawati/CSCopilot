import type { GroundedAnswer } from "./assistant-types";
import { isCustomerContextRequest } from "./retrieval";

const LEAK_FALLBACK_ANSWER = "Mohon maaf, jawaban ini perlu ditinjau ulang oleh tim Customer Support sebelum dikirim ke customer.";
const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const sourceMarkerPattern = new RegExp(`(?:\\bSOURCE\\s+\\d+\\b|\\b(?:ID|TITLE|URL|CONTENT|SCORE|RELEVANCE|SIMILARITY)\\s*:)`, "i");
const uuidRegex = new RegExp(`\\b${uuidPattern}\\b`, "i");

export function hasCustomerFacingSourceLeak(value: string) {
  return sourceMarkerPattern.test(value) || uuidRegex.test(value);
}

export function enforceMissingContextInvariant<T extends { missing_context: string[]; draft_reply: string }>(answer: T): T {
  return answer.missing_context.length > 0 && !isCustomerContextRequest(answer.draft_reply) ? { ...answer, draft_reply: "" } : answer;
}

export function sanitizeAnswer(answer: GroundedAnswer): GroundedAnswer {
  if (!hasCustomerFacingSourceLeak(answer.answer) && !hasCustomerFacingSourceLeak(answer.draft_reply)) return answer;
  return enforceMissingContextInvariant({ ...answer, answer: LEAK_FALLBACK_ANSWER, draft_reply: LEAK_FALLBACK_ANSWER, confidence: "low" });
}

import type { GroundedAnswer } from "./assistant-types";
import { isCustomerContextRequest } from "./retrieval";
import type { ResponseLanguage } from "./language";

const LEAK_FALLBACK_ANSWER = "Mohon maaf, jawaban ini perlu ditinjau ulang oleh tim Customer Support sebelum dikirim ke customer.";
const LEAK_FALLBACK_ANSWER_EN = "Sorry, this answer needs to be reviewed by Customer Support before it is sent to the customer.";
const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const sourceMarkerPattern = new RegExp(`(?:\\bSOURCE\\s+\\d+\\b|\\b(?:ID|TITLE|URL|CONTENT|SCORE|RELEVANCE|SIMILARITY)\\s*:)`, "i");
const uuidRegex = new RegExp(`\\b${uuidPattern}\\b`, "i");

export function hasCustomerFacingSourceLeak(value: string) {
  return sourceMarkerPattern.test(value) || uuidRegex.test(value);
}

// The assistant has no DB/API access, so it must never claim a check happened or a fix was made.
const fabricatedCheckPattern = /\bsudah\s+(?:kami\s+|saya\s+|tim\s+kami\s+)?(?:cek|periksa|dicek|diperiksa|diverifikasi|dikembalikan|diperbaiki|diproses|dikoreksi)\b|\b(?:saya|aku)\s+akan\s+(?:mengecek|memeriksa|memverifikasi)\b|\btelah\s+(?:kami\s+)?(?:dicek|diperiksa|diverifikasi|dikembalikan|diperbaiki)\b/i;
const fabricatedCheckPatternEn = /\b(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+(?:already\s+)?(?:checked|verified|reviewed|fixed|processed)\b|\bour\s+(?:team|system)\s+(?:has\s+)?(?:already\s+)?(?:checked|verified|reviewed|fixed|processed)\s+(?:your|this|the\s+(?:order|account|case|ticket))\b/i;

export function hasFabricatedCheckClaim(value: string) {
  return fabricatedCheckPattern.test(value) || fabricatedCheckPatternEn.test(value);
}

export function enforceMissingContextInvariant<T extends { missing_context: string[]; draft_reply: string }>(answer: T): T {
  return answer.missing_context.length > 0 && !isCustomerContextRequest(answer.draft_reply) ? { ...answer, draft_reply: "" } : answer;
}

const UNVERIFIED_ANSWER = "Jawaban ini mengandung klaim pengecekan yang tidak didukung knowledge. Mohon verifikasi manual sebelum dikirim ke customer.";
const UNVERIFIED_ANSWER_EN = "This answer contains an unsupported verification claim. Verify it manually before sending it to the customer.";

export function sanitizeAnswer(answer: GroundedAnswer, lang: ResponseLanguage = "id"): GroundedAnswer {
  const unverified = lang === "en" ? UNVERIFIED_ANSWER_EN : UNVERIFIED_ANSWER;
  const leakFallback = lang === "en" ? LEAK_FALLBACK_ANSWER_EN : LEAK_FALLBACK_ANSWER;
  if (hasFabricatedCheckClaim(answer.answer) || hasFabricatedCheckClaim(answer.draft_reply)) {
    return enforceMissingContextInvariant({
      ...answer,
      answer: hasFabricatedCheckClaim(answer.answer) ? unverified : answer.answer,
      draft_reply: hasFabricatedCheckClaim(answer.draft_reply) ? "" : answer.draft_reply,
      confidence: "low",
    });
  }
  if (!hasCustomerFacingSourceLeak(answer.answer) && !hasCustomerFacingSourceLeak(answer.draft_reply)) return answer;
  return enforceMissingContextInvariant({ ...answer, answer: leakFallback, draft_reply: leakFallback, confidence: "low" });
}

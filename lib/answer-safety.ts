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
const fabricatedCheckPattern = /\bsudah\s+(?:kami\s+|saya\s+|tim\s+kami\s+|cs\s+|customer\s+service\s+)?(?:cek|periksa|dicek|diperiksa|diverifikasi|dikembalikan|diperbaiki|diproses|dikoreksi|mengecek|memeriksa|memverifikasi|melihat)\b|\b(?:saya|aku)\s+akan\s+(?:mengecek|memeriksa|memverifikasi)\b|\btelah\s+(?:kami\s+|saya\s+|cs\s+|customer\s+service\s+)?(?:dicek|diperiksa|diverifikasi|dikembalikan|diperbaiki|mengecek|memeriksa|memverifikasi)\b|\bsedang\s+(?:kami\s+|saya\s+)?(?:cek|periksa|mengecek|memeriksa|memverifikasi)\b|\bsaldo(?:\s+poin)?\s+(?:anda|kamu|akun\s+anda)\s+(?:saat\s+ini\s+)?(?:adalah|sebesar|masih)\b|\b(?:tim\s+kami|kami)\s+(?:melakukan|telah\s+melakukan|sudah\s+melakukan)\s+(?:audit|penyesuaian|perbaikan)\b/i;
const fabricatedCheckPatternEn = /\b(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+(?:already\s+)?(?:checked|verified|reviewed|fixed|processed|confirmed|looked\s+into|found)\b|\b(?:i|we)(?:'ll| will)\s+(?:check|verify|look\s+into)\b|\b(?:i(?:'m| am)|we(?:'re| are))\s+(?:currently\s+)?(?:checking|verifying|looking\s+into)\b|\bi\s+can\s+see\s+(?:that\s+)?(?:your|the|this)\b|\byour\s+(?:current\s+)?(?:point\s+)?balance\s+(?:is|shows|currently)\b|\bour\s+(?:team|system)\s+(?:has\s+)?(?:already\s+)?(?:checked|verified|reviewed|fixed|processed)\s+(?:your|this|the\s+(?:order|account|case|ticket))\b|\b(?:we|our\s+team)\s+(?:performed|completed|made)\s+(?:an?\s+)?(?:audit|adjustment|manual\s+adjustment|fix)\b/i;

export function hasFabricatedCheckClaim(value: string) {
  return fabricatedCheckPattern.test(value) || fabricatedCheckPatternEn.test(value);
}

export function enforceMissingContextInvariant<T extends { missing_context: string[]; draft_reply: string }>(answer: T): T {
  return answer.missing_context.length > 0 && !isCustomerContextRequest(answer.draft_reply) ? { ...answer, draft_reply: "" } : answer;
}

const SAFETY_WARNING = "Perlu verifikasi: data akun belum diverifikasi.";
const SAFETY_WARNING_EN = "Verification required: Account data has not been verified.";
const CS_ACTION_FALLBACK = "Verifikasi kasus secara manual melalui langkah pada knowledge base sebelum memberi penjelasan final ke customer.";
const CS_ACTION_FALLBACK_EN = "Verify the case manually using the steps in the knowledge base before giving the customer a final explanation.";
const SAFE_DRAFT_REQUEST = "Terima kasih sudah menghubungi kami. Kami akan menindaklanjuti kasus ini setelah ditinjau oleh tim kami.";
const SAFE_DRAFT_REQUEST_EN = "Thank you for contacting us. We will follow up on this case once our team has reviewed it.";

// Drop only the sentences that claim a check/fix; keep the rest of the text.
function stripClaimSentences(text: string) {
  return (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((part) => part.trim()).filter((part) => part && !hasFabricatedCheckClaim(part)).join(" ");
}

export function sanitizeAnswer(answer: GroundedAnswer, lang: ResponseLanguage = "id"): GroundedAnswer {
  const en = lang === "en";
  const leakFallback = en ? LEAK_FALLBACK_ANSWER_EN : LEAK_FALLBACK_ANSWER;
  if (hasFabricatedCheckClaim(answer.answer) || hasFabricatedCheckClaim(answer.draft_reply)) {
    // Keep a useful, safe answer; the warning is a separate small field, never the whole output.
    let safeAnswer = answer.answer;
    if (hasFabricatedCheckClaim(answer.answer)) {
      const cause = stripClaimSentences(answer.answer) || stripClaimSentences(answer.summary ?? "");
      const action = stripClaimSentences(answer.recommended_action ?? "") || (en ? CS_ACTION_FALLBACK_EN : CS_ACTION_FALLBACK);
      safeAnswer = [cause && `${en ? "Possible cause" : "Kemungkinan penyebab"}: ${cause}`, `${en ? "CS action" : "Tindakan CS"}: ${action}`].filter(Boolean).join("\n\n");
    }
    return enforceMissingContextInvariant({
      ...answer,
      answer: safeAnswer,
      draft_reply: hasFabricatedCheckClaim(answer.draft_reply) ? (en ? SAFE_DRAFT_REQUEST_EN : SAFE_DRAFT_REQUEST) : answer.draft_reply,
      confidence: "low",
      safety_warning: en ? SAFETY_WARNING_EN : SAFETY_WARNING,
    });
  }
  if (!hasCustomerFacingSourceLeak(answer.answer) && !hasCustomerFacingSourceLeak(answer.draft_reply)) return answer;
  return enforceMissingContextInvariant({ ...answer, answer: leakFallback, draft_reply: leakFallback, confidence: "low" });
}

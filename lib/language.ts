import { franc } from "franc-min";

export type ResponseLanguage = "id" | "en";

const INDONESIAN_MARKERS = /\b(?:aku|kami|kamu|anda|saya|mohon|tolong|sudah|udah|belum|bisa|tidak|gak|nggak|ga|kenapa|bagaimana|gimana|ingin|minta|pesanan|akun|poin|saldo|kendala|masalah|terima kasih|makasih|selamat|halo|hai|yang|dan|untuk|dengan|ini|itu|apa|apakah|ada|masih|terus|banget|kak)\b/i;
// Loanwords shared with Indonesian (issue, order, account, point, balance) are deliberately absent.
const ENGLISH_MARKERS = /\b(?:the|this|that|with|from|please|could|would|can|cannot|can't|how|why|what|where|when|is|are|my|your|thanks|thank you|hello|hi|hey|good morning|good afternoon|good evening)\b/i;

// requiredContext() returns fixed Indonesian labels; this is their English form.
const CONTEXT_LABEL_EN: Record<string, string> = {
  "nomor pesanan terkait": "related order number",
  "nomor atau email akun terkait": "related account number or email",
  "nomor akun atau nomor pesanan terkait": "related account number or order number",
};

export function contextLabel(context: string, lang: ResponseLanguage) {
  return lang === "en" ? CONTEXT_LABEL_EN[context] ?? context : context;
}

const countMatches = (pattern: RegExp, value: string) => value.match(new RegExp(pattern.source, "gi"))?.length ?? 0;

// franc is unreliable below ~3 words ("Order 123 failed" shares its words with Indonesian), so shorter input stays Indonesian.
const MIN_WORDS_FOR_FRANC = 3;

export function detectLanguage(text: string): ResponseLanguage {
  const value = text.trim();
  if (!value) return "id";
  const indonesian = countMatches(INDONESIAN_MARKERS, value);
  const english = countMatches(ENGLISH_MARKERS, value);
  // Stray tokens ("ini", "ada", "ga") inside English text must not flip the reply language: the larger side wins, ties stay Indonesian.
  if (indonesian || english) return english > indonesian ? "en" : "id";
  const words = value.match(/\p{L}+/gu)?.length ?? 0;
  if (words < MIN_WORDS_FOR_FRANC) return "id";
  // ponytail: franc only separates eng from ind/zsm here; add more languages only if the app ever replies in them.
  return franc(value, { only: ["eng", "ind", "zsm"] }) === "eng" ? "en" : "id";
}

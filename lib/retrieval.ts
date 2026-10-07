import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { getSupabaseAdmin } from "./db";
import { filterDocumentsByProject, historyForProject, isStandaloneProjectAlias, resolveProjectScope } from "./project-scope";
import { contextLabel, detectLanguage, type ResponseLanguage } from "./language";

// Short questions or ones that reference something already said ("itu", "nya")
// carry no keywords of their own — only those get to borrow prior context.
// A short topic switch ("Pembayaran saya gagal") still has topic words and
// must not inherit history, or it will keep matching the previous topic.
const followUpWords = new Set(["itu", "nya", "tersebut", "ini", "sebelumnya", "barusan", "masih", "sama", "lagi", "belum", "sudah", "udah", "tetap", "begitu", "gimana", "kenapa", "kok", "ya", "dong", "sih", "aja", "saja"]);
const englishFollowUpPattern = /\b(?:how\s+(?:can|do|should)\s+i|what\s+should\s+i\s+do|can\s+i)\b.{0,50}\b(?:check|verify|see|find|fix|proceed|it|this|that)\b|\bwhat(?:'s|\s+is)?\s+next\b|\bwhat\s+(?:should|do|can|shall)\s+i\s+do\b.{0,20}\b(?:next|now|then)\b|\b(?:next|following)\s+steps?\b/i;

// A bare identifier (order number, account number, email) carries no topic
// keyword of its own — a customer replying "123344555" to "which order?" is
// answering the previous question, not asking a fresh one.
function looksLikeBareIdentifier(word: string) {
  return /^\d{4,}$/.test(word) || /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/.test(word);
}

// Words that only ever label an identifier being supplied ("Nomor pesanannya
// 1234567890"), never a complaint on their own. Combined with an identifier
// elsewhere in the message, they still carry no new topic of their own.
const identifierLabelWords = new Set(["nomor", "nomer", "no", "id", "pesanan", "pesanannya", "order", "akun", "akunnya", "email", "account", "number", "customer", "member", "user", "pelanggan", "berikut", "adalah", "yaitu", "nih", "tuh"]);

// "customer number", "member id", "nomor pelanggan" ... all name the customer's account.
const CUSTOMER_LABEL = String.raw`(?:(?:customer|member|user|pelanggan)\s+(?:number|id|no)|nom[eo]r\s+(?:customer|pelanggan|member))`;

export function continuationSignal(query: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) {
  if (
    isStandaloneProjectAlias(query, history) ||
    isFeedbackMessage(query) ||
    isDraftRegenerationRequest(query) ||
    isDraftFeedbackMessage(query) ||
    isDraftGreetingEdit(query) ||
    isSuppliedContextMessage(query) ||
    isAccountLabelOnly(query) ||
    isOrderLabelOnly(query) ||
    isCaseUpdate(query) ||
    isGuidanceFollowUp(query)
  ) return true;
  const normalized = query.toLowerCase();
  const words = normalized.match(/[a-z0-9À-ɏ@.+-]+/g) ?? [];
  if (englishFollowUpPattern.test(normalized)) return true;
  if (/\b(itu|nya|tersebut|ini|sebelumnya|barusan|selanjutnya|berikutnya)\b/.test(normalized)) return true;
  if (words.length > 0 && words.every((word) => looksLikeBareIdentifier(word) || identifierLabelWords.has(word)) && words.some((word) => looksLikeBareIdentifier(word))) return true;
  return words.length > 0 && words.length <= 3 && words.every((word) => followUpWords.has(word));
}

// Best-effort recognition of common Indonesian sarcastic/dismissive
// reactions in CS chat. This is a fixed list of known idioms plus one
// "ironic praise + issue word" pattern — not a general sarcasm classifier;
// sarcasm is tone- and context-dependent and cannot be fully captured by
// regex. Its only job is to stop the deterministic fallback from treating a
// sarcastic reaction as a literal statement worth keyword-ranking against a
// document — the message still gets a clarifying question, same as a
// genuine zero-match case.
const sarcasticMarkers = /\b(yaelah|ya\s+ampun|halah|ish|duh|terserah|yah\s+gitu\s+deh|gitu\s+doang|itu\s+aja)\b/i;
const ironicPraise = /\b(bagus|keren|mantap|hebat)\s+(banget|sekali)\b.{0,60}\b(error|gagal|rusak|lemot|lambat|nge-?lag|ngadat|macet)\b|\b(error|gagal|rusak|lemot|lambat|nge-?lag|ngadat|macet)\b.{0,60}\b(bagus|keren|mantap|hebat)\s+(banget|sekali)\b/i;

export function isSarcasticOrDismissive(query: string) {
  return sarcasticMarkers.test(query) || ironicPraise.test(query);
}

const feedbackMarkers = /(?:ya\s+terus\s+gimana\s+dong|masa\s+cuma\s+itu|masih\s+kurang\s+jelas|belum\s+menjawab\s+pertanyaan(?:ku|nya)?|terus\s+gimana|jawabannya\s+masih\s+kurang)/i;
const draftRegenerationMarkers = /\b(?:buat(?:kan)?|generate|regenerasi|alternatif|lainnya|baru)\b[\s\w-]{0,40}\b(?:draft|balasan)\b|\b(?:draft|balasan)\b[\s\w-]{0,40}\b(?:lainnya|alternatif|baru)\b/i;
const draftFeedbackMarkers = /\b(?:draft|balasan)\b[\s\w-]{0,30}\b(?:belum\s+sesuai|kurang|tidak\s+sesuai)\b/i;
const greetingEditMarkers = /\b(?:kurang|tambah(?:kan)?)\b[\s\w-]{0,20}\b(?:isi\s+)?sapaan\b|\b(?:sapaan|salam)\b.*\b(?:kurang|tambah(?:kan)?)\b/i;
const suppliedContextMarkers = /\b(?:customer|member|user|pelanggan)\s+(?:number|id|no)\b[^.!?\n]{0,40}\b\d{6,}\b|\b\d{6,}\b[^.!?\n]{0,40}\b(?:(?:customer|member|user|pelanggan)\s+(?:number|id|no)|nom[eo]r\s+(?:customer|pelanggan|member|akun)(?:nya)?)\b|\bnom[eo]r\s+(?:customer|pelanggan|member)\b[^.!?\n]{0,40}\b\d{6,}\b|\b(?:ini|berikut)\s+(?:akun(?:n?ya)?|account|nom[eo]r\s+(?:pesanan|order|akun)(?:n?ya)?|email)\b|\b(?:akun(?:n?ya)?|account|id\s+akun|nom[eo]r\s+(?:pesanan|order|akun)|email)\s*[:#-]?\s*(?:\d{6,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})|\b(?:this|that)\s+(?:account|order)(?:\s+(?:data|number|info))?\b|\b\d{6,}\b[^.!?\n]{0,40}\b(?:this|that)\s+(?:account|order)(?:\s+(?:data|number|info))?\b|\b\d{6,}\b[^.!?\n]{0,40}\b(?:account|order)(?:\s+(?:data|number|info))?\b/i;
const accountIdentifierPattern = /\b(?:akun(?:n?ya)?|account|id\s+akun|nom[eo]r\s+akun)\b[^.!?\n]{0,100}?\b\d{6,}\b/i;
const accountLabelOnlyPattern = /\b(?:akun(?:n?ya)?|account|id\s+akun|nom[eo]r\s+akun(?:n?ya)?)\b/i;
const orderLabelOnlyPattern = /\b(?:pesanan(?:nya)?|order|nom[eo]r\s+(?:pesanan|order)|id\s+(?:pesanan|order))\b/i;
const guidanceFollowUpMarkers = /\b(?:apa\s+saran|saran\s+(?:apa|yang)|yang\s+bisa\s+(?:aku|saya|kami)\s+(?:kasih|sampaikan))\b[\s\w-]{0,50}\b(?:client|customer)\b/i;

export function isFeedbackMessage(query: string) {
  return feedbackMarkers.test(query);
}

export type ConversationIntent =
  | "new_issue"
  | "feedback"
  | "draft_regeneration"
  | "draft_feedback"
  | "draft_edit"
  | "supplied_context"
  | "guidance_follow_up"
  | "case_update"
  | "follow_up"
  | "acknowledgement";

export function isDraftRegenerationRequest(query: string) {
  return draftRegenerationMarkers.test(query);
}

export function isDraftFeedbackMessage(query: string) {
  return draftFeedbackMarkers.test(query);
}

export function isDraftGreetingEdit(query: string) {
  return greetingEditMarkers.test(query);
}

export function isSuppliedContextMessage(query: string) {
  const hasIdentifier = /\b\d{6,}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(query);
  return hasIdentifier && (suppliedContextMarkers.test(query) || accountIdentifierPattern.test(query));
}

export function isAccountLabelOnly(query: string) {
  const normalized = query.toLowerCase().trim().replace(/[.!?,]+$/g, "").replace(/\s+/g, " ");
  return normalized.length <= 24 &&
    /^(?:(?:no\.?|nom[eo]r)\s+akun(?:n?ya)?|akun(?:n?ya)?(?:\s+(?:ya|ini|itu))?|account(?:\s+(?:ya|ini|itu))?|id\s+akun|(?:itu|ini)\s+(?:no\.?|nom[eo]r)?\s*akun)$/.test(normalized) &&
    accountLabelOnlyPattern.test(normalized);
}

// "no pesanan" after a bare number labels that number as an order number.
export function isOrderLabelOnly(query: string) {
  const normalized = query.toLowerCase().trim().replace(/[.!?,]+$/g, "").replace(/\s+/g, " ");
  return normalized.length <= 24 &&
    /^(?:(?:no\.?|nom[eo]r|id)\s+(?:pesanan|order)(?:nya)?|(?:pesanan|order)(?:nya)?(?:\s+(?:ya|ini|itu))?|(?:itu|ini)\s+(?:(?:no\.?|nom[eo]r)\s+)?(?:pesanan|order)(?:nya)?)$/.test(normalized) &&
    orderLabelOnlyPattern.test(normalized);
}

// CS reporting a check they did themselves ("sudah saya cek ..."). Only this
// phrasing counts; the AI never produces such results.
const caseUpdateMarkers = /\b(?:sudah|udah|telah)\s+(?:saya|aku|kami|gue)\s+(?:cek|periksa)\b|\bhasil(?:nya)?\s+(?:cek|pengecekan|pemeriksaan)\b/i;

export function isCaseUpdate(query: string) {
  return caseUpdateMarkers.test(query);
}

// Short "what now?" questions asked after info was supplied. Phrased many ways
// ("trus selanjutnya apa", "terus aku harus ngapain", "habis itu gimana", "what next"),
// so match the pieces (a next-step word + a question cue) instead of one phrase.
const nextStepWord = /\b(?:selanjutnya|berikutnya|kelanjutan(?:nya)?|lanjutan(?:nya)?|lanjut|(?:setelah|sesudah|habis|abis|usai)\s+(?:itu|ini|tu))\b/i;
const nextStepAsk = /\b(?:apa|apaan|apakah|gimana|bagaimana|ngapain|harus|mesti|perlu|dilakukan)\b|\?/i;
const nextStepQuestion = /\b(?:selanjutnya|berikutnya|kelanjut(?:an|nya)|lanjutan(?:nya)?|setelah\s+itu|sesudah\s+itu|habis\s+itu|abis\s+itu)\b[\s\w-]{0,30}\b(?:apa|gimana|bagaimana|ngapain|harus|mesti|perlu|dilakukan)\b|\b(?:apa|gimana|bagaimana)\b[\s\w-]{0,30}\b(?:selanjutnya|berikutnya|setelah\s+itu|sesudah\s+itu|habis\s+itu|lanjut)\b/i;
const doNextPhrase = /\bapa\s+(?:yang\s+)?(?:harus|perlu|mesti)\s+(?:(?:aku|saya|gue|kita|kami|cs)\s+)?(?:lakukan|lakuin|kerjakan|kerjain|dilakukan)\b|\b(?:sekarang|skrg|terus|trus|lalu|lantas|kemudian)\s+(?:(?:aku|saya|gue|kita|cs)\s+)?(?:harus\s+)?(?:ngapain|apa(?:\s+lagi)?|gimana|bagaimana)\s*\??\s*$|\bwhat\s+(?:now|next)\b|\bthen\s+what\b|\bwhat(?:'s|\s+is)?\s+(?:the\s+)?next\b|\bwhat\s+(?:should|do|can|shall)\s+(?:i|we)\s+do\b|\b(?:next|following)\s+steps?\b/i;
const mustDoPhrase = /\b(?:harus|mesti)\s+(?:(?:aku|saya|gue|kita|kami|cs)\s+)?(?:ngapain|gimana|bagaimana|apa)\b/i;

export function isGuidanceFollowUp(query: string) {
  if (guidanceFollowUpMarkers.test(query)) return true;
  if (isFeedbackMessage(query)) return false;
  const words = query.toLowerCase().match(/[a-z0-9À-ɏ'-]+/g) ?? [];
  if (words.length === 0 || words.length > 12) return false;
  if (doNextPhrase.test(query)) return true;
  if (nextStepQuestion.test(query)) return true;
  if (nextStepWord.test(query) && nextStepAsk.test(query)) return true;
  // "harus gimana?" alone is a next-step question; with a fresh complaint ("saldo poin 0 harus gimana") it is a new issue.
  return mustDoPhrase.test(query) && words.length <= 6 && !isPointTopic(query);
}

export function classifyConversationIntent(
  query: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  currentDraft = "",
): ConversationIntent {
  if (isClosingMessage(query)) return "acknowledgement";
  if (isDraftGreetingEdit(query) && currentDraft) return "draft_edit";
  if (isDraftRegenerationRequest(query) && currentDraft) return "draft_regeneration";
  if (isDraftFeedbackMessage(query) && currentDraft) return "draft_feedback";
  if (isSuppliedContextMessage(query)) return "supplied_context";
  if (isGuidanceFollowUp(query)) return "guidance_follow_up";
  if (isCaseUpdate(query)) return "case_update";
  if (isFeedbackMessage(query)) return "feedback";
  if (continuationSignal(query, history)) return "follow_up";
  return "new_issue";
}

// Pleasantries/closers ("oke terima kasih") need no knowledge search at all —
// searching would just reuse whatever the last topic's documents were.
const thanksPattern = /\b(?:terima\s*kasih|terimakasih|makasih|thanks?|thank\s+you|thx|tengkyu|trims)\b/;
// Words that may surround a thank-you without adding a new question or issue.
const closingFillers = new Set([
  "oke", "ok", "okay", "baik", "siap", "noted", "sip", "deh", "ya", "yaa", "kak", "kakak", "min", "gan", "banget", "sekali", "sangat", "banyak",
  "atas", "bantuannya", "bantuan", "infonya", "informasinya", "penjelasannya", "jawabannya", "got", "it", "so", "much", "very", "for", "your", "the", "help", "all",
  "that", "that's", "thats", "this", "helps", "helped", "helpful", "great", "perfect", "appreciate", "appreciated", "really", "a", "lot", "you", "guys", "again", "is", "was", "has",
]);
const closingHelpPhrase = /\b(?:telah|sudah|udah|sdh)?\s*(?:membantu|bantu|ngebantu|mmbantu|membantuannya)\b/g;

export function isClosingMessage(query: string) {
  const normalized = query.toLowerCase().trim().replace(/[.,!?]/g, "").replace(/\s+/g, " ");
  if (/^(?:(?:oke|ok|okay|baik|siap|noted|sip|makasih|terima kasih|thanks|thank you)(?: deh)?(?: terima kasih| makasih| thanks| thank you| got it| kak| ya)?)$/.test(normalized)) return true;
  // "terima kasih telahmembantu", "makasih banyak ya kak": a thank-you made only of thanks and filler words.
  if (!thanksPattern.test(normalized) || /\d/.test(normalized)) return false;
  const words = normalized.split(" ");
  if (words.length > 8) return false;
  const rest = normalized.replace(new RegExp(thanksPattern.source, "g"), " ").replace(closingHelpPhrase, " ").split(" ").filter(Boolean);
  return rest.every((word) => closingFillers.has(word)) && words.length > 0;
}

const greetingRoots = [
  "hi", "hello", "hallo", "halo", "hai", "hey", "helo", "yo", "sup",
  "hola", "ciao", "bonjour", "namaste", "salut", "good", "whats", "up",
  "permisi", "punten", "salam", "shalom", "met",
];
const timeGreetings = new Set(["pagi", "siang", "sore", "petang", "malam", "morning", "afternoon", "evening", "night"]);
const issueWords = /\b(bayar|pembayaran|gagal|error|kenapa|bagaimana|gimana|tolong|help|mau|tanya|minta|lupa|login|password|lapor|komplain|kirim|request|order|pesanan|akun|refund|masalah|issue|kendala|customer|saldo|poin|point|tidak|bisa|cara|status|cek|check)\b/i;

// Search fallback must not let common sentence words retrieve an unrelated article.
// Keep this small and language-focused; product terms remain searchable.
export const SEARCH_STOPWORDS = new Set([
  "aku", "saya", "gue", "kami", "kita", "customer", "the", "my", "i", "me", "we", "our",
  "tidak", "nggak", "gak", "bisa", "bisa", "mau", "ingin", "tolong", "please", "can", "could", "do", "does", "how", "what", "should", "is", "are", "to", "for", "a", "an", "and", "or", "ya", "yah", "dong", "kak", "min", "gimana", "bagaimana", "kenapa", "why", "what", "itu", "ini", "nya", "sih", "of", "on", "in", "my",
]);

export function contentTerms(value: string) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9À-ɏ]{3,}/g) ?? []).filter((term) => !SEARCH_STOPWORDS.has(term)))];
}

function normalizeGreeting(query: string) {
  return query
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = left[i - 1] === right[j - 1]
        ? diagonal
        : 1 + Math.min(diagonal, row[j], row[j - 1]);
      diagonal = above;
    }
  }
  return row[right.length];
}

function resemblesGreetingToken(token: string) {
  return greetingRoots.some((root) => token === root || editDistance(token, root) <= (root.length <= 4 ? 1 : 2));
}

function greetingLeadLength(rawTokens: string[]) {
  // "pagiii" -> trailing repeated letters collapse to the time word.
  const tokens = rawTokens.map((token) => (timeGreetings.has(token) ? token : token.replace(/(.)\1+$/, "$1")));
  const [first, second] = tokens;
  if (!first) return 0;
  if (first.startsWith("assalam") || first.startsWith("asalam") || first === "shalom") return 1;
  if (first === "selamat") return second && (timeGreetings.has(second) || second === "datang" || second === "hari") ? 2 : 0;
  if (first === "apa" && second === "kabar") return 2;
  if (first === "whats" && second === "up") return 2;
  if (first === "good" && second && timeGreetings.has(second)) return 2;
  if (timeGreetings.has(first) || resemblesGreetingToken(first)) return 1;
  return 0;
}

export function isGreetingOnly(query: string) {
  const raw = query.trim();
  if (/^(?:\p{Extended_Pictographic}|\s)+$/u.test(raw)) return true;
  if (!raw || /[?¿]/.test(raw) || /\d/.test(raw)) return false;
  const normalized = normalizeGreeting(raw);
  if (!normalized || normalized.length > 48 || issueWords.test(normalized)) return false;
  const tokens = normalized.split(" ");
  if (tokens.length > 6) return false;
  const leadLength = greetingLeadLength(tokens);
  if (!leadLength) return false;
  return tokens.slice(leadLength).length <= 3;
}

export function greetingAnswer(query: string, history: Array<{ role: "user" | "assistant"; content: string }> = [], lang: ResponseLanguage = detectLanguage(query)): GroundedAnswer {
  const normalized = query.toLowerCase();
  const english = lang === "en";
  const current = english ? "Hi! 👋" : /\b(pagi|selamat pagi)\b/.test(normalized) ? "Selamat pagi! 👋" : /\b(siang|selamat siang)\b/.test(normalized) ? "Selamat siang! 👋" : /\b(sore|petang|selamat sore|selamat petang)\b/.test(normalized) ? "Selamat sore! 👋" : /\b(malam|selamat malam)\b/.test(normalized) ? "Selamat malam! 👋" : "Halo! 👋";
  const hasTopic = history.some((message) => message.role === "user");
  const answer = hasTopic
    ? english ? `${current} Let's continue with the topic we discussed. What else would you like to ask?` : `${current} Kita lanjut bahas topik tadi ya. Ada yang ingin kamu tanyakan lagi?`
    : english ? `${current} What would you like to know?` : `${current} Ada yang mau kamu tanyakan?`;
  return { intent: "Greeting", summary: "The user sent a greeting.", missing_context: [], recommended_action: "Invite the user to share their question or issue.", answer, draft_reply: answer, citations: [], confidence: "high" };
}

// Point-balance/history questions are only allowed to answer from the five
// articles the CS team has explicitly reviewed and marked customer-safe
// (see cs-copilot-sync/fill-points-articles.ts). Any other synced "point"
// document — stale drafts, half-written notes — must not reach the model.
// These canonical titles match the current Notion sync script. Aliases keep
// older/expanded Notion titles working without widening the article set.
export const POINT_ARTICLE_TITLE_MATCHES = [
  "Customer Points Displayed as 0",
  "Point History Does Not Match Order History",
  "Point Usage Calculation Appears Incorrect",
  "Point History Inconsistency on General Orders",
  "Audit dan Perbaikan Saldo Point Customer",
] as const;

const POINT_ARTICLE_ALIASES: Record<string, readonly string[]> = {
  "Customer Points Displayed as 0": ["Investigate Customer Points Displayed as 0"],
  "Point Usage Calculation Appears Incorrect": ["Point Usage Calculation Appears Incorrect for Customer"],
};

function titleMatches(title: string, canonical: string) {
  const normalized = title.toLowerCase();
  return [canonical, ...(POINT_ARTICLE_ALIASES[canonical] ?? [])].some((match) => normalized.includes(match.toLowerCase()));
}

export function pointArticleTitle(query: string) {
  const normalized = query.toLowerCase();
  if (/\b(saldo|poin|point)\b.*\b(0|nol|hilang|kosong)\b|\b(0|nol|hilang|kosong)\b.*\b(saldo|poin|point)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[0];
  // English phrasing ("points balance 0", "my points are zero"); additive, Indonesian patterns above unchanged.
  if (/\b(points?|balance)\b.*\b(0|zero|missing|empty)\b|\b(0|zero|missing|empty)\b.*\b(points?|balance)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[0];
  if (/\b(riwayat|history|histori)\b/.test(normalized) && /\b(pesanan|order|transaksi(?:s)?|transaction(?:s)?)\b/.test(normalized) && /\b(tidak|beda|berbeda|cocok|sesuai|match|differ\w*|mismatch|inconsistent|wrong)\b/.test(normalized) && !/\bpesanan umum\b|\bgeneral order\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[1];
  if (/\b(riwayat|history|histori)\b.*\b(pesanan umum|general order)\b|\b(pesanan umum|general order)\b.*\b(riwayat|history|histori|konsisten|selisih)/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[3];
  if (/\b(riwayat|history|histori)\b.*\b(tidak|beda|berbeda|cocok|sesuai|match|selisih|differ\w*|difference|mismatch|inconsistent|wrong)\b|\b(tidak|beda|berbeda|cocok|sesuai|match|selisih|differ\w*|difference|mismatch|inconsistent|wrong)\b.*\b(riwayat|history|histori)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[1];
  if (/\b(perhitungan|kalkulasi|calculat\w*|computed|jumlah)\b.*\b(poin|points?)\b|\b(poin|points?)\b.*\b(terpakai|digunakan|usage|used|deducted|perhitungan|kalkulasi|calculat\w*)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[2];
  if (/\b(audit|periksa ulang|cek ulang|selisih|penyesuaian|sesuaikan|reconcile|adjust\w*|discrepanc\w*)\b.*\b(saldo|balance|poin|points?)\b|\b(saldo|balance|poin|points?)\b.*\b(audit|periksa ulang|cek ulang|selisih|penyesuaian|sesuaikan|reconcile|adjust\w*|discrepanc\w*)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[4];
  return null;
}

export function isPointTopic(query: string) {
  const normalized = query.toLowerCase();
  return /\b(poin|points?)\b/i.test(normalized) || pointArticleTitle(normalized) !== null ||
    (/\b(saldo|balance)\b/.test(normalized) && /\b(0|nol|hilang|kosong)\b/.test(normalized));
}

// A bare topic word ("saldo", "poin", "my points") names no problem; answering it invents one.
export function isVagueTopicOnly(query: string) {
  const words = query.toLowerCase().match(/[a-z]+/g) ?? [];
  if (/\d/.test(query) || !words.length || words.length > 3) return false;
  const topic = new Set(["saldo", "poin", "point", "points", "balance", "reward", "rewards"]);
  const filler = new Set(["my", "the", "a", "nya", "dong", "ya", "kak", "min", "tentang", "soal", "about", "ask", "tanya"]);
  return words.some((word) => topic.has(word)) && words.every((word) => topic.has(word) || filler.has(word));
}

export function restrictToActivePointArticles(documents: KnowledgeDocument[]) {
  return documents.filter((document) => POINT_ARTICLE_TITLE_MATCHES.some((match) => titleMatches(document.title, match)));
}

// Point articles answer only point topics. For any other topic they are noise
// (e.g. "tidak bisa checkout" must not surface the point-usage article).
export function withoutPointArticles(documents: KnowledgeDocument[]) {
  const points = new Set(restrictToActivePointArticles(documents).map((document) => document.id));
  return documents.filter((document) => !points.has(document.id));
}

// Same topic rule retrieveKnowledge uses: a continuation inherits the recent point topic, anything else stands alone.
export function hasExplicitIssueTopic(issue: string) {
  return /\b(login|akun|account|error|pesan|masalah|kendala|gagal|pembayaran|refund|order|pesanan|checkout|bayar|payment|password|sandi|pengiriman|kirim|shipping|voucher|promo)\b/i.test(issue);
}

// An explicit non-point topic in the message itself ("I can't checkout, what should I do?") never inherits the previous point topic.
// Narrower than hasExplicitIssueTopic: "akun"/"order"/"pesanan" are also context words in a point conversation ("no akun").
const otherTopic = /\b(login|checkout|bayar|pembayaran|payment|refund|password|sandi|pengiriman|shipping|voucher|promo)\b/i;

export function inheritsPriorTopic(query: string, history: Array<{ role: "user" | "assistant"; content: string }>) {
  return continuationSignal(query, history) && !(otherTopic.test(query) && !isPointTopic(query));
}

export function documentsForTopic(query: string, history: Array<{ role: "user" | "assistant"; content: string }>, documents: KnowledgeDocument[]) {
  const prior = history.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ");
  const combined = prior && inheritsPriorTopic(query, history) ? `${prior} ${query}` : query;
  return isPointTopic(combined) ? documents : withoutPointArticles(documents);
}

export function selectPointArticle(documents: KnowledgeDocument[], target: string | null) {
  const selected = target ? documents.filter((document) => titleMatches(document.title, target)) : restrictToActivePointArticles(documents);
  if (!target && new Set(selected.map((document) => document.id)).size > 1) return [];
  return selected;
}

export function sourceLine(content: string, label: string) {
  return content.split("\n").find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))?.slice(label.length + 1).trim().replace(/[.!?]+$/, "").trim() ?? "";
}

// Required Context is an explicit Notion field ("nomor pesanan", "nomor
// akun", ...). Falling back to scanning Customer Action only covers rows
// authored before that field existed.
// Normalizes both the explicit Notion "Required Context" field (free text,
// e.g. "Nomor order", "Order ID") and a fallback scan of Customer Action
// wording into canonical requirements the app knows how to check.
// The app cannot receive image attachments yet, so "screenshot"/"bukti" is
// deliberately not a recognized requirement — treating it as one would block
// draft creation forever, since it could never be marked satisfied honestly.
// ponytail: add attachment upload + Vision review, then reinstate a
// screenshot requirement category here.
export function requiredContext(action: string, explicit: string, title = "") {
  const value = `${explicit} ${action}`.toLowerCase();
  const hasOrder = /\b(nomor pesanan|nomor order|order id|id pesanan)\b/.test(value);
  const hasAccount = /\b(nomor akun|id akun|email akun|akun customer|akun pelanggan)\b/.test(value);
  // A 0-point balance is an account-level problem: ask for the account number first, accept an order number as an alternative.
  if (hasOrder && hasAccount && title && titleMatches(title, POINT_ARTICLE_TITLE_MATCHES[0])) return "nomor akun terkait";
  if (hasOrder && hasAccount) return "nomor akun atau nomor pesanan terkait";
  if (hasOrder) return "nomor pesanan terkait";
  if (hasAccount) return "nomor atau email akun terkait";
  return null;
}

export type SuppliedIdentifier = {
  kind: "account" | "order" | "email" | "unknown";
  value: string;
};

export function suppliedIdentifier(query: string): SuppliedIdentifier | null {
  const email = query.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
  if (email) return { kind: "email", value: email };

  const labeledAccount = query.match(/\b(?:akun(?:n?ya)?|account|id\s+akun|nom[eo]r\s+akun)\b[^.!?\n]{0,100}?\b(\d{6,})\b/i)?.[1];
  if (labeledAccount) return { kind: "account", value: labeledAccount };

  const labeledOrder = query.match(/\b(?:nomor|no\.?|id)?\s*(?:pesanan|order)\b[^.!?\n]{0,100}?\b(\d{6,})\b/i)?.[1];
  if (labeledOrder) return { kind: "order", value: labeledOrder };

  // "customer number 12344125255" / "12344125255 CUSTOMER NUMBER": the customer number is the account number.
  const customerLabeled = query.match(new RegExp(`\\b${CUSTOMER_LABEL}\\b[^.!?\\n]{0,40}?\\b(\\d{6,})\\b|\\b(\\d{6,})\\b[^.!?\\n]{0,40}?\\b${CUSTOMER_LABEL}\\b`, "i"));
  const customerNumber = customerLabeled?.[1] ?? customerLabeled?.[2];
  if (customerNumber) return { kind: "account", value: customerNumber };

  const accountAfter = query.match(/\b(\d{6,})\b[^.!?\n]{0,40}\b(?:(?:ini|this|that|itu|berikut)\s+)?(?:(?:nomor|no\.?|number)\s+)?(?:akun|account)(?:nya)?(?:\s+\w+)?\b/i)?.[1];
  if (accountAfter) return { kind: "account", value: accountAfter };

  // Number first, label after: "1617399381803 ini no pesanannya".
  const orderAfter = query.match(/\b(\d{6,})\b[^.!?\n]{0,40}?\b(?:nom[eo]r\s+|no\.?\s+|id\s+)?(?:pesanan|order)(?:nya)?\b/i)?.[1];
  if (orderAfter) return { kind: "order", value: orderAfter };

  const bare = query.match(/\b\d{6,}\b/)?.[0];
  return bare ? { kind: "unknown", value: bare } : null;
}

export function contextSatisfied(context: string | null, query: string) {
  if (!context) return true;
  const identifier = suppliedIdentifier(query);
  if (!identifier) return false;
  if (context === "nomor pesanan terkait") return identifier.kind === "order" || identifier.kind === "unknown";
  if (context === "nomor atau email akun terkait") return identifier.kind === "account" || identifier.kind === "email";
  if (context === "nomor akun terkait") return identifier.kind === "account" || identifier.kind === "order";
  if (context === "nomor akun atau nomor pesanan terkait") return identifier.kind !== "unknown";
  return false;
}

export function missingContextMessage(context: string | null, query: string, lang = detectLanguage(query)) {
  return context && !contextSatisfied(context, query)
    ? lang === "en"
      ? `Please provide the ${contextLabel(context, lang)} before the case can be verified.`
      : `Mohon minta ${context} sebelum kasus ini diverifikasi.`
    : null;
}

// Must match an actual "please send us the order/account number" request —
// not just any reply containing a polite word like "mohon"/"silakan", which
// could equally appear in a valid customer-facing sentence unrelated to
// asking for an identifier (e.g. "Silakan cek email Anda untuk status...").
export function isCustomerContextRequest(reply: string) {
  return /\b(mohon|silakan|tolong|please|kindly)\b[^.!?]{0,80}\b(kirim|kirimkan|berikan|cantumkan|masukkan|provide|send|share)\b[^.!?]{0,40}\b(nomor|akun|pesanan|order|email|id|account|number)\b/i.test(reply);
}

function withoutLeadingGreeting(value: string) {
  return value.replace(/^(?:halo|hai|hello|hi|selamat\s+(?:pagi|siang|sore|malam))\b[^.!?]*[,!.]?\s*/i, "").trim();
}

export function addDraftGreeting(value: string) {
  if (/^(?:halo|hai|hello|hi|selamat\s+(?:pagi|siang|sore|malam))\b/i.test(value.trim())) return value;
  return `Halo Kak, ${value.trim()}`;
}

// Notion Customer Reply often already opens with the standard thank-you.
export function withThanksGreeting(reply: string) {
  const text = reply.trim();
  return /^(?:terima kasih|halo|hai|hello|hi|selamat\s+(?:pagi|siang|sore|malam))\b/i.test(text)
    ? text
    : `Terima kasih sudah menghubungi kami. ${text}`;
}

export function reviseCustomerDraft(sourceReply: string, intent: ConversationIntent, currentDraft = "") {
  const source = sourceReply.trim();
  if (!source) return "";
  if (intent === "draft_edit") return addDraftGreeting(currentDraft || source);
  const body = withoutLeadingGreeting(source);
  return intent === "draft_regeneration" || intent === "draft_feedback" ? addDraftGreeting(body) : source;
}

function suppliedContextReply(reply: string, context: string, query: string, lang: ResponseLanguage) {
  if (!isCustomerContextRequest(reply)) return `${reply}.`;
  if (lang === "en") {
    const what = context === "nomor pesanan terkait" ? "order number" : context === "nomor atau email akun terkait" || context === "nomor akun terkait" ? "account number" : "account or order number";
    return `Thank you, we have received the ${what}. We will follow up on this case and let you know the outcome.`;
  }
  const label = context === "nomor pesanan terkait"
    ? "nomor pesanan"
    : context === "nomor atau email akun terkait"
      ? "informasi akun"
      : "informasi akun atau nomor pesanan";
  const issue = /\b(saldo|poin|point)\b.*\b(0|nol|kosong)\b|\b(0|nol|kosong)\b.*\b(saldo|poin|point)\b/i.test(query)
    ? "saldo poin yang tampil 0"
    : "kasus ini";
  return `Terima kasih, ${label} sudah kami terima. Kami akan membantu mengecek ${issue}, lalu menginformasikan hasilnya.`;
}

function suppliedIdentifierClarification(context: string | null, english = false) {
  if (english) {
    if (context === "nomor akun atau nomor pesanan terkait") return "The number has been received. Please confirm: is it an account number or an order number?";
    if (context === "nomor atau email akun terkait" || context === "nomor akun terkait") return "The number has been noted as case information. Please confirm it is the account number.";
    return "The number has been noted as case information. Please confirm it is correct.";
  }
  if (context === "nomor akun atau nomor pesanan terkait") return "Nomor sudah diterima. Mohon pastikan, itu nomor akun atau nomor pesanan?";
  if (context === "nomor atau email akun terkait" || context === "nomor akun terkait") return "Nomor dicatat sebagai info case. Mohon pastikan itu nomor akun.";
  return "Nomor dicatat sebagai info case. Mohon pastikan nomor tersebut benar.";
}

function topicClarification() {
  return "Boleh diperjelas, bagian mana dari topik poin sebelumnya yang masih kurang jelas, atau apakah ini pertanyaan baru?";
}

function suppliedContextAnswer(context: string, query: string, lang: ResponseLanguage) {
  if (lang === "en") {
    const what = context === "nomor pesanan terkait" ? "order number" : context === "nomor atau email akun terkait" || context === "nomor akun terkait" ? "account number" : "account or order number";
    const topic = /\b(balance|points?)\b.*\b(0|zero)\b|\b(0|zero)\b.*\b(balance|points?)\b/i.test(query) ? "the point balance showing 0" : "this case";
    return `The ${what} has been received as case information. CS can check ${topic} using the steps in the knowledge base before updating the customer.`;
  }
  const label = context === "nomor pesanan terkait"
    ? "nomor pesanan"
    : context === "nomor atau email akun terkait" || context === "nomor akun terkait"
      ? "nomor akun"
      : "akun atau nomor pesanan";
  const issue = /\b(saldo|poin|point)\b.*\b(0|nol|kosong)\b|\b(0|nol|hilang|kosong)\b.*\b(saldo|poin|point)\b/i.test(query)
    ? "saldo poin yang tampil 0"
    : "kasus ini";
  return `Informasi ${label} sudah diterima sebagai info case. CS dapat mengecek ${issue} melalui langkah pada knowledge base sebelum memberi kabar ke customer.`;
}

function knowledgeItems(value: string) {
  return value.split("|").map((item) => item.trim().replace(/^(?:\d+[.)]|[-•])\s*/, "")).filter(Boolean);
}

// A step that only asks CS to collect the account/order number is already done
// once that number was supplied, so it is dropped from next-step guidance.
export function isIdentifierRequestStep(step: string) {
  return /^(?:konfirmasi|minta|tanyakan|kumpulkan|collect|confirm|ask(?:\s+for)?|request)\b.{0,40}\b(?:nomor|akun|pesanan|account|order)\b/i.test(step.trim());
}

function guidanceAnswer(document: KnowledgeDocument, english: boolean) {
  const steps = knowledgeItems(sourceLine(document.content, "Troubleshooting Steps")).filter((step) => !isIdentifierRequestStep(step));
  const escalation = knowledgeItems(sourceLine(document.content, "Escalate When"));
  const list = (items: string[]) => items.map((step, index) => `${index + 1}. ${step}`).join("\n");
  if (english) {
    const body = steps.length ? `Next steps for CS:\n${list(steps)}` : "Next, CS can check the point balance, point history, and related transactions using the knowledge base.";
    return `${body}${escalation.length ? `\n\nEscalate when: ${escalation.join("; ")}.` : ""}\n\nThe supplied information has not been verified; CS must check it manually.`;
  }
  const body = steps.length ? `Langkah selanjutnya untuk CS:\n${list(steps)}` : "Selanjutnya, CS dapat mengecek saldo poin melalui riwayat poin dan transaksi terkait sesuai knowledge base.";
  return `${body}${escalation.length ? `\n\nEskalasi jika: ${escalation.join("; ")}.` : ""}\n\nInformasi yang diberikan belum diverifikasi; CS perlu mengeceknya secara manual.`;
}

export function pointAnswer(
  query: string,
  documents: KnowledgeDocument[],
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  currentDraft = "",
  lang: ResponseLanguage = detectLanguage(query),
): GroundedAnswer | null {
  const intent = classifyConversationIntent(query, history, currentDraft);
  const english = lang === "en";
  const contextQuery = inheritsPriorTopic(query, history)
    ? [...history.filter((message) => message.role === "user").slice(-3).map((message) => message.content), query].join(" ")
    : query;
  const target = pointArticleTitle(contextQuery);
  if (!target) return null;
  const document = selectPointArticle(documents, target)[0];
  if (!document) {
    return {
      intent: "Needs clarification",
      summary: "Knowledge point yang sesuai belum tersedia.",
      missing_context: ["Sumber knowledge untuk topik ini belum tersedia atau belum disinkronkan."],
      recommended_action: "Sinkronkan dan tinjau artikel point terkait di Notion sebelum memberikan jawaban.",
      answer: "Knowledge perusahaan yang sesuai untuk topik ini belum tersedia. Mohon tinjau artikel terkait di Notion sebelum menjawab customer.",
      draft_reply: "",
      citations: [],
      confidence: "low",
      knowledge_gap: true,
    };
  }

  const summary = sourceLine(document.content, "Customer Safe Summary");
  const action = sourceLine(document.content, "Customer Action");
  const reply = sourceLine(document.content, "Customer Reply");
  const explicitContext = sourceLine(document.content, "Required Context");
  const citations = [{ document_id: document.id, title: document.title, url: document.url, quote: document.content }];
  if (!summary || !action) {
    return {
      intent: "Needs clarification",
      summary: "Artikel point belum memiliki ringkasan atau langkah customer-safe yang lengkap.",
      missing_context: ["Artikel knowledge perlu ditinjau dan disinkronkan ulang sebelum customer dijawab."],
      recommended_action: "Tinjau field Customer Safe Summary dan Customer Action pada artikel Notion.",
      answer: "Artikel knowledge untuk topik ini belum lengkap. Mohon tinjau ulang sumber Notion sebelum menjawab customer.",
      draft_reply: "",
      citations,
      confidence: "low",
      knowledge_gap: true,
    };
  }

  const context = requiredContext(action, explicitContext, document.title);
  const rawIdentifier = suppliedIdentifier(query);
  // Only an account number is requested, so an unlabeled number is the account number.
  const accountOnly = context === "nomor akun terkait" || context === "nomor atau email akun terkait";
  const identifier = rawIdentifier?.kind === "unknown" && accountOnly ? { ...rawIdentifier, kind: "account" as const } : rawIdentifier;
  const priorUserMessages = history.filter((message) => message.role === "user");
  const latestPointIndex = [...priorUserMessages].reverse().findIndex((message) => isPointTopic(message.content));
  const currentPointHistory = latestPointIndex === -1
    ? []
    : priorUserMessages.slice(priorUserMessages.length - latestPointIndex - 1);
  const confirmedPriorNumber = isAccountLabelOnly(query)
    ? [...currentPointHistory].reverse().find((message) => {
      const kind = suppliedIdentifier(message.content)?.kind;
      return kind === "unknown" || kind === "account";
    })
    : undefined;
  const identifierIsAmbiguous = Boolean(identifier?.kind === "unknown" && context === "nomor akun atau nomor pesanan terkait");
  // A bare number counts as the account number when only an account is requested, in this turn or earlier ones.
  const contextIdentifier = suppliedIdentifier(contextQuery);
  const bareAccountNumber = contextIdentifier?.kind === "unknown" && accountOnly;
  const missingContext = identifierIsAmbiguous
    ? suppliedIdentifierClarification(context, english)
    : bareAccountNumber ? null : missingContextMessage(context, contextQuery, english ? "en" : "id");
  const missingContextItems = missingContext ? [missingContext] : [];
  const contextWasSupplied = Boolean(identifier && !identifierIsAmbiguous && (identifier !== rawIdentifier || contextSatisfied(context, query)));
  const accountConfirmation = Boolean(confirmedPriorNumber && (context === "nomor atau email akun terkait" || context === "nomor akun atau nomor pesanan terkait" || context === "nomor akun terkait"));
  const orderConfirmation = Boolean(
    isOrderLabelOnly(query) &&
    (context === "nomor pesanan terkait" || context === "nomor akun atau nomor pesanan terkait" || context === "nomor akun terkait") &&
    [...currentPointHistory].reverse().some((message) => suppliedIdentifier(message.content)?.kind === "unknown"),
  );
  const priorContextSatisfied = Boolean(context && contextSatisfied(context, contextQuery));
  if (isSarcasticOrDismissive(query) && currentPointHistory.length > 0) {
    return {
      intent: "Needs clarification",
      summary: "Klarifikasi diperlukan terkait topik poin.",
      missing_context: ["Klarifikasi diperlukan terkait topik yang sedang dibahas."],
      recommended_action: "Minta CS menjelaskan bagian topik poin yang masih kurang jelas atau memastikan apakah ada pertanyaan baru.",
      answer: topicClarification(),
      draft_reply: "",
      citations,
      confidence: "low",
    };
  }
  // Info already supplied earlier in the case ("trus selanjutnya apa?"): answer with the
  // article's next steps instead of repeating the summary. Without supplied info, fall
  // through so the usual "please send the account/order number" flow still applies.
  const contextAlreadyReceived = Boolean(bareAccountNumber || contextWasSupplied || accountConfirmation || orderConfirmation || priorContextSatisfied);
  if (intent === "guidance_follow_up" && contextAlreadyReceived) {
    return {
      intent: "Customer guidance",
      summary,
      missing_context: [],
      recommended_action: action,
      answer: guidanceAnswer(document, english),
      // This is internal CS guidance, not a customer-ready result. Do not surface
      // a draft that could be mistaken for a completed account check.
      draft_reply: "",
      citations,
      confidence: "high",
      verification_status: "not_verified",
    };
  }
  // Customer Action is an internal instruction to the agent, never a reply
  // to send verbatim. Without an explicit Customer Reply field, the app
  // must not invent customer-facing wording from it.
  if (!reply) {
    return {
      intent: "Needs clarification",
      summary,
      missing_context: ["Artikel ini belum memiliki field Customer Reply. Tinjau dan lengkapi di Notion sebelum draft dapat dibuat otomatis."],
      recommended_action: action,
      answer: `${summary}.`,
      draft_reply: "",
      citations,
      confidence: "medium",
      knowledge_gap: true,
    };
  }
  const draft = intent === "draft_regeneration" || intent === "draft_feedback" || intent === "draft_edit"
    ? reviseCustomerDraft(reply, intent, currentDraft)
    : missingContextItems.length
      ? identifierIsAmbiguous ? "" : target !== POINT_ARTICLE_TITLE_MATCHES[0] ? `${reply}.` : english
        ? "Hi, we're sorry for the inconvenience. Some accounts may temporarily display a 0-point balance due to a technical issue. Could you please provide the customer's account number so we can verify the balance?"
        : "Mohon maaf atas ketidaknyamanannya. Beberapa akun dapat menampilkan saldo poin 0 sementara karena kendala teknis. Mohon berikan nomor akun customer agar saldo dapat diverifikasi."
      : suppliedContextReply(reply, context ?? "", contextQuery, lang);
  if (intent === "case_update" && !missingContextItems.length) {
    return {
      intent: "Case update",
      summary,
      missing_context: [],
      recommended_action: action,
      answer: "Hasil cek dicatat sebagai laporan dari CS, belum diverifikasi sistem. Lanjutkan sesuai langkah dan kriteria eskalasi pada knowledge base.",
      draft_reply: "Terima kasih atas informasinya. Kasus ini akan kami tindaklanjuti dan kami kabari perkembangannya.",
      citations,
      confidence: "medium",
    };
  }
  const confirmed = accountConfirmation || orderConfirmation;
  const currentTurnAnswer = identifierIsAmbiguous
    ? suppliedIdentifierClarification(context, english)
    : accountConfirmation
      ? english ? "The account number has been received. CS can check the point balance, point history, and related transactions." : "Nomor tersebut dicatat sebagai nomor akun. Berdasarkan knowledge base, CS dapat mengecek saldo poin melalui riwayat poin dan transaksi terkait."
      : orderConfirmation
        ? english ? "The order number has been received. CS can check the point balance, point history, and related transactions." : "Nomor tersebut dicatat sebagai nomor pesanan. Berdasarkan knowledge base, CS dapat mengecek saldo poin melalui riwayat poin dan transaksi terkait."
        : contextWasSupplied
          ? suppliedContextAnswer(context ?? "", query, lang)
          : `${summary}.`;
  return {
    intent: intent === "guidance_follow_up" ? "Customer guidance" : confirmed || contextWasSupplied ? "Identifier received" : "Point support issue",
    // (guidance_follow_up reaches here only when no info was supplied yet)
    summary,
    missing_context: confirmed ? [] : missingContextItems,
    recommended_action: action,
    answer: currentTurnAnswer,
    draft_reply: accountConfirmation
      ? english ? "Thank you, we have received the account number. We will follow up on the point balance once the case has been reviewed." : "Terima kasih, nomor akun sudah kami terima. Kami akan menindaklanjuti saldo poin setelah kasus ini ditinjau."
      : orderConfirmation
        ? english ? "Thank you, we have received the order number. We will follow up on the point balance once the case has been reviewed." : "Terima kasih, nomor pesanan sudah kami terima. Kami akan menindaklanjuti saldo poin setelah kasus ini ditinjau."
        : draft,
    citations,
    confidence: confirmed || !missingContextItems.length ? "high" : "low",
  };
}

async function search(supabase: ReturnType<typeof getSupabaseAdmin>, query: string): Promise<KnowledgeDocument[]> {
  const result = await supabase.rpc("search_knowledge_documents", { search_query: query, result_limit: 20 });
  if (result.error) throw result.error;
  const documents = (result.data ?? []) as KnowledgeDocument[];
  if (documents.length || query.trim().split(/\s+/).length < 4) return documents;
  // Long customer sentences are too strict when every token must match. Retry
  // with meaningful terms joined by OR; the first search remains preferred for
  // precision, this only prevents a false zero-result retrieval.
  const terms = contentTerms(query).slice(0, 10);
  if (!terms.length) return documents;
  const fallback = await supabase.rpc("search_knowledge_documents", { search_query: terms.join(" OR "), result_limit: 20 });
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as KnowledgeDocument[];
}

export async function retrieveKnowledge(query: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<KnowledgeDocument[]> {
  const supabase = getSupabaseAdmin();
  const priorUserText = history.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ");
  const continuation = continuationSignal(query, history) && Boolean(priorUserText);
  const combinedQuery = continuation ? `${priorUserText} ${query}` : query;
  const pointTarget = pointArticleTitle(combinedQuery);
  const pointTopic = isPointTopic(combinedQuery);
  const scope = resolveProjectScope(query, history);
  if (scope.ambiguous) return [];
  const scopeResults = (documents: KnowledgeDocument[]) => filterDocumentsByProject(documents, scope.project).slice(0, 5);
  const scopedHistory = scope.project ? historyForProject(history, scope.project) : history;
  const scopedPriorUserText = scopedHistory.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ");
  const scopedCombinedQuery = continuation && scopedPriorUserText ? `${scopedPriorUserText} ${query}` : combinedQuery;
  const own = scopeResults(await search(supabase, query));
  if (!pointTopic) {
    // A continuation's raw query ("itu gimana solusinya?") carries no topic
    // keywords of its own — any hit it gets is incidental full-text noise, not
    // a real match. Prefer the history-combined query; only fall back to the
    // raw-query hit if the combined search truly finds nothing.
    if (!continuation) return withoutPointArticles(own);
    const combined = scopeResults(await search(supabase, scopedCombinedQuery));
    return withoutPointArticles(combined.length ? combined : own);
  }

  // Search by the canonical article title as a bounded fallback. This handles
  // Indonesian customer wording even when PostgreSQL full-text ranking cannot
  // match it to the English Notion title.
  const targetResults = pointTarget ? scopeResults(await search(supabase, pointTarget)) : [];
  const direct = selectPointArticle(own, pointTarget);
  const targeted = selectPointArticle(targetResults, pointTarget);
  if (direct.length) return direct;
  if (targeted.length) return targeted;
  if (!continuationSignal(query, history) || !priorUserText) return selectPointArticle(own, null);

  // A bare identifier may not match full-text search, but the previous point
  // question already identifies the article. Retry that user turn before
  // falling back to a generic clarification response.
  const historicalPointQuestion = [...scopedHistory]
    .reverse()
    .find((message) => message.role === "user" && isPointTopic(message.content));
  if (historicalPointQuestion) {
    const historicalPointResults = scopeResults(await search(supabase, historicalPointQuestion.content));
    const historicalPoint = selectPointArticle(historicalPointResults, pointTarget);
    if (historicalPoint.length) return historicalPoint;
  }

  const priorSearch = scopeResults(await search(supabase, scopedCombinedQuery));
  return selectPointArticle(priorSearch, pointTarget);
}

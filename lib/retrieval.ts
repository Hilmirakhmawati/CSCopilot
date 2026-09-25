import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { getSupabaseAdmin } from "./db";

// Short questions or ones that reference something already said ("itu", "nya")
// carry no keywords of their own — only those get to borrow prior context.
// A short topic switch ("Pembayaran saya gagal") still has topic words and
// must not inherit history, or it will keep matching the previous topic.
const followUpWords = new Set(["itu", "nya", "tersebut", "ini", "sebelumnya", "barusan", "masih", "sama", "lagi", "belum", "sudah", "udah", "tetap", "begitu", "gimana", "kenapa", "kok", "ya", "dong", "sih", "aja", "saja"]);

// A bare identifier (order number, account number, email) carries no topic
// keyword of its own — a customer replying "123344555" to "which order?" is
// answering the previous question, not asking a fresh one.
function looksLikeBareIdentifier(word: string) {
  return /^\d{4,}$/.test(word) || /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/.test(word);
}

// Words that only ever label an identifier being supplied ("Nomor pesanannya
// 1234567890"), never a complaint on their own. Combined with an identifier
// elsewhere in the message, they still carry no new topic of their own.
const identifierLabelWords = new Set(["nomor", "no", "id", "pesanan", "pesanannya", "order", "akun", "akunnya", "email"]);

export function continuationSignal(query: string) {
  const normalized = query.toLowerCase();
  const words = normalized.match(/[a-z0-9À-ɏ@.+-]+/g) ?? [];
  if (/\b(itu|nya|tersebut|ini|sebelumnya|barusan)\b/.test(normalized)) return true;
  if (words.length > 0 && words.every((word) => looksLikeBareIdentifier(word) || identifierLabelWords.has(word)) && words.some((word) => looksLikeBareIdentifier(word))) return true;
  return words.length <= 3 && words.every((word) => followUpWords.has(word));
}

// Pleasantries/closers ("oke terima kasih") need no knowledge search at all —
// searching would just reuse whatever the last topic's documents were.
export function isClosingMessage(query: string) {
  const normalized = query.toLowerCase().trim().replace(/[.,!?]/g, "");
  return /^(oke|ok|okay|baik|siap|noted|sip|makasih|terima kasih|thanks|thank you)( terima kasih| makasih| kak| ya)?$/.test(normalized);
}

const greetingRoots = [
  "hi", "hello", "hallo", "halo", "hai", "hey", "helo", "yo", "sup",
  "hola", "ciao", "bonjour", "namaste", "salut", "assalamualaikum", "good", "whats", "up",
];
const greetingFillers = new Set(["kak", "min", "admin", "ya", "nih", "dong", "there", "everyone", "guys"]);
const timeGreetings = new Set(["pagi", "siang", "sore", "malam", "morning", "afternoon", "evening", "night"]);
const greetingStopWords = new Set(["apa", "kabar", "how", "are", "you", "is"]);
const issueWords = /\b(bayar|pembayaran|gagal|error|kenapa|bagaimana|gimana|tolong|help|order|pesanan|akun|refund|masalah|issue|kendala|customer|saldo|poin|point|tidak|bisa|cara|status|cek|check)\b/i;

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

export function isGreetingOnly(query: string) {
  const normalized = normalizeGreeting(query);
  if (!normalized || normalized.length > 48 || issueWords.test(normalized)) return false;
  const tokens = normalized.split(" ");
  if (tokens.length > 6) return false;
  const hasGreeting = tokens.some((token) => resemblesGreetingToken(token) || timeGreetings.has(token));
  if (!hasGreeting) return false;
  return tokens.every((token) => resemblesGreetingToken(token) || timeGreetings.has(token) || greetingFillers.has(token) || greetingStopWords.has(token));
}

export function greetingAnswer(query: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): GroundedAnswer {
  const normalized = query.toLowerCase();
  const english = /\b(hi|hello|hey|good\s+(morning|afternoon|evening)|what(?:'|’)s\s+up)\b/.test(normalized) && !/\b(halo|hai|pagi|siang|sore|malam|selamat|apa\s+kabar)\b/.test(normalized);
  const current = english ? "Hi! 👋" : /\b(pagi|selamat pagi)\b/.test(normalized) ? "Selamat pagi! 👋" : /\b(siang|selamat siang)\b/.test(normalized) ? "Selamat siang! 👋" : /\b(sore|selamat sore)\b/.test(normalized) ? "Selamat sore! 👋" : /\b(malam|selamat malam)\b/.test(normalized) ? "Selamat malam! 👋" : "Halo! 👋";
  const hasTopic = history.some((message) => message.role === "user");
  const answer = hasTopic ? `${current} Kita lanjut bahas topik tadi ya. Ada yang ingin kamu tanyakan lagi?` : english ? `${current} What would you like to know?` : `${current} Ada yang mau kamu tanyakan?`;
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
  if (/\b(riwayat|history|histori)\b/.test(normalized) && /\b(pesanan|order|transaksi)\b/.test(normalized) && /\b(tidak|beda|berbeda|cocok|sesuai|match)\b/.test(normalized) && !/\bpesanan umum\b|\bgeneral order\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[1];
  if (/\b(riwayat|history|histori)\b.*\b(pesanan umum|general order)\b|\b(pesanan umum|general order)\b.*\b(riwayat|history|histori|konsisten|selisih)/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[3];
  if (/\b(riwayat|history|histori)\b.*\b(tidak|beda|berbeda|cocok|sesuai|match|selisih)\b|\b(tidak|beda|berbeda|cocok|sesuai|match|selisih)\b.*\b(riwayat|history|histori)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[1];
  if (/\b(perhitungan|kalkulasi|jumlah)\b.*\b(poin|point)\b|\b(poin|point)\b.*\b(terpakai|digunakan|usage|perhitungan|kalkulasi)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[2];
  if (/\b(audit|periksa ulang|cek ulang|selisih|penyesuaian|sesuaikan)\b.*\b(saldo|poin|point)\b|\b(saldo|poin|point)\b.*\b(audit|periksa ulang|cek ulang|selisih|penyesuaian|sesuaikan)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[4];
  return null;
}

export function isPointTopic(query: string) {
  const normalized = query.toLowerCase();
  return /\b(poin|point)\b/i.test(normalized) || pointArticleTitle(normalized) !== null ||
    (/\b(saldo|balance)\b/.test(normalized) && /\b(0|nol|hilang|kosong)\b/.test(normalized));
}

export function restrictToActivePointArticles(documents: KnowledgeDocument[]) {
  return documents.filter((document) => POINT_ARTICLE_TITLE_MATCHES.some((match) => titleMatches(document.title, match)));
}

function selectPointArticle(documents: KnowledgeDocument[], target: string | null) {
  return target ? documents.filter((document) => titleMatches(document.title, target)) : restrictToActivePointArticles(documents);
}

function sourceLine(content: string, label: string) {
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
function requiredContext(action: string, explicit: string) {
  const value = `${explicit} ${action}`.toLowerCase();
  const hasOrder = /\b(nomor pesanan|nomor order|order id|id pesanan)\b/.test(value);
  const hasAccount = /\b(nomor akun|id akun|email akun)\b/.test(value);
  if (hasOrder && hasAccount) return "nomor akun atau nomor pesanan terkait";
  if (hasOrder) return "nomor pesanan terkait";
  if (hasAccount) return "nomor atau email akun terkait";
  return null;
}

// Must match an actual "please send us the order/account number" request —
// not just any reply containing a polite word like "mohon"/"silakan", which
// could equally appear in a valid customer-facing sentence unrelated to
// asking for an identifier (e.g. "Silakan cek email Anda untuk status...").
function requestsContext(reply: string) {
  return /\b(mohon|silakan|tolong)\b[^.!?]{0,80}\b(kirim|kirimkan|berikan|cantumkan|masukkan)\b[^.!?]{0,40}\b(nomor|akun|pesanan|order|email|id)\b/i.test(reply);
}

function suppliedContextReply(reply: string, context: string, query: string) {
  if (!requestsContext(reply)) return `${reply}.`;
  const label = context === "nomor pesanan terkait"
    ? "nomor pesanan"
    : context === "nomor atau email akun terkait"
      ? "informasi akun"
      : "informasi akun atau nomor pesanan";
  const issue = /\b(saldo|poin|point)\b.*\b(0|nol|kosong)\b|\b(0|nol|kosong)\b.*\b(saldo|poin|point)\b/i.test(query)
    ? "saldo poin yang tampil 0"
    : "kasus ini";
  return `Terima kasih, ${label} sudah kami terima. Tim kami akan memeriksa ${issue} dan memverifikasi data terkait.`;
}

export function pointAnswer(
  query: string,
  documents: KnowledgeDocument[],
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): GroundedAnswer | null {
  const contextQuery = continuationSignal(query)
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

  const context = requiredContext(action, explicitContext);
  const suppliedOrderNumber = /\b\d{6,}\b/.test(contextQuery);
  const suppliedAccountIdentifier = /\b(?:\d{6,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})\b/i.test(contextQuery);
  const contextSatisfied = context === "nomor pesanan terkait"
    ? suppliedOrderNumber
    : context === "nomor atau email akun terkait"
      ? suppliedAccountIdentifier
      : context === "nomor akun atau nomor pesanan terkait"
        ? suppliedAccountIdentifier
        : false;
  const missingContext = context && !contextSatisfied
    ? [`Mohon minta ${context} sebelum kasus ini diverifikasi.`]
    : [];
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
  return {
    intent: "Point support issue",
    summary,
    missing_context: missingContext,
    recommended_action: action,
    answer: `${summary}.`,
    draft_reply: missingContext.length ? "" : suppliedContextReply(reply, context ?? "", contextQuery),
    citations,
    confidence: "high",
  };
}

async function search(supabase: ReturnType<typeof getSupabaseAdmin>, query: string): Promise<KnowledgeDocument[]> {
  const result = await supabase.rpc("search_knowledge_documents", { search_query: query, result_limit: 5 });
  if (result.error) throw result.error;
  return (result.data ?? []) as KnowledgeDocument[];
}

export async function retrieveKnowledge(query: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<KnowledgeDocument[]> {
  const supabase = getSupabaseAdmin();
  const priorUserText = history.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ");
  const continuation = continuationSignal(query) && Boolean(priorUserText);
  const combinedQuery = continuation ? `${priorUserText} ${query}` : query;
  const pointTarget = pointArticleTitle(combinedQuery);
  const pointTopic = isPointTopic(combinedQuery);
  const own = await search(supabase, query);
  if (!pointTopic) {
    if (own.length || !continuationSignal(query) || !priorUserText) return own;
    return search(supabase, combinedQuery);
  }

  // Search by the canonical article title as a bounded fallback. This handles
  // Indonesian customer wording even when PostgreSQL full-text ranking cannot
  // match it to the English Notion title.
  const targetResults = pointTarget ? await search(supabase, pointTarget) : [];
  const direct = selectPointArticle(own, pointTarget);
  const targeted = selectPointArticle(targetResults, pointTarget);
  if (direct.length) return direct;
  if (targeted.length) return targeted;
  if (!continuationSignal(query) || !priorUserText) return restrictToActivePointArticles(own);

  const priorSearch = await search(supabase, combinedQuery);
  return selectPointArticle(priorSearch, pointTarget);
}

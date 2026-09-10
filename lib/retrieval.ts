import type { GroundedAnswer, KnowledgeDocument } from "./assistant-types";
import { getSupabaseAdmin } from "./db";

// Short questions or ones that reference something already said ("itu", "nya")
// carry no keywords of their own — only those get to borrow prior context.
// A topic switch with its own words ("Cari SOP...") must not inherit history,
// or it will keep matching whatever the last topic was.
export function continuationSignal(query: string) {
  const words = query.toLowerCase().match(/[a-z0-9À-ɏ]+/g) ?? [];
  return /\b(itu|nya|tersebut|ini|sebelumnya|barusan)\b/.test(query.toLowerCase()) || words.length <= 3;
}

// Pleasantries/closers ("oke terima kasih") need no knowledge search at all —
// searching would just reuse whatever the last topic's documents were.
export function isClosingMessage(query: string) {
  const normalized = query.toLowerCase().trim().replace(/[.,!?]/g, "");
  return /^(oke|ok|okay|baik|siap|noted|sip|makasih|terima kasih|thanks|thank you)( terima kasih| makasih| kak| ya)?$/.test(normalized);
}

const greetingPattern = /^(hi+|hello+|hallo+|helo+|halo+|hai+|hey+|pagi|siang|sore|malam|selamat\s+(pagi|siang|sore|malam)|good\s+(morning|afternoon|evening)|what(?:'|’)s\s+up|apa\s+kabar)(?:[!,.?\s]*)$/i;

export function isGreetingOnly(query: string) {
  return greetingPattern.test(query.trim());
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
  if (/\b(perhitungan|kalkulasi|jumlah)\b.*\b(poin|point)\b|\b(poin|point)\b.*\b(terpakai|digunakan|usage|perhitungan|kalkulasi)\b/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[2];
  if (/\b(riwayat|history|histori)\b.*\b(pesanan umum|general order)\b|\b(pesanan umum|general order)\b.*\b(riwayat|history|histori|konsisten|selisih)/.test(normalized)) return POINT_ARTICLE_TITLE_MATCHES[3];
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

async function search(supabase: ReturnType<typeof getSupabaseAdmin>, query: string): Promise<KnowledgeDocument[]> {
  const first = await supabase.rpc("search_knowledge_documents", { search_query: query, result_limit: 5 });
  if (first.error) throw first.error;
  if (first.data?.length) return first.data as KnowledgeDocument[];

  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9À-ɏ]+/g) ?? [])]
    .filter((term) => term.length >= 3)
    .slice(0, 3);
  if (!terms.length) return [];
  const results = await Promise.all(terms.map((term) => supabase.rpc("search_knowledge_documents", { search_query: term, result_limit: 5 })));
  const documents = new Map<string, KnowledgeDocument>();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const document of (result.data ?? []) as KnowledgeDocument[]) documents.set(document.id, document);
  }
  return [...documents.values()].slice(0, 5);
}

export async function retrieveKnowledge(query: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<KnowledgeDocument[]> {
  const supabase = getSupabaseAdmin();
  const priorUserText = history.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ");
  const combinedQuery = `${priorUserText} ${query}`;
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

import type { KnowledgeDocument } from "./assistant-types";
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

async function search(supabase: ReturnType<typeof getSupabaseAdmin>, query: string): Promise<KnowledgeDocument[]> {
  const first = await supabase.rpc("search_knowledge_documents", { search_query: query, result_limit: 5 });
  if (first.error) throw first.error;
  if (first.data?.length) return first.data as KnowledgeDocument[];

  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9À-ɏ]+/g) ?? [])].filter((term) => term.length >= 3);
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
  const own = await search(supabase, query);
  if (own.length || !continuationSignal(query)) return own;

  const priorUserText = history.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ");
  if (!priorUserText) return own;
  return search(supabase, `${priorUserText} ${query}`);
}

export function buildKnowledgeContext(documents: KnowledgeDocument[]) {
  return documents.map((doc, index) => `SOURCE ${index + 1}\nID: ${doc.id}\nTITLE: ${doc.title}\nURL: ${doc.url ?? ""}\nCONTENT:\n${doc.content}`).join("\n\n");
}

import type { KnowledgeDocument } from "./assistant-types";
import { getSupabaseAdmin } from "./db";

export async function retrieveKnowledge(query: string): Promise<KnowledgeDocument[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("search_knowledge_documents", { search_query: query, result_limit: 5 });
  if (error) throw error;
  return (data ?? []) as KnowledgeDocument[];
}

export function buildKnowledgeContext(documents: KnowledgeDocument[]) {
  return documents.map((doc, index) => `SOURCE ${index + 1}\nID: ${doc.id}\nTITLE: ${doc.title}\nURL: ${doc.url ?? ""}\nCONTENT:\n${doc.content}`).join("\n\n");
}

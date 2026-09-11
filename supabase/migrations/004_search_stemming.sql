-- knowledge_documents.search_vector used the 'simple' text search config,
-- which does no stemming at all — "refund" never matched "pengembalian dana",
-- "dibatalkan" never matched "batal". Rebuild it as the union of Indonesian
-- and English stemmed vectors (content and customer questions mix both
-- languages) so either language's inflections match.
alter table knowledge_documents drop column search_vector;
alter table knowledge_documents add column search_vector tsvector generated always as (
  to_tsvector('indonesian', coalesce(title, '') || ' ' || coalesce(content, '')) ||
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
) stored;

create index if not exists knowledge_documents_search_idx on knowledge_documents using gin(search_vector);

create or replace function search_knowledge_documents(search_query text, result_limit int default 5)
returns table (id uuid, title text, url text, content text, category text, synced_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.title, d.url, d.content, d.category, d.synced_at
  from knowledge_documents d
  where d.search_vector @@ (websearch_to_tsquery('indonesian', search_query) || websearch_to_tsquery('english', search_query))
  order by ts_rank(d.search_vector, websearch_to_tsquery('indonesian', search_query) || websearch_to_tsquery('english', search_query)) desc
  limit result_limit;
$$;

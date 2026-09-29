-- Keep knowledge cleanup scoped to the source that owns each document.
alter table knowledge_documents
  add column if not exists source text not null default 'notion';

alter table knowledge_documents
  drop constraint if exists knowledge_documents_notion_page_id_key;

alter table knowledge_documents
  add constraint knowledge_documents_source_notion_page_id_key unique (source, notion_page_id);

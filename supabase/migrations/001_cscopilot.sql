create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'support_agent' check (role in ('support_agent', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id),
  title text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text not null unique,
  title text not null,
  url text,
  category text,
  content text not null,
  content_hash text not null,
  last_edited_time timestamptz,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))) stored,
  synced_at timestamptz not null default now()
);
create index if not exists knowledge_documents_search_idx on knowledge_documents using gin(search_vector);
create index if not exists messages_conversation_created_idx on messages (conversation_id, created_at);
create index if not exists conversations_created_by_updated_idx on conversations (created_by, updated_at desc);

create or replace function search_knowledge_documents(search_query text, result_limit int default 5)
returns table (id uuid, title text, url text, content text, category text, synced_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.title, d.url, d.content, d.category, d.synced_at
  from knowledge_documents d
  where d.search_vector @@ websearch_to_tsquery('simple', search_query)
  order by ts_rank(d.search_vector, websearch_to_tsquery('simple', search_query)) desc
  limit result_limit;
$$;

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  source_message_id uuid references messages(id),
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table knowledge_documents enable row level security;
alter table drafts enable row level security;
alter table audit_events enable row level security;

create policy "users read own profile" on profiles for select using (id = auth.uid());
create policy "users manage own conversations" on conversations for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "users read own messages" on messages for select using (exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "users read knowledge" on knowledge_documents for select using (auth.uid() is not null);
create policy "users manage own drafts" on drafts for all using (exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid())) with check (exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "users read own audit" on audit_events for select using (actor_id = auth.uid());

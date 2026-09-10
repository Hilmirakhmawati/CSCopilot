create table if not exists draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  content text not null,
  version integer not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (draft_id, version)
);

create index if not exists draft_versions_draft_created_idx
  on draft_versions (draft_id, created_at desc);

alter table draft_versions enable row level security;

create policy "users read own draft versions" on draft_versions for select
  using (exists (
    select 1 from drafts d
    join conversations c on c.id = d.conversation_id
    where d.id = draft_id and c.created_by = auth.uid()
  ));

-- Context is conversation-scoped. It is intentionally JSON/text rather than a
-- second message stream: history remains the source of truth for raw messages.
alter table conversations add column if not exists context_summary text;
alter table conversations add column if not exists active_context jsonb not null default '{}'::jsonb;
alter table conversations add column if not exists context_updated_at timestamptz;

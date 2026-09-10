-- Lets a duplicate/retried send (same idempotency_key) return the already-
-- generated reply instead of creating a second user turn, and lets the
-- assistant reply be reconstructed for that replay without a full model call.
alter table messages add column if not exists idempotency_key text;
alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;
alter table messages add column if not exists meta jsonb not null default '{}'::jsonb;

alter table conversations add column if not exists idempotency_key text;

create unique index if not exists conversations_created_by_idempotency_key_idx
  on conversations (created_by, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists messages_conversation_idempotency_key_idx
  on messages (conversation_id, idempotency_key, role)
  where idempotency_key is not null;

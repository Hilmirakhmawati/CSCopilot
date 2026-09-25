-- Commit a generated conversation turn atomically after the model response is ready.
-- The function is service-role-only; the API still validates ownership before use.
create or replace function commit_message_turn(
  p_conversation_id uuid,
  p_user_id uuid,
  p_user_message_id uuid,
  p_idempotency_key text,
  p_assistant_content text,
  p_citations jsonb,
  p_active_context jsonb,
  p_context_summary text
)
returns table (assistant_message_id uuid, assistant_created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  new_assistant_id uuid;
  new_created_at timestamptz;
begin
  select created_by into owner_id
  from conversations
  where id = p_conversation_id
  for update;

  if owner_id is null or owner_id <> p_user_id then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;

  -- p_user_message_id must already exist (inserted before the model call);
  -- this only appends the assistant reply and commits context atomically.
  insert into messages (conversation_id, role, content, citations, idempotency_key, reply_to_id)
  select p_conversation_id, 'assistant', p_assistant_content, coalesce(p_citations, '[]'::jsonb), p_idempotency_key, p_user_message_id
  where exists (select 1 from messages where id = p_user_message_id and conversation_id = p_conversation_id)
  returning id, created_at into new_assistant_id, new_created_at;

  if new_assistant_id is null then
    raise exception 'User message not found' using errcode = 'P0002';
  end if;

  update conversations
  set active_context = coalesce(p_active_context, '{}'::jsonb),
      context_summary = p_context_summary,
      context_updated_at = now(),
      updated_at = now()
  where id = p_conversation_id;

  return query select new_assistant_id, new_created_at;
end;
$$;

revoke execute on function commit_message_turn(uuid, uuid, uuid, text, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function commit_message_turn(uuid, uuid, uuid, text, text, jsonb, jsonb, text) to service_role;

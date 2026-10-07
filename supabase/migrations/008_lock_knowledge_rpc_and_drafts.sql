-- Knowledge search is only called by the server with the service-role client.
-- Do not expose the SECURITY DEFINER function through the public Supabase API.
revoke execute on function search_knowledge_documents(text, integer) from public, anon, authenticated;
grant execute on function search_knowledge_documents(text, integer) to service_role;

-- Draft review must go through the server routes, which validate content and
-- write audit events. Authenticated clients may read their own drafts only.
drop policy if exists "users manage own drafts" on drafts;
create policy "users read own drafts" on drafts for select
  using (exists (
    select 1 from conversations c
    where c.id = conversation_id and c.created_by = auth.uid()
  ));

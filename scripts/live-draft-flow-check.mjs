import assert from "node:assert/strict";

const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mainEmail = process.env.MAIN_TEST_EMAIL;
const mainPassword = process.env.MAIN_TEST_PASSWORD;
const qaEmail = process.env.QA_TEST_EMAIL;
const qaPassword = process.env.QA_TEST_PASSWORD;
if (!supabaseUrl || !anonKey || !mainEmail || !mainPassword || !qaEmail || !qaPassword) {
  throw new Error("MAIN_TEST_EMAIL, MAIN_TEST_PASSWORD, QA_TEST_EMAIL, QA_TEST_PASSWORD, and Supabase public env vars are required");
}

async function login(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Login failed for ${email}: ${JSON.stringify(body)}`);
  return body.access_token;
}
async function api(path, init = {}, token) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}
async function json(response) { return response.json().catch(() => ({})); }

const mainToken = await login(mainEmail, mainPassword);
const qaToken = await login(qaEmail, qaPassword);

// 1. Create a conversation to attach the draft to.
const conv = await api("/api/conversations", { method: "POST", body: JSON.stringify({ title: "Draft flow test" }) }, mainToken);
assert.equal(conv.status, 201, `Conversation create failed: ${conv.status}`);
const conversation = await json(conv);

// 2. Create a draft.
const created = await api(`/api/conversations/${conversation.id}/drafts`, { method: "POST", body: JSON.stringify({ content: "Draft v1" }) }, mainToken);
assert.equal(created.status, 201, `Draft create failed: ${created.status}`);
const draft = await json(created);
assert.equal(draft.status, "draft");
assert.equal(draft.content, "Draft v1");

// 3. Edit the draft — must snapshot the previous version.
const edited = await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ content: "Draft v2" }) }, mainToken);
assert.equal(edited.status, 200, `Draft edit failed: ${edited.status}`);
const editedBody = await json(edited);
assert.equal(editedBody.content, "Draft v2");

// 4. History must contain the pre-edit snapshot.
const history = await api(`/api/drafts/${draft.id}/history`, {}, mainToken);
assert.equal(history.status, 200, `Draft history failed: ${history.status}`);
const versions = await json(history);
assert.ok(Array.isArray(versions) && versions.length >= 1, "Expected at least one draft version snapshot");
assert.ok(versions.some((v) => v.content === "Draft v1"), "Pre-edit content 'Draft v1' missing from history");

// 5. QA (not the owner) must not read this draft's history.
const qaHistory = await api(`/api/drafts/${draft.id}/history`, {}, qaToken);
assert.equal(qaHistory.status, 404, `QA should not read another user's draft history, got ${qaHistory.status}`);

// 6. Approve the draft.
const approved = await api(`/api/drafts/${draft.id}/approve`, { method: "POST" }, mainToken);
assert.equal(approved.status, 200, `Approve failed: ${approved.status}`);
const approvedBody = await json(approved);
assert.equal(approvedBody.status, "approved");
assert.equal(approvedBody.external_send, false, "Approve must never claim an external send happened");

// 7. Double-approve / edit-after-approve / reject-after-approve must all be rejected.
const doubleApprove = await api(`/api/drafts/${draft.id}/approve`, { method: "POST" }, mainToken);
assert.equal(doubleApprove.status, 404, `Double approve should 404, got ${doubleApprove.status}`);
const editAfterApprove = await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ content: "Draft v3" }) }, mainToken);
assert.equal(editAfterApprove.status, 404, `Editing an approved draft should 404, got ${editAfterApprove.status}`);
const rejectAfterApprove = await api(`/api/drafts/${draft.id}/reject`, { method: "POST", body: JSON.stringify({}) }, mainToken);
assert.equal(rejectAfterApprove.status, 404, `Rejecting an approved draft should 404, got ${rejectAfterApprove.status}`);

// 8. A separate draft can be rejected cleanly, with a reason recorded.
const created2 = await api(`/api/conversations/${conversation.id}/drafts`, { method: "POST", body: JSON.stringify({ content: "Draft to reject" }) }, mainToken);
assert.equal(created2.status, 201, `Second draft create failed: ${created2.status}`);
const draft2 = await json(created2);
const rejected = await api(`/api/drafts/${draft2.id}/reject`, { method: "POST", body: JSON.stringify({ reason: "Tidak relevan" }) }, mainToken);
assert.equal(rejected.status, 200, `Reject failed: ${rejected.status}`);
const rejectedBody = await json(rejected);
assert.equal(rejectedBody.status, "rejected");

// 9. QA cannot approve/reject drafts they don't own.
const created3 = await api(`/api/conversations/${conversation.id}/drafts`, { method: "POST", body: JSON.stringify({ content: "Draft for QA boundary test" }) }, mainToken);
const draft3 = await json(created3);
const qaApprove = await api(`/api/drafts/${draft3.id}/approve`, { method: "POST" }, qaToken);
assert.equal(qaApprove.status, 404, `QA should not approve another user's draft, got ${qaApprove.status}`);

console.log("live-draft-flow-check passed (create, edit, history, approve, double-approve blocked, reject, cross-user boundary)");

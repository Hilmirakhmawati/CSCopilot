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
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

const mainToken = await login(mainEmail, mainPassword);
const qaToken = await login(qaEmail, qaPassword);
const idempotencyKey = `qa-idempotency-${Date.now()}`;
const first = await api("/api/conversations", {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
  body: JSON.stringify({ title: "Idempotency test", content: "Kenapa saldo poin 0?" }),
}, mainToken);
assert.equal(first.status, 201, `First create failed: ${first.status}`);
const firstBody = await first.json();
assert.ok(firstBody.conversation?.id && firstBody.message_id, "First create missing conversation/message ID");

const retry = await api("/api/conversations", {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
  body: JSON.stringify({ title: "Idempotency test", content: "Kenapa saldo poin 0?" }),
}, mainToken);
assert.equal(retry.status, 201, `Retry failed: ${retry.status}`);
const retryBody = await retry.json();
assert.equal(retryBody.conversation?.id, firstBody.conversation.id, "Retry created a second conversation");
assert.equal(retryBody.message_id, firstBody.message_id, "Retry created a second assistant message");

const forbiddenRead = await api(`/api/conversations/${firstBody.conversation.id}/messages`, {}, qaToken);
assert.equal(forbiddenRead.status, 404, `QA should not read main user's conversation, got ${forbiddenRead.status}`);

console.log("live-isolation-idempotency-check passed");
console.log(`Verified private conversation: ${firstBody.conversation.id}`);

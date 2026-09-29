import assert from "node:assert/strict";

const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";
const email = process.env.QA_TEST_EMAIL;
const password = process.env.QA_TEST_PASSWORD;
if (!email || !password) throw new Error("QA_TEST_EMAIL and QA_TEST_PASSWORD are required in .env.local");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) throw new Error("Supabase public environment is not configured");

async function login() {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `QA login failed: ${JSON.stringify(body)}`);
  assert.ok(body.access_token, "QA login returned no access token");
  return body.access_token;
}

async function api(path, init = {}, token) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

const token = await login();
const admin = await api("/api/admin/audit", {}, token);
assert.equal(admin.status, 403, `QA user should get 403 from admin route, got ${admin.status}`);
const adminBody = await admin.json().catch(() => ({}));
assert.equal(adminBody.error, "Admin access required");

const key = `qa-live-${Date.now()}`;
const created = await api("/api/conversations", {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": key },
  body: JSON.stringify({ title: "QA isolation test" }),
}, token);
assert.equal(created.status, 201, `QA conversation creation failed: ${created.status}`);
const conversation = await created.json();
assert.ok(conversation.id, "QA conversation returned no ID");

const own = await api(`/api/conversations/${conversation.id}/messages`, {}, token);
assert.equal(own.status, 200, `QA user cannot read own conversation: ${own.status}`);

const missing = await api("/api/conversations/00000000-0000-4000-8000-000000000000/messages", {}, token);
assert.equal(missing.status, 404, `Unknown conversation should return 404, got ${missing.status}`);

// Regression: invalid content must be rejected before any conversation row
// is written — no orphan conversation left behind.
const beforeList = await api("/api/conversations", {}, token);
const beforeCount = (await beforeList.json()).length;
const invalidContent = await api("/api/conversations", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title: "Should not be created", content: "   " }),
}, token);
assert.equal(invalidContent.status, 400, `Empty content should 400, got ${invalidContent.status}`);
const afterList = await api("/api/conversations", {}, token);
const afterCount = (await afterList.json()).length;
assert.equal(afterCount, beforeCount, "Invalid content left an orphan conversation");

for (const body of ["{not valid json", "null", "[]"]) {
  const malformed = await api("/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }, token);
  assert.equal(malformed.status, 400, `Invalid conversation JSON should 400, got ${malformed.status}`);
}
const finalList = await api("/api/conversations", {}, token);
assert.equal((await finalList.json()).length, beforeCount, "Invalid JSON/body shape left an orphan conversation");

console.log("live-security-check passed (QA login, 403 admin, ownership boundary)");
console.log(`Created QA conversation: ${conversation.id}`);

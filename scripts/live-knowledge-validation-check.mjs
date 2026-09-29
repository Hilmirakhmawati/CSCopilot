import assert from "node:assert/strict";

const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const qaEmail = process.env.QA_TEST_EMAIL;
const qaPassword = process.env.QA_TEST_PASSWORD;
if (!supabaseUrl || !anonKey || !qaEmail || !qaPassword) {
  throw new Error("QA_TEST_EMAIL, QA_TEST_PASSWORD, and Supabase public env vars are required");
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
async function json(response) { return response.json().catch(() => ({})); }

const token = await login(qaEmail, qaPassword);

// 1. Knowledge list must be readable by any authenticated user.
const list = await api("/api/knowledge", {}, token);
assert.equal(list.status, 200, `Knowledge list failed: ${list.status}`);
const documents = await json(list);
assert.ok(Array.isArray(documents), "Knowledge list should be an array");

// 2. A valid document ID (if any exist) routes to its detail correctly.
if (documents.length > 0) {
  const detail = await api(`/api/knowledge/${documents[0].id}`, {}, token);
  assert.equal(detail.status, 200, `Known knowledge detail failed: ${detail.status}`);
  const detailBody = await json(detail);
  assert.equal(detailBody.id, documents[0].id);
} else {
  console.warn("No knowledge documents synced yet — skipping detail-routing assertion");
}

// 3. An unknown/garbage ID must 404, not 500 or leak a raw DB error.
const missing = await api("/api/knowledge/00000000-0000-4000-8000-000000000000", {}, token);
assert.equal(missing.status, 404, `Unknown knowledge ID should 404, got ${missing.status}`);
const missingBody = await json(missing);
assert.equal(missingBody.error, "Resource not found");

// 4. Malformed JSON body must map to 400 on routes that use readJson().
const malformedDraft = await api("/api/conversations/00000000-0000-4000-8000-000000000000/drafts", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{not valid json",
}, token);
assert.equal(malformedDraft.status, 400, `Malformed JSON should 400, got ${malformedDraft.status}`);
const malformedBody = await json(malformedDraft);
assert.equal(malformedBody.error, "Invalid JSON body");

const malformedMessage = await api("/api/conversations/00000000-0000-4000-8000-000000000000/messages", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{not valid json",
}, token);
assert.equal(malformedMessage.status, 400, `Malformed JSON should 400, got ${malformedMessage.status}`);

// 5. /api/health never leaks a secret-shaped value.
const health = await fetch(`${base}/api/health`);
const healthBody = await json(health);
assert.ok([200, 503].includes(health.status), `/api/health should return 200 or 503, got ${health.status}`);
assert.equal(JSON.stringify(healthBody).match(/sk-|eyJ|service_role/i), null, "/api/health leaked what looks like a secret");

console.log("live-knowledge-validation-check passed (knowledge routing, 404 boundary, malformed JSON -> 400, health)");

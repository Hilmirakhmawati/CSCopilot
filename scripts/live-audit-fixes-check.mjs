import assert from "node:assert/strict";

const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mainEmail = process.env.MAIN_TEST_EMAIL;
const mainPassword = process.env.MAIN_TEST_PASSWORD;
if (!supabaseUrl || !anonKey || !mainEmail || !mainPassword) throw new Error("MAIN_TEST_* and Supabase public env vars are required");

async function login(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, `Login failed: ${JSON.stringify(body)}`);
  return body.access_token;
}
const token = await login(mainEmail, mainPassword);
const api = (path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init.headers } });
const json = (r) => r.json().catch(() => ({}));

// 1. Concurrent draft edits must never 500 (unique(draft_id, version) race).
const conv = await json(await api("/api/conversations", { method: "POST", body: JSON.stringify({ title: "Audit fixes test" }) }));
const draft = await json(await api(`/api/conversations/${conv.id}/drafts`, { method: "POST", body: JSON.stringify({ content: "c0" }) }));
const results = await Promise.all([1, 2, 3, 4].map((i) => api(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ content: `c${i}` }) })));
const statuses = results.map((r) => r.status);
console.log("concurrent PATCH statuses:", statuses.join(","));
assert.ok(statuses.every((s) => s !== 500), `Concurrent PATCH produced a 500: ${statuses}`);
assert.ok(statuses.includes(200), "At least one concurrent PATCH should succeed");

// 2. Edit after approve must 404.
assert.equal((await api(`/api/drafts/${draft.id}/approve`, { method: "POST" })).status, 200);
assert.equal((await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ content: "late" }) })).status, 404);

// 3. Sync with JSON `null` body must not be a TypeError 500 (403 for non-admin is fine).
const sync = await api("/api/admin/notion/sync", { method: "POST", body: "null" });
const syncBody = await json(sync);
console.log("sync null body:", sync.status, JSON.stringify(syncBody).slice(0, 120));
assert.ok(!/TypeError|Cannot read properties/i.test(JSON.stringify(syncBody)), "Sync leaked a TypeError");

// 4. Cleanup the test conversation (cascades to drafts).
assert.equal((await api(`/api/conversations/${conv.id}`, { method: "DELETE" })).status, 200);

console.log("live-audit-fixes-check passed");

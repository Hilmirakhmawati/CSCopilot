// Run against a locally running dev server: npx tsx lib/security-check.ts
// (defaults to http://localhost:3000, matches the standing dev port).
//
// Checks the auth boundary that doesn't need a specific test user: every
// protected route rejects unauthenticated requests with 401 and a stable
// public error message (never a raw Supabase/Postgres/Anthropic string).
//
// NOT covered here (needs a real second, non-admin Supabase user, which
// this script can't create): log in as a non-admin, call
// POST /api/admin/notion/sync with that user's token, expect 403
// "Admin access required". Run that manually after rotation/deploy.
import assert from "node:assert/strict";

const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";

async function expectUnauthenticated(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, init);
  assert.equal(res.status, 401, `${path} should return 401, got ${res.status}`);
  const body = await res.json().catch(() => ({}));
  assert.equal(body.error, "Authentication required", `${path} leaked non-public error: ${JSON.stringify(body)}`);
}

async function expectRejectedCron(headers?: Record<string, string>) {
  const res = await fetch(`${base}/api/cron/notion-sync`, { method: "POST", headers });
  assert.notEqual(res.status, 200, "cron endpoint should reject a missing/wrong secret");
}

async function main() {
  await expectUnauthenticated("/api/conversations");
  await expectUnauthenticated("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  await expectUnauthenticated("/api/admin/notion/sync", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  await expectUnauthenticated("/api/conversations/00000000-0000-4000-8000-000000000000/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: "test" }),
  });

  await expectRejectedCron();
  await expectRejectedCron({ "x-cron-secret": "wrong-secret" });

  const health = await fetch(`${base}/api/health`);
  const healthBody = await health.json().catch(() => ({}));
  assert.ok([200, 503].includes(health.status), `/api/health should return 200 or 503, got ${health.status}`);
  assert.equal(JSON.stringify(healthBody).match(/sk-|eyJ|service_role/i), null, "/api/health leaked what looks like a secret");

  console.log("security-check passed (401/cron/health boundary). Remember to manually verify the 403 non-admin case.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

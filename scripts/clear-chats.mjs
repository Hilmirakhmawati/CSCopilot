// Deletes ALL chats of one account via the app API (so ownership checks apply).
// Default is dry-run. Pass --delete to actually delete (permanent).
// Account: ACCOUNT=MAIN (default) or ACCOUNT=QA, read from MAIN_TEST_* / QA_TEST_* in .env.local.
// Usage: node --env-file=.env.local scripts/clear-chats.mjs [--delete]
const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";
const prefix = process.env.ACCOUNT === "QA" ? "QA_TEST" : "MAIN_TEST";
const email = process.env[`${prefix}_EMAIL`];
const password = process.env[`${prefix}_PASSWORD`];
if (!email || !password) throw new Error(`${prefix}_EMAIL / ${prefix}_PASSWORD missing in .env.local`);

const login = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const token = (await login.json()).access_token;
if (!token) throw new Error("Login failed");
const headers = { authorization: `Bearer ${token}` };

const res = await fetch(`${base}/api/conversations`, { headers });
const chats = await res.json();
if (!Array.isArray(chats)) throw new Error(`List failed: ${res.status} ${JSON.stringify(chats)}`);

const [name, domain] = email.split("@");
console.log(`account: ${name.slice(0, 2)}***@${domain}`);
console.log(`chats: ${chats.length}`);
const byTitle = new Map();
for (const c of chats) byTitle.set(c.title, (byTitle.get(c.title) ?? 0) + 1);
for (const [title, n] of byTitle) console.log(`- ${n}x ${title}`);
const dates = chats.map((c) => c.updated_at ?? c.created_at).sort();
if (dates.length) console.log(`range: ${dates[0].slice(0, 10)} .. ${dates.at(-1).slice(0, 10)}`);

if (!process.argv.includes("--delete")) {
  console.log("dry-run only, nothing deleted. Re-run with --delete to remove.");
  process.exit(0);
}
let ok = 0;
for (const c of chats) {
  const r = await fetch(`${base}/api/conversations/${c.id}`, { method: "DELETE", headers });
  if (r.ok) ok++;
  else console.log("failed", c.id, r.status);
}
console.log(`deleted ${ok}/${chats.length}`);

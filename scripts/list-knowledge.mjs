// Read-only: list synced knowledge titles as the QA user.
const base = process.env.SECURITY_CHECK_BASE_URL || "http://localhost:3000";
const login = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "content-type": "application/json" },
  body: JSON.stringify({ email: process.env.QA_TEST_EMAIL, password: process.env.QA_TEST_PASSWORD }),
});
const token = (await login.json()).access_token;
const res = await fetch(`${base}/api/knowledge`, { headers: { authorization: `Bearer ${token}` } });
const docs = await res.json();
console.log("status", res.status, "count", Array.isArray(docs) ? docs.length : docs);
if (Array.isArray(docs)) for (const d of docs) console.log("-", d.title);

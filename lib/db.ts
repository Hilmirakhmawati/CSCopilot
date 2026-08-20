import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getSupabaseAdmin() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getSupabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase public environment is not configured");
  return createClient(url, anonKey);
}

export function getSupabaseUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const client = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
  return client.auth.getUser();
}

export async function requireUser(request: Request) {
  const { data, error } = await getSupabaseUser(request);
  if (data.user) return data.user;
  if (process.env.DEMO_USER_ID) return { id: process.env.DEMO_USER_ID, email: "demo@internal" };
  throw new Error(error?.message || "Authentication required");
}

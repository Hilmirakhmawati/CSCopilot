import { getSupabaseAdmin } from "@/lib/db";

export async function GET() {
  const checks = {
    supabase: false,
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) || process.env.CSCOPILOT_NO_AI === "1",
    notion: Boolean(process.env.NOTION_TOKEN?.trim() && process.env.NOTION_ROOT_PAGE_ID?.trim()),
  };
  try {
    const { error } = await getSupabaseAdmin().from("knowledge_documents").select("id", { count: "exact", head: true });
    checks.supabase = !error;
  } catch { checks.supabase = false; }
  const healthy = checks.supabase && checks.anthropic && checks.notion;
  return Response.json({ status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

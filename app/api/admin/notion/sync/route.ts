import { createHash } from "node:crypto";
import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { readNotionPage } from "@/lib/notion";
import { errorResponse, readText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!process.env.DEMO_USER_ID && !user.email?.endsWith("@timedoor.net")) throw new Error("Admin access required");
    const body = await request.json().catch(() => ({}));
    const pageId = readText(body.page_id ?? process.env.NOTION_ROOT_PAGE_ID, "page_id", 100);
    const page = await readNotionPage(pageId);
    const contentHash = createHash("sha256").update(page.content).digest("hex");
    const db = getSupabaseAdmin();
    const existing = await db.from("knowledge_documents").select("id,content_hash").eq("notion_page_id", page.notion_page_id).maybeSingle();
    let action: "inserted" | "updated" | "unchanged" = "inserted";
    if (existing.data?.content_hash === contentHash) action = "unchanged";
    else if (existing.data) action = "updated";
    if (action !== "unchanged") {
      const { error } = await db.from("knowledge_documents").upsert({ notion_page_id: page.notion_page_id, title: page.title, url: page.url, content: page.content, content_hash: contentHash, last_edited_time: page.last_edited_time, synced_at: new Date().toISOString() }, { onConflict: "notion_page_id" });
      if (error) throw error;
    }
    await db.from("audit_events").insert({ actor_id: user.id, entity_type: "knowledge_document", entity_id: existing.data?.id ?? null, action: `sync_${action}` });
    return Response.json({ action, title: page.title });
  } catch (error) { return errorResponse(error); }
}

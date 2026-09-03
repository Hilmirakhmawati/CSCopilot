import { createHash } from "node:crypto";
import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { readChatbotAllowedDatabaseRows, findChildDatabaseId } from "@/lib/notion";
import { errorResponse, readText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!process.env.DEMO_USER_ID && !user.email?.endsWith("@timedoor.net")) throw new Error("Admin access required");
    const body = await request.json().catch(() => ({}));
    const rootPageId = readText(body.page_id ?? process.env.NOTION_ROOT_PAGE_ID, "page_id", 100);
    const databaseTitle = "Maintenance Task Testing";
    const databaseId = await findChildDatabaseId(rootPageId, databaseTitle);
    if (!databaseId) throw new Error(`Database "${databaseTitle}" not found under the root page`);
    const rows = await readChatbotAllowedDatabaseRows(databaseId);
    const db = getSupabaseAdmin();
    const results: { title: string; action: string }[] = [];
    for (const row of rows) {
      const contentHash = createHash("sha256").update(row.content).digest("hex");
      const existing = await db.from("knowledge_documents").select("id,content_hash").eq("notion_page_id", row.notion_page_id).maybeSingle();
      let action: "inserted" | "updated" | "unchanged" = "inserted";
      if (existing.data?.content_hash === contentHash) action = "unchanged";
      else if (existing.data) action = "updated";
      if (action !== "unchanged") {
        const { error } = await db.from("knowledge_documents").upsert({ notion_page_id: row.notion_page_id, title: row.title, url: row.url, content: row.content, content_hash: contentHash, last_edited_time: row.last_edited_time, synced_at: new Date().toISOString() }, { onConflict: "notion_page_id" });
        if (error) throw error;
      }
      results.push({ title: row.title, action });
    }
    await db.from("audit_events").insert({ actor_id: user.id, entity_type: "knowledge_document", entity_id: null, action: `sync_${results.length}_rows` });
    return Response.json({ action: "completed", synced: results.length, results });
  } catch (error) { return errorResponse(error); }
}

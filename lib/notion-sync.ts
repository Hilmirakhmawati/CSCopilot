import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./db";
import { readChatbotAllowedDatabaseRows, findChildDatabaseId } from "./notion";

const DATABASE_TITLE = "Maintenance Task Testing";

// Shared by the manual admin route and the optional scheduled timer so both
// callers run the exact same sync + safety rules (never wipe rows on an
// empty/failed Notion read; delete stale rows only after a successful,
// non-empty read).
export async function syncNotionKnowledge({ pageId, actorId, actionPrefix }: { pageId: string; actorId: string | null; actionPrefix: string }) {
  const databaseId = await findChildDatabaseId(pageId, DATABASE_TITLE);
  if (!databaseId) throw new Error(`Database "${DATABASE_TITLE}" not found under the root page`);
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
  if (rows.length > 0) {
    const notionIds = rows.map((row) => `"${row.notion_page_id.replace(/"/g, '\\"')}"`);
    const stale = await db.from("knowledge_documents").delete().not("notion_page_id", "in", `(${notionIds.join(",")})`);
    if (stale.error) throw stale.error;
  }
  const audit = await db.from("audit_events").insert({ actor_id: actorId, entity_type: "knowledge_document", entity_id: null, action: `${actionPrefix}_${results.length}_rows` });
  if (audit.error) throw audit.error;
  return { synced: results.length, results };
}

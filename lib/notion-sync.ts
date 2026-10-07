import { getSupabaseAdmin } from "./db";
import { readChatbotAllowedDatabaseRows, findChildDatabaseId } from "./notion";
import { logAuditFailure } from "./validation";

// Web Crypto (not Node's `crypto` module) so this file has no Node-builtin
// import — instrumentation.ts dynamically imports it, and Next bundles
// that dynamic import for the edge runtime too, where Node builtins
// (including "node:crypto"/"crypto") don't resolve.
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const DATABASE_TITLE = "Maintenance Task Testing";

// Shared by the manual admin route and the optional scheduled timer so both
// callers run the exact same sync + safety rules (never touch rows on a
// failed Notion read — errors above throw before cleanup runs; a successful
// read, even an empty one, is authoritative and cleanup follows it).
export async function syncNotionKnowledge({ pageId, actorId, actionPrefix }: { pageId: string; actorId: string | null; actionPrefix: string }) {
  const startedAt = Date.now();
  const databaseId = await findChildDatabaseId(pageId, DATABASE_TITLE);
  if (!databaseId) throw new Error(`Database "${DATABASE_TITLE}" not found under the root page`);
  const rows = await readChatbotAllowedDatabaseRows(databaseId);
  // A transient or revoked Notion read can look like "zero allowed rows";
  // deleting all knowledge on that signal is unrecoverable, so refuse.
  if (rows.length === 0) throw new Error("Notion returned zero allowed rows; refusing to delete existing knowledge");
  const db = getSupabaseAdmin();
  const results: { title: string; action: string }[] = [];
  for (const row of rows) {
    // Title and url are synced columns too; hashing content alone left a
    // renamed page looking "unchanged" forever.
    const contentHash = await sha256Hex(JSON.stringify([row.title, row.url, row.category, row.content, row.last_edited_time]));
    const existing = await db.from("knowledge_documents").select("id,content_hash").eq("source", "notion").eq("notion_page_id", row.notion_page_id).maybeSingle();
    // A failed read must not fall through to "inserted" and rewrite the row.
    if (existing.error) throw existing.error;
    let action: "inserted" | "updated" | "unchanged" = "inserted";
    if (existing.data?.content_hash === contentHash) action = "unchanged";
    else if (existing.data) action = "updated";
    if (action !== "unchanged") {
      const { error } = await db.from("knowledge_documents").upsert({ source: "notion", notion_page_id: row.notion_page_id, title: row.title, url: row.url, category: row.category, content: row.content, content_hash: contentHash, last_edited_time: row.last_edited_time, synced_at: new Date().toISOString() }, { onConflict: "source,notion_page_id" });
      if (error) throw error;
    }
    results.push({ title: row.title, action });
  }
  // Scope cleanup to Notion-sourced rows only — never touch rows from other
  // sources — and only remove the ones missing from this (non-empty) read.
  const stale = await db.from("knowledge_documents").delete().eq("source", "notion").not("notion_page_id", "in", `(${rows.map((row) => `"${row.notion_page_id.replace(/"/g, '\\"')}"`).join(",")})`);
  if (stale.error) throw stale.error;
  const audit = await db.from("audit_events").insert({ actor_id: actorId, entity_type: "knowledge_document", entity_id: null, action: `${actionPrefix}_${results.length}_rows`, metadata: { duration_ms: Date.now() - startedAt, rows: results.length, trigger: actionPrefix.includes("scheduled") ? "scheduled" : "manual" } });
  // The sync already succeeded; a failed audit write must not turn it into a 500.
  if (audit.error) logAuditFailure("notion sync", audit.error);
  return { synced: results.length, results };
}

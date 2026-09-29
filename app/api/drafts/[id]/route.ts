import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse, logAuditFailure, readJson, readText } from "@/lib/validation";
import { enforceRateLimit, requestKey } from "@/lib/rate-limit";

const MAX_VERSIONS = 20;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    enforceRateLimit(requestKey(request, user.id));
    const { id } = await params;
    const body = await readJson(request);
    const content = readText(body.content);
    const restoredFromVersion = Number.isInteger(body.restored_from_version) ? body.restored_from_version : null;
    const db = getSupabaseAdmin();
    const draft = await db.from("drafts").select("id,conversation_id,content").eq("id", id).single();
    if (draft.error) throw new Error("Draft not found or already reviewed");
    const owner = await db.from("conversations").select("id").eq("id", draft.data.conversation_id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Draft not found or already reviewed");
    // Snapshot the previous content before overwriting, so edits are never
    // destructive. If the snapshot insert fails, the update must not proceed.
    if (draft.data.content !== content) {
      const count = await db.from("draft_versions").select("version").eq("draft_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (count.error) throw count.error;
      const nextVersion = (count.data?.version ?? 0) + 1;
      const snapshot = await db.from("draft_versions").insert({ draft_id: id, content: draft.data.content, version: nextVersion, created_by: user.id });
      if (snapshot.error) throw snapshot.error;
      // Keep only the most recent MAX_VERSIONS snapshots — unbounded history
      // would otherwise grow the table forever.
      const prune = await db.from("draft_versions").delete().eq("draft_id", id).lte("version", nextVersion - MAX_VERSIONS);
      if (prune.error) throw prune.error;
    }
    const { data, error } = await db.from("drafts").update({ content, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("*").single();
    if (error || !data) throw new Error("Draft not found or already reviewed");
    const audit = await db.from("audit_events").insert({ actor_id: user.id, entity_type: "draft", entity_id: id, action: "edited", metadata: restoredFromVersion ? { restored_from_version: restoredFromVersion } : {} });
    if (audit.error) logAuditFailure("draft edited", audit.error);
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}

import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse, readText } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const content = readText((await request.json()).content);
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
      const snapshot = await db.from("draft_versions").insert({ draft_id: id, content: draft.data.content, version: (count.data?.version ?? 0) + 1, created_by: user.id });
      if (snapshot.error) throw snapshot.error;
    }
    const { data, error } = await db.from("drafts").update({ content, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("*").single();
    if (error || !data) throw new Error("Draft not found or already reviewed");
    const audit = await db.from("audit_events").insert({ actor_id: user.id, entity_type: "draft", entity_id: id, action: "edited" });
    if (audit.error) throw audit.error;
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}

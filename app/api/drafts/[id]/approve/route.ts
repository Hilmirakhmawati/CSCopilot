import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const db = getSupabaseAdmin();
    const draft = await db.from("drafts").select("id,conversation_id").eq("id", id).single();
    if (draft.error) throw new Error("Draft not found or already reviewed");
    const owner = await db.from("conversations").select("id").eq("id", draft.data.conversation_id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Draft not found or already reviewed");
    const { data, error } = await db.from("drafts").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("*").single();
    if (error || !data) throw new Error("Draft not found or already reviewed");
    const audit = await db.from("audit_events").insert({ actor_id: user.id, entity_type: "draft", entity_id: id, action: "approved", metadata: { external_send: false } });
    if (audit.error) throw audit.error;
    return Response.json({ ...data, external_send: false });
  } catch (error) { return errorResponse(error); }
}

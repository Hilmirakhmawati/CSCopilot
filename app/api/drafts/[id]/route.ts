import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse, readText } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const content = readText((await request.json()).content);
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("drafts").update({ content, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("*").single();
    if (error || !data) throw new Error("Draft not found or already reviewed");
    await db.from("audit_events").insert({ actor_id: user.id, entity_type: "draft", entity_id: id, action: "edited" });
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}

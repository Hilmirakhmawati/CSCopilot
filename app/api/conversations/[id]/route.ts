import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const db = getSupabaseAdmin();
    const owner = await db.from("conversations").select("id").eq("id", id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Conversation not found");
    const { error } = await db.from("conversations").delete().eq("id", id).eq("created_by", user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

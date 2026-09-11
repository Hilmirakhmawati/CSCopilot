import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const db = getSupabaseAdmin();
    const draft = await db.from("drafts").select("id,conversation_id").eq("id", id).single();
    if (draft.error) throw new Error("Draft not found");
    const owner = await db.from("conversations").select("id").eq("id", draft.data.conversation_id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Draft not found");
    const { data, error } = await db.from("draft_versions").select("id,draft_id,content,version,created_by,created_at").eq("draft_id", id).order("version", { ascending: false }).limit(20);
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) { return errorResponse(error); }
}

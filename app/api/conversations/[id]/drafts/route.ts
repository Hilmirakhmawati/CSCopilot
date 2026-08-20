import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse, readText } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = await request.json();
    const content = readText(body.content);
    const db = getSupabaseAdmin();
    const owner = await db.from("conversations").select("id").eq("id", id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Conversation not found");
    const { data, error } = await db.from("drafts").insert({ conversation_id: id, source_message_id: body.source_message_id ?? null, content }).select("*").single();
    if (error) throw error;
    await db.from("audit_events").insert({ actor_id: user.id, entity_type: "draft", entity_id: data.id, action: "created" });
    return Response.json(data, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { processConversationMessage } from "@/lib/message-processing";
import { errorResponse, readJson, readText } from "@/lib/validation";
import { enforceRateLimit, requestKey } from "@/lib/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const db = getSupabaseAdmin();
    const owner = await db.from("conversations").select("id").eq("id", id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Conversation not found");
    const { data, error } = await db
      .from("messages")
      .select("id,role,content,citations,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    enforceRateLimit(requestKey(request, user.id));
    const { id } = await params;
    const issue = readText((await readJson(request)).content);
    const idempotencyKey = request.headers.get("Idempotency-Key") || undefined;
    const result = await processConversationMessage(getSupabaseAdmin(), id, user.id, issue, idempotencyKey);
    return Response.json(result);
  } catch (error) { return errorResponse(error); }
}
import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { processConversationMessage, idempotencyReady } from "@/lib/message-processing";
import { errorResponse, readText } from "@/lib/validation";
import { enforceRateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    enforceRateLimit(requestKey(request, user.id));
    const body = await request.json().catch(() => ({}));
    const db = getSupabaseAdmin();
    const { error: profileError } = await db.from("profiles").upsert({ id: user.id, email: user.email ?? `${user.id}@internal` }, { onConflict: "id" });
    if (profileError) throw profileError;
    const title = body.title === undefined || body.title === null || body.title === "" ? "New support case" : readText(body.title, "title", 120);
    const rawKey = request.headers.get("Idempotency-Key") || undefined;
    const idempotencyKey = rawKey && (await idempotencyReady(db)) ? rawKey : undefined;
    if (idempotencyKey) {
      const existing = await db.from("conversations").select("id,title,status,created_at").eq("created_by", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        if (body.content === undefined) return Response.json(existing.data, { status: 201 });
        const result = await processConversationMessage(db, existing.data.id, user.id, readText(body.content), idempotencyKey);
        return Response.json({ conversation: existing.data, ...result }, { status: 201 });
      }
    }
    const { data, error } = await db.from("conversations").insert(idempotencyKey
      ? { created_by: user.id, title, idempotency_key: idempotencyKey }
      : { created_by: user.id, title }).select("id,title,status,created_at").single();
    if (error) throw error;
    if (body.content !== undefined) {
      const content = readText(body.content);
      const result = await processConversationMessage(db, data.id, user.id, content, idempotencyKey);
      return Response.json({ conversation: data, ...result }, { status: 201 });
    }
    return Response.json(data, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { data, error } = await getSupabaseAdmin().from("conversations").select("id,title,status,created_at,updated_at").eq("created_by", user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) { return errorResponse(error); }
}

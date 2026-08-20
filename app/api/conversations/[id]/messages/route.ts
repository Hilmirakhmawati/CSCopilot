import { generateGroundedAnswer } from "@/lib/anthropic";
import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { retrieveKnowledge } from "@/lib/retrieval";
import { errorResponse, readText } from "@/lib/validation";
import { validateCitations } from "@/lib/assistant-check";

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
    const { id } = await params;
    const issue = readText((await request.json()).content);
    const db = getSupabaseAdmin();
    const owner = await db.from("conversations").select("id").eq("id", id).eq("created_by", user.id).single();
    if (owner.error) throw new Error("Conversation not found");
    const input = await db.from("messages").insert({ conversation_id: id, role: "user", content: issue }).select("id").single();
    if (input.error) throw input.error;
    const documents = await retrieveKnowledge(issue);
    const answer = await generateGroundedAnswer(issue, documents);
    answer.citations = validateCitations(answer.citations ?? [], new Set(documents.map((doc) => doc.id)));
    const output = await db.from("messages").insert({ conversation_id: id, role: "assistant", content: answer.answer, citations: answer.citations }).select("id,content,citations,created_at").single();
    if (output.error) throw output.error;
    await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ ...answer, message_id: output.data.id, sources: documents });
  } catch (error) { return errorResponse(error); }
}

import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin()
      .from("knowledge_documents")
      .select("id,title,url,category,content,synced_at")
      .eq("id", id)
      .single();
    if (error || !data) throw new Error("Knowledge document not found");
    return Response.json(data);
  } catch (error) { return errorResponse(error); }
}

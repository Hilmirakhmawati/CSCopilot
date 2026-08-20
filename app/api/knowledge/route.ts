import { getSupabaseAdmin, requireUser } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const { data, error } = await getSupabaseAdmin().from("knowledge_documents").select("id,title,url,category,content,synced_at").order("title");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) { return errorResponse(error); }
}

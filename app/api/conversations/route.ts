import { requireUser, getSupabaseAdmin } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("conversations").insert({ created_by: user.id, title: body.title ?? "New support case" }).select("id,title,status,created_at").single();
    if (error) throw error;
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

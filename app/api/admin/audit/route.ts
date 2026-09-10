import { requireAdmin, getSupabaseAdmin } from "@/lib/db";
import { errorResponse } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 50;
    const { data, error } = await getSupabaseAdmin()
      .from("audit_events")
      .select("id,entity_type,entity_id,action,metadata,created_at,profiles(email)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) { return errorResponse(error); }
}

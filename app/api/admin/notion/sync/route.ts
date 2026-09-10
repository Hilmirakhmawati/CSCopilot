import { requireAdmin } from "@/lib/db";
import { syncNotionKnowledge } from "@/lib/notion-sync";
import { errorResponse, readText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const rootPageId = readText(body.page_id ?? process.env.NOTION_ROOT_PAGE_ID, "page_id", 100);
    const { synced, results } = await syncNotionKnowledge({ pageId: rootPageId, actorId: user.id, actionPrefix: "sync" });
    return Response.json({ action: "completed", synced, results });
  } catch (error) { return errorResponse(error); }
}

import { timingSafeEqual } from "crypto";
import { syncNotionKnowledge } from "@/lib/notion-sync";
import { errorResponse } from "@/lib/validation";

function secretMatches(provided: string | null, expected: string) {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first —
  // that length check is not itself timing-sensitive (secret length isn't
  // confidential the way its content is).
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vendor-agnostic scheduler entry point: call this from Vercel Cron, an OS
// cron job, GitHub Actions, or any scheduler that can send a header — no
// deployment target has been chosen yet, so this doesn't assume one.
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || !secretMatches(request.headers.get("x-cron-secret"), secret)) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const pageId = process.env.NOTION_ROOT_PAGE_ID?.trim();
    if (!pageId) throw new Error("NOTION_ROOT_PAGE_ID is not configured");
    const { synced } = await syncNotionKnowledge({ pageId, actorId: null, actionPrefix: "sync_scheduled" });
    return Response.json({ action: "completed", synced });
  } catch (error) { return errorResponse(error); }
}

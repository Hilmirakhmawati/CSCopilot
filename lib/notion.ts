import { Client } from "@notionhq/client";
import { withRetry } from "./retry";

function getNotion() {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured");
  return new Client({ auth: process.env.NOTION_TOKEN, timeoutMs: 30_000 });
}

type RichText = { plain_text?: string };
type Block = { type?: string; has_children?: boolean; [key: string]: unknown };

function textFromBlock(block: Block) {
  const value = block[block.type ?? ""] as { rich_text?: RichText[]; caption?: RichText[] } | undefined;
  return [...(value?.rich_text ?? []), ...(value?.caption ?? [])].map((part) => part.plain_text ?? "").join("");
}

async function readChildren(notion: Client, blockId: string): Promise<string[]> {
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await withRetry(() => notion.blocks.children.list({ block_id: blockId, start_cursor: cursor }));
    for (const raw of page.results) {
      const block = raw as unknown as Block;
      const text = textFromBlock(block).trim();
      if (text) lines.push(text);
      if (block.has_children) lines.push(...await readChildren(notion, String(block.id)));
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  return lines;
}

export async function readNotionPage(pageId: string) {
  const notion = getNotion();
  const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }));
  const properties = "properties" in page ? page.properties : {};
  const titleProperty = Object.values(properties).find((property) => property.type === "title") as { title?: RichText[] } | undefined;
  const title = titleProperty?.title?.map((part) => part.plain_text ?? "").join("") || "Untitled";
  const content = (await readChildren(notion, pageId)).join("\n");
  return { notion_page_id: pageId, title, content, url: "url" in page ? page.url : null, last_edited_time: "last_edited_time" in page ? page.last_edited_time : null };
}

type Property = { type?: string; [key: string]: unknown };

function richTextOf(property: Property | undefined) {
  return ((property?.rich_text as RichText[] | undefined) ?? []).map((part) => part.plain_text ?? "").join("").trim();
}

function selectOf(property: Property | undefined) {
  return (property?.select as { name?: string } | undefined)?.name ?? (property?.status as { name?: string } | undefined)?.name ?? "";
}

// Chatbot-safe rows only: Visibility must allow the chatbot, and the two
// customer-facing fields must be filled in — everything else (Internal Note,
// backend detail, customer/order IDs in the page body) is intentionally
// left out of what gets synced.
export async function readChatbotAllowedDatabaseRows(databaseId: string) {
  const notion = getNotion();
  const rows: { notion_page_id: string; title: string; url: string | null; content: string; last_edited_time: string | null }[] = [];
  let cursor: string | undefined;
  do {
    const page = await withRetry(() => notion.databases.query({ database_id: databaseId, start_cursor: cursor }));
    for (const raw of page.results) {
      if (!("properties" in raw)) continue;
      const properties = raw.properties as Record<string, Property>;
      const visibility = selectOf(properties["Visibility"]);
      if (visibility !== "Chatbot Allowed") continue;
      const summary = richTextOf(properties["Customer Safe Summary"]);
      // Customer Action is an internal CS instruction (e.g. "Minta nomor
      // pesanan"), never text to send to a customer. Customer Reply is the
      // approved customer-facing sentence; rows without it can still sync
      // (for internal-only guidance) but the app must not invent a reply
      // by reusing Customer Action — see pointAnswer() in retrieval.ts.
      const action = richTextOf(properties["Customer Action"]);
      const reply = richTextOf(properties["Customer Reply"]);
      const requiredContext = richTextOf(properties["Required Context"]);
      if (!summary || !action) continue;
      const titleProperty = Object.values(properties).find((p) => p.type === "title") as { title?: RichText[] } | undefined;
      const title = titleProperty?.title?.map((part) => part.plain_text ?? "").join("") || "Untitled";
      const contentLines = [
        `Customer Safe Summary: ${summary}`,
        `Customer Action: ${action}`,
        reply && `Customer Reply: ${reply}`,
        requiredContext && `Required Context: ${requiredContext}`,
      ].filter(Boolean);
      rows.push({
        notion_page_id: raw.id,
        title,
        url: "url" in raw ? (raw.url as string) : null,
        content: contentLines.join("\n"),
        last_edited_time: "last_edited_time" in raw ? (raw.last_edited_time as string) : null,
      });
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  return rows;
}

export async function findChildDatabaseId(rootPageId: string, databaseTitle: string) {
  const notion = getNotion();
  let cursor: string | undefined;
  do {
    const page = await withRetry(() => notion.blocks.children.list({ block_id: rootPageId, start_cursor: cursor }));
    for (const raw of page.results) {
      const block = raw as unknown as { type?: string; id: string; child_database?: { title?: string } };
      if (block.type === "child_database" && block.child_database?.title?.trim() === databaseTitle) return block.id;
    }
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  return null;
}

import { Client } from "@notionhq/client";

function getNotion() {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not configured");
  return new Client({ auth: process.env.NOTION_TOKEN });
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
    const page = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
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
  const page = await notion.pages.retrieve({ page_id: pageId });
  const properties = "properties" in page ? page.properties : {};
  const titleProperty = Object.values(properties).find((property) => property.type === "title") as { title?: RichText[] } | undefined;
  const title = titleProperty?.title?.map((part) => part.plain_text ?? "").join("") || "Untitled";
  const content = (await readChildren(notion, pageId)).join("\n");
  return { notion_page_id: pageId, title, content, url: "url" in page ? page.url : null, last_edited_time: "last_edited_time" in page ? page.last_edited_time : null };
}

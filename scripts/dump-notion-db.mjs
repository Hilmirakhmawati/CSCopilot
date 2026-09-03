// One-off: dump "Maintenance Task Testing" rows from Notion for safety review.
import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const rootPageId = "3bcf376206978008872adb97693af981";
const notion = new Client({ auth: token });

async function listChildren(id) {
  const out = [];
  let cursor;
  do {
    const page = await notion.blocks.children.list({ block_id: id, start_cursor: cursor });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return out;
}

const rich = (p) => p?.rich_text?.map((t) => t.plain_text).join("") ?? null;
const sel = (p) => p?.select?.name ?? p?.status?.name ?? null;

// find child database
const children = await listChildren(rootPageId);
const dbBlock = children.find((b) => b.type === "child_database" && b.child_database.title.includes("Maintenance Task Testing"));
if (!dbBlock) {
  console.log("child blocks:", children.map((b) => `${b.type}:${b.child_database?.title ?? b.id}`).join("\n"));
  process.exit(1);
}
console.log("DB:", dbBlock.child_database.title, dbBlock.id);

let cursor;
do {
  const rows = await notion.databases.query({ database_id: dbBlock.id, start_cursor: cursor });
  for (const row of rows.results) {
    const props = row.properties;
    const title = props.Title?.title?.map((t) => t.plain_text).join("") ?? props.Name?.title?.map((t) => t.plain_text).join("") ?? "(untitled)";
    console.log("=====", title, `(${row.url})`);
    for (const [key, val] of Object.entries(props)) {
      let v = rich(val) ?? sel(val) ?? (val?.number ?? null) ?? (val?.checkbox ?? null) ?? (val?.multi_select?.map((s) => s.name).join(", ") || null) ?? (val?.date?.start ?? null) ?? (val?.people?.length ? "people" : null);
      if (v !== null && v !== "") console.log(`  ${key}: ${v}`);
    }
  }
  cursor = rows.has_more ? rows.next_cursor : undefined;
} while (cursor);

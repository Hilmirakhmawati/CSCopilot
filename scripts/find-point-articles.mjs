import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!token) throw new Error("NOTION_TOKEN missing");
const notion = new Client({ auth: token });
const terms = ["Customer Points Displayed as 0", "Point History Does Not Match Order History", "Point Usage Calculation Appears Incorrect", "Point History Inconsistency on General Orders", "Audit dan Perbaikan Saldo Point Customer"];
for (const term of terms) {
  const result = await notion.search({ query: term, page_size: 20 });
  for (const item of result.results) {
    const title = "properties" in item
      ? Object.values(item.properties).find((p) => p.type === "title")?.title?.map((t) => t.plain_text).join("")
      : "title" in item ? item.title : "";
    console.log(JSON.stringify({ term, id: item.id, title, url: "url" in item ? item.url : null, type: item.object }));
  }
}

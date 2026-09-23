import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const notion = new Client({ auth: token });

const ids = {
  "Customer Points Displayed as 0": "502f3762-0697-8323-b543-01cc5e531eb3",
  "Point History Does Not Match Order History": "3f6f3762-0697-837a-81c5-819264019c26",
  "Point Usage Calculation Appears Incorrect": "740f3762-0697-83ca-91b2-81cc0cb0142b",
  "Point History Inconsistency on General Orders": "d60f3762-0697-8233-b9d3-018ac2195adf",
  "Audit dan Perbaikan Saldo Point Customer": "b6bf3762-0697-827e-85b1-81b2e43df413",
};

for (const [label, id] of Object.entries(ids)) {
  const page = await notion.pages.retrieve({ page_id: id });
  console.log("=====", label);
  console.log("parent:", JSON.stringify(page.parent));
  console.log("properties:", Object.keys(page.properties));
  for (const [key, val] of Object.entries(page.properties)) {
    const rich = val?.rich_text?.map((t) => t.plain_text).join("") ?? null;
    const sel = val?.select?.name ?? val?.status?.name ?? null;
    const title = val?.title?.map((t) => t.plain_text).join("") ?? null;
    const v = rich ?? sel ?? title;
    if (v) console.log(`  ${key} (${val.type}): ${v}`);
    else console.log(`  ${key} (${val.type}): <empty>`);
  }
}

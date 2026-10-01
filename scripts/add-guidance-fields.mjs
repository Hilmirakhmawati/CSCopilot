import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!token) throw new Error("NOTION_TOKEN missing");
const notion = new Client({ auth: token });

const databaseId = "3bcf3762-0697-8029-afa8-f11e9eae4e46";

// Adds the three optional guidance columns only. Existing rows and values are
// untouched; isi kolom manual di Notion (langkah tidak boleh dikarang).
await notion.databases.update({
  database_id: databaseId,
  properties: {
    "Troubleshooting Steps": { rich_text: {} },
    "Escalate When": { rich_text: {} },
    "Last Verified": { date: {} },
  },
});
console.log("Schema updated: Troubleshooting Steps, Escalate When, Last Verified");

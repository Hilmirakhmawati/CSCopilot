import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const notion = new Client({ auth: token });

// Point Usage Calculation Appears Incorrect — the app cannot receive image
// attachments yet, so screenshot must not be a required (or joint) field.
// Order number is the only real, checkable requirement.
const pageId = "740f3762-0697-83ca-91b2-81cc0cb0142b";
await notion.pages.update({
  page_id: pageId,
  properties: {
    "Customer Reply": {
      rich_text: [{
        text: {
          content:
            "Terima kasih sudah menghubungi kami. Mohon kirimkan nomor pesanan terkait agar kami dapat meninjau perhitungan poin Anda.",
        },
      }],
    },
    "Customer Action": {
      rich_text: [{
        text: {
          content:
            "Minta nomor pesanan terkait untuk meninjau ulang perhitungan poin. Jika pemeriksaan membutuhkan bukti visual, minta screenshot melalui channel yang mendukung attachment (di luar CSCopilot) sebelum eskalasi ke tim poin.",
        },
      }],
    },
    "Required Context": {
      rich_text: [{ text: { content: "Nomor pesanan" } }],
    },
  },
});
console.log("Updated", pageId, "— screenshot removed from required context");

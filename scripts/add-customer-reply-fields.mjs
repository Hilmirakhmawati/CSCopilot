import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const notion = new Client({ auth: token });

const databaseId = "3bcf3762-0697-8029-afa8-f11e9eae4e46";

const rows = {
  "502f3762-0697-8323-b543-01cc5e531eb3": {
    // Customer Points Displayed as 0
    reply: "Terima kasih sudah menghubungi kami. Untuk membantu memeriksa saldo poin yang tampil 0, mohon kirimkan nomor akun atau nomor pesanan terkait. Tim kami akan meninjau data poin berdasarkan informasi tersebut.",
    context: "Nomor akun atau nomor pesanan",
  },
  "3f6f3762-0697-837a-81c5-819264019c26": {
    // Point History Does Not Match Order History
    reply: "Terima kasih sudah menghubungi kami. Untuk memeriksa perbedaan antara riwayat poin dan riwayat pesanan, mohon kirimkan nomor pesanan terkait. Tim kami akan meninjau riwayat tersebut.",
    context: "Nomor pesanan",
  },
  "740f3762-0697-83ca-91b2-81cc0cb0142b": {
    // Point Usage Calculation Appears Incorrect — screenshot dropped: the app
    // cannot receive image attachments yet.
    reply: "Terima kasih sudah menghubungi kami. Untuk meninjau perhitungan penggunaan poin, mohon kirimkan nomor pesanan terkait. Tim kami akan memeriksa detail perhitungannya.",
    context: "Nomor pesanan",
  },
  "d60f3762-0697-8233-b9d3-018ac2195adf": {
    // Point History Inconsistency on General Orders
    reply: "Terima kasih sudah menghubungi kami. Untuk memeriksa ketidaksesuaian riwayat poin pada pesanan, mohon kirimkan nomor pesanan terkait. Tim kami akan meninjau detail transaksi tersebut.",
    context: "Nomor pesanan",
  },
  "b6bf3762-0697-827e-85b1-81b2e43df413": {
    // Audit dan Perbaikan Saldo Point Customer
    reply: "Terima kasih sudah menghubungi kami. Untuk membantu melakukan audit saldo poin, mohon kirimkan nomor akun atau nomor pesanan terkait. Tim kami akan meninjau data poin berdasarkan informasi tersebut.",
    context: "Nomor akun atau nomor pesanan",
  },
};

// 1. Add the two properties to the database schema (idempotent — Notion
// no-ops if they already exist with the same name/type).
await notion.databases.update({
  database_id: databaseId,
  properties: {
    "Customer Reply": { rich_text: {} },
    "Required Context": { rich_text: {} },
  },
});
console.log("Schema updated: Customer Reply, Required Context");

// 2. Fill in the five rows.
for (const [pageId, { reply, context }] of Object.entries(rows)) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Customer Reply": { rich_text: [{ text: { content: reply } }] },
      "Required Context": { rich_text: [{ text: { content: context } }] },
    },
  });
  console.log("Updated", pageId);
}
console.log("Done.");

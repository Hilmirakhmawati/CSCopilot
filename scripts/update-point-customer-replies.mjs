import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!token) throw new Error("NOTION_TOKEN missing");

const notion = new Client({ auth: token });

const replies = {
  // Customer Points Displayed as 0
  "502f3762-0697-8323-b543-01cc5e531eb3":
    "Terima kasih sudah menghubungi kami. Untuk membantu memeriksa saldo poin yang tampil 0, mohon kirimkan nomor akun atau nomor pesanan terkait. Tim kami akan meninjau data poin berdasarkan informasi tersebut.",

  // Point History Does Not Match Order History
  "3f6f3762-0697-837a-81c5-819264019c26":
    "Terima kasih sudah menghubungi kami. Untuk memeriksa perbedaan antara riwayat poin dan riwayat pesanan, mohon kirimkan nomor pesanan terkait. Tim kami akan meninjau riwayat tersebut.",

  // Point Usage Calculation Appears Incorrect for Customer
  "740f3762-0697-83ca-91b2-81cc0cb0142b":
    "Terima kasih sudah menghubungi kami. Untuk meninjau perhitungan penggunaan poin, mohon kirimkan nomor pesanan terkait. Tim kami akan memeriksa detail perhitungannya.",

  // Point History Inconsistency on General Orders
  "d60f3762-0697-8233-b9d3-018ac2195adf":
    "Terima kasih sudah menghubungi kami. Untuk memeriksa ketidaksesuaian riwayat poin pada pesanan, mohon kirimkan nomor pesanan terkait. Tim kami akan meninjau detail transaksi tersebut.",

  // Audit dan Perbaikan Saldo Point Customer
  "b6bf3762-0697-827e-85b1-81b2e43df413":
    "Terima kasih sudah menghubungi kami. Untuk membantu melakukan audit saldo poin, mohon kirimkan nomor akun atau nomor pesanan terkait. Tim kami akan meninjau data poin berdasarkan informasi tersebut.",
};

for (const [pageId, reply] of Object.entries(replies)) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Customer Reply": {
        rich_text: [{ text: { content: reply } }],
      },
    },
  });
  console.log("Updated", pageId);
}

console.log("Customer Reply updated for", Object.keys(replies).length, "articles.");

import { readFileSync } from "node:fs";
import { Client } from "@notionhq/client";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/^NOTION_TOKEN=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!token) throw new Error("NOTION_TOKEN missing");

const notion = new Client({ auth: token });
const lastVerified = "2026-10-01";
const rows = {
  // Customer Points Displayed as 0
  "502f3762-0697-8323-b543-01cc5e531eb3": {
    steps: [
      "1. Konfirmasi nomor akun atau nomor pesanan terkait.",
      "2. Bandingkan saldo poin dengan riwayat poin dan transaksi terkait.",
      "3. Catat bila ada adjustment manual atau perbedaan riwayat.",
    ],
    escalate: [
      "Saldo tetap 0 setelah riwayat poin dan transaksi dibandingkan.",
      "Ada adjustment manual yang tidak dikenal atau tidak dapat dijelaskan.",
    ],
  },
  // Point History Does Not Match Order History
  "3f6f3762-0697-837a-81c5-819264019c26": {
    steps: [
      "1. Minta nomor pesanan terkait.",
      "2. Bandingkan tanggal, status, dan perubahan pada riwayat pesanan dengan riwayat poin.",
      "3. Catat transaksi atau selisih yang tidak sesuai.",
    ],
    escalate: [
      "Riwayat poin tetap berbeda setelah detail pesanan dibandingkan.",
      "Ditemukan transaksi atau perubahan poin yang tidak dapat dijelaskan.",
    ],
  },
  // Point Usage Calculation Appears Incorrect
  "740f3762-0697-83ca-91b2-81cc0cb0142b": {
    steps: [
      "1. Minta nomor pesanan terkait.",
      "2. Bandingkan poin yang digunakan dengan detail transaksi dan riwayat poin.",
      "3. Catat bagian perhitungan yang dianggap tidak sesuai.",
    ],
    escalate: [
      "Perhitungan tetap tidak sesuai setelah detail transaksi diperiksa.",
      "Ada penggunaan poin yang tidak dikenal atau tidak dapat dijelaskan.",
    ],
  },
  // Point History Inconsistency on General Orders
  "d60f3762-0697-8233-b9d3-018ac2195adf": {
    steps: [
      "1. Minta nomor pesanan terkait.",
      "2. Bandingkan riwayat poin dengan detail pesanan umum dan transaksi terkait.",
      "3. Catat tanggal dan selisih yang tidak konsisten.",
    ],
    escalate: [
      "Ketidaksesuaian tetap ada setelah riwayat dan detail pesanan dibandingkan.",
      "Ada transaksi atau perubahan poin yang tidak dapat dijelaskan.",
    ],
  },
  // Audit dan Perbaikan Saldo Point Customer
  "b6bf3762-0697-827e-85b1-81b2e43df413": {
    steps: [
      "1. Konfirmasi nomor akun atau nomor pesanan terkait.",
      "2. Bandingkan saldo dengan riwayat poin dan transaksi terkait.",
      "3. Catat sumber selisih atau adjustment manual yang ditemukan.",
    ],
    escalate: [
      "Selisih saldo tetap ada setelah riwayat poin dan transaksi dibandingkan.",
      "Ditemukan adjustment manual yang tidak dikenal atau tidak dapat dijelaskan.",
    ],
  },
};

for (const [pageId, guidance] of Object.entries(rows)) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Troubleshooting Steps": { rich_text: [{ text: { content: guidance.steps.join("\n") } }] },
      "Escalate When": { rich_text: [{ text: { content: guidance.escalate.join("\n") } }] },
      "Last Verified": { date: { start: lastVerified } },
    },
  });
  console.log("Updated guidance", pageId);
}
console.log("Guidance updated for", Object.keys(rows).length, "articles.");

import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

type Citation = { document_id?: string; title?: string; url?: string | null; quote?: string };
type AssistantResult = {
  answer?: string;
  draft_reply?: string;
  citations?: Citation[];
  confidence?: "low" | "medium" | "high";
  knowledge_status?: "complete" | "partial" | "unavailable";
  intent?: string;
  missing_context?: string[];
  error?: string;
};

type Turn = { input: string; response: AssistantResult };

const email = process.env.E2E_EMAIL?.trim();
const password = process.env.E2E_PASSWORD;
const artifacts = new Map<string, Turn[]>();

function requireCredentials() {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for UAT UI tests.");
}

async function login(page: Page) {
  requireCredentials();
  await page.goto("/login");
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: /masuk/i }).click();
  await expect(page).toHaveURL(/\/assistant(?:\?.*)?$/);
  await expect(page.getByPlaceholder("Jelaskan issue customer...")).toBeVisible();
}

async function freshConversation(page: Page) {
  const newChat = page.getByRole("button", { name: "Chat baru" });
  if (await newChat.isVisible()) await newChat.click();
  await expect(page.getByPlaceholder("Jelaskan issue customer...")).toBeVisible();
}

async function send(page: Page, input: string): Promise<AssistantResult> {
  const composer = page.getByPlaceholder("Jelaskan issue customer...");
  await composer.fill(input);
  const responsePromise = page.waitForResponse((response) =>
    /\/api\/conversations(?:\/[^/]+\/messages)?$/.test(new URL(response.url()).pathname) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  const response = await responsePromise;
  const body = await response.json() as AssistantResult;
  if (body.error) throw new Error(body.error);
  // Earlier turns can render the identical fallback text, so only the newest bubble counts.
  await expect(page.getByText(body.answer ?? "", { exact: true }).last()).toBeVisible();
  return body;
}

function record(caseName: string, input: string, response: AssistantResult) {
  const turns = artifacts.get(caseName) ?? [];
  turns.push({ input, response });
  artifacts.set(caseName, turns);
}

function customerText(response: AssistantResult) {
  return `${response.answer ?? ""}\n${response.draft_reply ?? ""}`;
}

function assertNoSourceMetadata(response: AssistantResult) {
  expect(customerText(response)).not.toMatch(/SOURCE\s*\d+|\bUUID\b|https?:\/\/|\bscore\b/i);
}

// The generic "no knowledge" fallback matches loose keyword regexes, so a reply only
// counts as answered when it is backed by at least one citation.
function assertGrounded(response: AssistantResult) {
  expect(response.knowledge_status).not.toBe("unavailable");
  expect(response.citations?.length ?? 0).toBeGreaterThan(0);
}

function assertCitationTitles(response: AssistantResult, pattern: RegExp) {
  expect(response.citations?.length ?? 0).toBeGreaterThan(0);
  expect(response.citations?.every((citation) => pattern.test(citation.title ?? ""))).toBe(true);
}

async function saveArtifacts(testInfo: { outputDir: string }) {
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await fs.writeFile(path.join(testInfo.outputDir, "responses.json"), JSON.stringify([...artifacts], null, 2), "utf8");
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== "skipped") await saveArtifacts(testInfo);
  artifacts.clear();
});

test("TC-01: direct point question is grounded", async ({ page }) => {
  await freshConversation(page);
  const input = "Kenapa saldo poin customer tampil 0?";
  const response = await send(page, input);
  record("TC-01", input, response);
  assertGrounded(response);
  expect(customerText(response)).toMatch(/poin|point|saldo|akun/i);
  expect(customerText(response)).not.toMatch(/Project B/i);
  assertNoSourceMetadata(response);
});

test("TC-02: follow-up keeps the point history context", async ({ page }) => {
  await freshConversation(page);
  const first = "Kenapa riwayat poin beda dengan riwayat pesanan?";
  const second = "Apa langkah yang bisa dicek CS?";
  const firstResponse = await send(page, first);
  record("TC-02", first, firstResponse);
  assertGrounded(firstResponse);
  const response = await send(page, second);
  record("TC-02", second, response);
  expect(customerText(response)).toMatch(/poin|point|riwayat|pesanan|langkah|knowledge/i);
  expect(customerText(response)).not.toMatch(/Project B/i);
  assertNoSourceMetadata(response);
});

// Deferred: needs Project B knowledge. Re-enable once Project B articles exist in UAT.
test.fixme("TC-03: Project B topic excludes Project A payment context", async ({ page }) => {
  await freshConversation(page);
  const first = "Project A: pembayaran customer gagal terus di checkout.";
  const second = "Ganti topik — untuk Project B, kenapa laporan bulanan tidak muncul di dashboard?";
  record("TC-03", first, await send(page, first));
  const response = await send(page, second);
  record("TC-03", second, response);
  expect(customerText(response)).toMatch(/Project B|laporan|dashboard/i);
  expect(customerText(response)).not.toMatch(/Project A|payment|pembayaran|checkout/i);
  assertCitationTitles(response, /Project B/i);
  assertNoSourceMetadata(response);
});

test("TC-05: earlier point context carries into the final follow-up", async ({ page }) => {
  await freshConversation(page);
  const turns = [
    "Perhitungan penggunaan poin customer sepertinya salah.",
    "Poinnya terpotong lebih besar dari total pesanan.",
    "Apakah ada solusi untuk issue ini?",
  ];
  for (const input of turns.slice(0, 2)) record("TC-05", input, await send(page, input));
  const response = await send(page, turns[2]);
  record("TC-05", turns[2], response);
  assertGrounded(response);
  expect(customerText(response)).toMatch(/poin|point|perhitungan|solusi|issue/i);
  expect(customerText(response)).not.toMatch(/Project B/i);
  assertNoSourceMetadata(response);
});

test("TC-07: unknown topic does not invent a grounded reply", async ({ page }) => {
  await freshConversation(page);
  const input = "Project A: kenapa fitur voice call tidak muncul di versi terbaru?";
  const response = await send(page, input);
  record("TC-07", input, response);
  expect(response.citations ?? []).toHaveLength(0);
  expect(response.confidence).toBe("low");
  expect(response.draft_reply ?? "").toBe("");
  expect(customerText(response)).toMatch(/knowledge|manual|verifikasi|tidak tersedia|belum/i);
  assertNoSourceMetadata(response);
});

// Deferred: needs Project B knowledge.
test.fixme("TC-09: long conversation answers the latest Project B owner question", async ({ page }) => {
  await freshConversation(page);
  const turns = [
    "Halo",
    "Project A: user tidak bisa checkout.",
    "Ternyata errornya di payment gateway timeout.",
    "Ganti ke Project B: laporan mingguan telat terkirim.",
    "Oke terima kasih.",
    "Untuk Project B tadi, siapa yang biasanya menangani ini kalau lewat dari jadwal?",
  ];
  for (const input of turns) record("TC-09", input, await send(page, input));
  const final = artifacts.get("TC-09")?.at(-1)?.response;
  expect(final).toBeTruthy();
  expect(customerText(final!)).toMatch(/Project B|laporan|report|tim|menangani|owner/i);
  expect(customerText(final!)).not.toMatch(/Project A|checkout|payment gateway|timeout/i);
  assertCitationTitles(final!, /Project B/i);
  assertNoSourceMetadata(final!);
});

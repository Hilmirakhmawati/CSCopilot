import assert from "assert/strict";
import { fallback, generateNoAiAnswer, mapCitations, extractFirstJsonObject } from "./anthropic";
import { POINT_ARTICLE_TITLE_MATCHES, continuationSignal, contextSatisfied, isSarcasticOrDismissive, pointAnswer, pointArticleTitle, isPointTopic, selectPointArticle } from "./retrieval";
import { activeContextForPrompt, trimHistoryToBudget, updateActiveContext } from "./context";
import { readJson } from "./validation";
import type { Citation, KnowledgeDocument } from "./assistant-types";
import { filterDocumentsByProject, resolveProjectScope } from "./project-scope";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const sourceMarkerPattern = new RegExp(`(?:\\bSOURCE\\s+\\d+\\b|\\b(?:ID|TITLE|URL|CONTENT|SCORE|RELEVANCE|SIMILARITY)\\s*:)`, "i");
const uuidRegex = new RegExp(`\\b${uuidPattern}\\b`, "i");

export function validateCitations(citations: Citation[], documentIds: Set<string>) {
  return citations.filter((citation) => documentIds.has(citation.document_id));
}

export function hasCustomerFacingSourceLeak(value: string) {
  return sourceMarkerPattern.test(value) || uuidRegex.test(value);
}

// Code-level guarantee for the Clarification Flow: if the model (or a
// fallback path) reports missing_context, don't trust it to also have left
// draft_reply empty — enforce it here so a Suggested Reply can never appear
// alongside an unanswered "what's still missing" state.
export function enforceMissingContextInvariant<T extends { missing_context: string[]; draft_reply: string }>(answer: T): T {
  return answer.missing_context.length > 0 ? { ...answer, draft_reply: "" } : answer;
}

if (process.argv[1]?.endsWith("assistant-check.ts")) {
  assert.equal(validateCitations([{ document_id: "known", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 1);
  assert.equal(validateCitations([{ document_id: "unknown", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 0);
  assert.equal(hasCustomerFacingSourceLeak("SOURCE 1\\nID: 0863960c-7058-4822-b749-8d931bec649c"), true);
  assert.equal(hasCustomerFacingSourceLeak("Mohon kirim nomor akun atau nomor pesanan terkait."), false);

  const docs: KnowledgeDocument[] = [
    { id: "doc-1", title: "A", url: null, content: "", category: null, synced_at: "" },
    { id: "doc-2", title: "B", url: "https://x", content: "", category: null, synced_at: "" },
  ];
  const mapped = mapCitations([{ reference_index: 2, quote: "q" }, { reference_index: 9, quote: "dropped" }], docs);
  assert.deepEqual(mapped, [{ document_id: "doc-2", title: "B", url: "https://x", quote: "q" }]);
  assert.equal(extractFirstJsonObject(`prefix {"answer":"brace } inside"} suffix {"ignored":true}`), '{"answer":"brace } inside"}');
  assert.equal(extractFirstJsonObject("no JSON here"), undefined);

  assert.equal(pointArticleTitle("Saldo poin customer tampil 0 padahal sebelumnya ada"), POINT_ARTICLE_TITLE_MATCHES[0]);
  assert.equal(pointArticleTitle("Riwayat poin tidak sesuai dengan pesanan"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Kenapa riwayat poin beda?"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Kenapa riwayat poin tidak sesuai?"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Perhitungan penggunaan poin saya salah"), POINT_ARTICLE_TITLE_MATCHES[2]);
  assert.equal(pointArticleTitle("Riwayat poin pada pesanan umum tidak konsisten"), POINT_ARTICLE_TITLE_MATCHES[3]);
  assert.equal(pointArticleTitle("Ada selisih saldo poin, minta audit"), POINT_ARTICLE_TITLE_MATCHES[4]);
  assert.equal(isPointTopic("Poin saya tiba-tiba jadi nol"), true);
  assert.equal(isPointTopic("Bagaimana cara reset password customer?"), false);
  assert.equal(isPointTopic("Bagaimana proses refund order?"), false);

  // Legacy row: no Customer Reply field yet. Must never surface Customer
  // Action as a customer-facing draft — the app has to hold back and ask
  // for the Notion row to be completed instead.
  const legacyDocuments: KnowledgeDocument[] = [{
    id: "point-1",
    title: POINT_ARTICLE_TITLE_MATCHES[1],
    url: "https://notion.so/point-1",
    content: "Customer Safe Summary: Riwayat poin dapat berbeda dari riwayat pesanan.\nCustomer Action: Minta nomor pesanan terkait untuk verifikasi.",
    category: "points",
    synced_at: "",
  }];
  const legacyPoint = pointAnswer("Kenapa riwayat poin beda?", legacyDocuments);
  assert.ok(legacyPoint);
  assert.equal(legacyPoint?.draft_reply, "");
  assert.equal(legacyPoint?.recommended_action, "Minta nomor pesanan terkait untuk verifikasi");
  assert.equal(legacyPoint?.missing_context.length > 0, true);
  assert.equal(legacyPoint?.citations.length, 1);
  assert.equal(legacyPoint?.answer.includes("Kemungkinan penyebab"), false);
  assert.equal(legacyPoint?.answer.includes("Minta nomor pesanan"), false);

  // Same legacy-row shape through the generic fallback() path (no Anthropic
  // response) — Customer Action must never leak into draft_reply here either.
  const legacyFallback = fallback("saldo poin saya bermasalah", legacyDocuments);
  assert.equal(legacyFallback.draft_reply, "");
  assert.equal(legacyFallback.draft_reply.includes("Minta nomor pesanan terkait untuk verifikasi"), false);
  assert.equal(legacyFallback.knowledge_gap, true);

  // Fallback must enforce Required Context too, not only Customer Reply.
  const genericContextDocuments: KnowledgeDocument[] = [{
    id: "generic-1",
    title: "Order status",
    url: "https://notion.so/generic-1",
    content: "Customer Safe Summary: Status order perlu diverifikasi.\nCustomer Action: Verifikasi data order.\nRequired Context: Nomor order\nCustomer Reply: Kami akan memeriksa status order Anda",
    category: null,
    synced_at: "",
  }];
  const fallbackWithoutOrder = fallback("status order saya", genericContextDocuments);
  assert.equal(fallbackWithoutOrder.draft_reply, "");
  assert.ok(fallbackWithoutOrder.missing_context.some((item) => /nomor pesanan terkait/.test(item)));

  // An unlabeled number may be an order number, but not an account identifier.
  assert.equal(contextSatisfied("nomor pesanan terkait", "1234567890"), true);
  assert.equal(contextSatisfied("nomor atau email akun terkait", "1234567890"), false);
  assert.equal(contextSatisfied("nomor atau email akun terkait", "akun 1234567890"), true);
  assert.equal(contextSatisfied("nomor atau email akun terkait", "customer@example.com"), true);

  // Broad point retrieval must not silently pick one of multiple active articles.
  const ambiguousPointDocuments = [
    { ...legacyDocuments[0], id: "point-a", title: POINT_ARTICLE_TITLE_MATCHES[0] },
    { ...legacyDocuments[0], id: "point-b", title: POINT_ARTICLE_TITLE_MATCHES[1] },
  ];
  assert.deepEqual(selectPointArticle(ambiguousPointDocuments, null), []);

  const pointDocuments: KnowledgeDocument[] = [{
    id: "point-1b",
    title: POINT_ARTICLE_TITLE_MATCHES[1],
    url: "https://notion.so/point-1b",
    content:
      "Customer Safe Summary: Riwayat poin dapat berbeda dari riwayat pesanan.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk verifikasi.\n" +
      "Customer Reply: Terima kasih sudah menghubungi kami, mohon kirimkan nomor pesanan terkait agar kami bisa memeriksa riwayat poin",
    category: "points",
    synced_at: "",
  }];
  const point = pointAnswer("Kenapa riwayat poin beda?", pointDocuments);
  assert.ok(point);
  assert.equal(point?.draft_reply, "");
  assert.deepEqual(point?.missing_context, ["Mohon minta nomor pesanan terkait sebelum kasus ini diverifikasi."]);
  assert.equal(point?.citations.length, 1);
  assert.equal(point?.answer.includes("Kemungkinan penyebab"), false);
  // Customer Action (internal) must never leak into the customer-facing draft.
  assert.equal(point?.recommended_action, "Minta nomor pesanan terkait untuk verifikasi");

  const zeroBalanceDocuments: KnowledgeDocument[] = [{
    id: "point-0",
    title: POINT_ARTICLE_TITLE_MATCHES[0],
    url: "https://notion.so/point-0",
    content:
      "Customer Safe Summary: Saldo poin dapat menampilkan 0 karena kendala sinkronisasi.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk verifikasi.\n" +
      "Required Context: Nomor order\n" +
      "Customer Reply: Terima kasih sudah menghubungi kami, mohon kirimkan nomor pesanan terkait agar tim kami bisa memeriksa saldo poin Anda",
    category: "points",
    synced_at: "",
  }];
  assert.equal(continuationSignal("123344555"), true);
  assert.equal(continuationSignal("customer@example.com"), true);
  const verifiedBareIdentifier = pointAnswer("123344555", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(verifiedBareIdentifier?.missing_context.length, 0);
  assert.notEqual(verifiedBareIdentifier?.draft_reply, "");
  const verifiedPoint = pointAnswer("1223243144 ini adalah no pesanannya", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(verifiedPoint?.missing_context.length, 0);
  assert.notEqual(verifiedPoint?.draft_reply, "");
  assert.equal(verifiedPoint?.draft_reply.includes("Minta nomor pesanan terkait untuk verifikasi"), false);
  assert.equal(point?.answer.includes("akan disesuaikan"), false);

  const calculationDocuments: KnowledgeDocument[] = [{
    id: "point-calculation",
    title: POINT_ARTICLE_TITLE_MATCHES[2],
    url: "https://notion.so/point-calculation",
    content:
      "Customer Safe Summary: Perhitungan penggunaan poin perlu ditinjau ulang.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk meninjau ulang perhitungan poin. Jika perlu, minta screenshot melalui channel yang mendukung attachment.\n" +
      "Required Context: Nomor pesanan\n" +
      "Customer Reply: Mohon kirimkan nomor pesanan terkait agar kami dapat meninjau perhitungan poin Anda",
    category: "points",
    synced_at: "",
  }];
  const calculationWithoutContext = pointAnswer("Cara cek perhitungan poin?", calculationDocuments);
  assert.deepEqual(calculationWithoutContext?.missing_context, [
    "Mohon minta nomor pesanan terkait sebelum kasus ini diverifikasi.",
  ]);
  // Regression: mentioning "screenshot" in the chat must not be treated as a
  // real attachment — the app has no attachment upload path yet.
  const calculationScreenshotOnly = pointAnswer("ini screenshot perhitungannya, terlampir ya", calculationDocuments, [{ role: "user", content: "Cara cek perhitungan poin?" }]);
  assert.equal(calculationScreenshotOnly?.missing_context.length, 1);
  const calculationVerified = pointAnswer("1234567890 ini nomor pesanannya", calculationDocuments, [{ role: "user", content: "Cara cek perhitungan poin?" }]);
  assert.equal(calculationVerified?.missing_context.length, 0);
  assert.notEqual(calculationVerified?.draft_reply, "");

  // Regression: an explicit new topic must not inherit the previous point
  // topic just because it is short. Only genuine follow-ups ("masih sama")
  // should be treated as continuations that borrow prior context.
  assert.equal(continuationSignal("Pembayaran saya gagal"), false);
  assert.equal(continuationSignal("Masih sama"), true);
  assert.equal(continuationSignal("itu"), true);
  assert.equal(continuationSignal("Cari SOP refund"), false);
  // Regression: a label word ("nomor pesanannya") plus a bare identifier is
  // still just supplying the identifier the agent asked for, not a new topic.
  assert.equal(continuationSignal("Nomor pesanannya 1234567890"), true);
  const nomorPesanannya = pointAnswer("Nomor pesanannya 1234567890", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(nomorPesanannya?.missing_context.length, 0);
  assert.notEqual(nomorPesanannya?.draft_reply, "");
  assert.match(nomorPesanannya?.draft_reply ?? "", /nomor pesanan sudah kami terima/);
  assert.match(nomorPesanannya?.draft_reply ?? "", /saldo poin yang tampil 0/);
  assert.doesNotMatch(nomorPesanannya?.draft_reply ?? "", /mohon kirimkan nomor/i);

  // Regression: a Customer Reply that uses "silakan"/"mohon" for something
  // unrelated to requesting an identifier (e.g. pointing to an email) must be
  // sent verbatim, not overridden by the generic acknowledgement template.
  const unrelatedPoliteWordingDocuments: KnowledgeDocument[] = [{
    id: "point-0b",
    title: POINT_ARTICLE_TITLE_MATCHES[0],
    url: "https://notion.so/point-0b",
    content:
      "Customer Safe Summary: Saldo poin dapat menampilkan 0 karena kendala sinkronisasi.\n" +
      "Customer Action: Minta nomor pesanan terkait untuk verifikasi.\n" +
      "Required Context: Nomor order\n" +
      "Customer Reply: Terima kasih sudah menghubungi kami, silakan cek email Anda untuk melihat status pengajuan terkait saldo poin Anda",
    category: "points",
    synced_at: "",
  }];
  const unrelatedPoliteWording = pointAnswer("Nomor pesanannya 1234567890", unrelatedPoliteWordingDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(unrelatedPoliteWording?.missing_context.length, 0);
  assert.match(unrelatedPoliteWording?.draft_reply ?? "", /silakan cek email Anda untuk melihat status pengajuan/);
  const context = updateActiveContext("Poin saya jadi 0", {}, false, "2026-01-01T00:00:00Z");
  assert.match(activeContextForPrompt(context), /Poin saya jadi 0/);
  assert.equal(updateActiveContext("Pembayaran saya gagal", context, false).topic.value, "Pembayaran saya gagal");
  assert.equal(trimHistoryToBudget([{ content: "a".repeat(1000) }, { content: "latest" }], 2).length, 1);

  assert.deepEqual(
    enforceMissingContextInvariant({ missing_context: ["nomor pesanan"], draft_reply: "Terima kasih..." }),
    { missing_context: ["nomor pesanan"], draft_reply: "" },
  );
  assert.deepEqual(
    enforceMissingContextInvariant({ missing_context: [], draft_reply: "Terima kasih..." }),
    { missing_context: [], draft_reply: "Terima kasih..." },
  );

  const clarificationFollowUp = generateNoAiAnswer(
    'pesannya "invalid token". langkah yg sudah dicoba yaitu connect wifi ulang lalu coba login lagi. dan sama saja',
    [],
    [
      { role: "user", content: 'Project Inwan: aplikasi tidak bisa login sejak kemarin, muncul error "invalid token".' },
      { role: "assistant", content: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Bisa tolong kirimkan pesan error yang muncul, akun yang terdampak, dan langkah yang sudah dicoba?" },
    ],
  );
  assert.equal(clarificationFollowUp.missing_context.length, 1);
  assert.match(clarificationFollowUp.missing_context[0], /akun/i);
  assert.doesNotMatch(clarificationFollowUp.missing_context[0], /error|langkah|dicoba/i);
  assert.doesNotMatch(clarificationFollowUp.answer, /pesan error|langkah yang sudah dicoba/i);

  const newQuestionAfterClarification = generateNoAiAnswer(
    "gimana caranya verifikasi manual?",
    [],
    [
      { role: "user", content: 'Project A: aplikasi tidak bisa login sejak kemarin, muncul error "invalid token"' },
      { role: "assistant", content: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Bisa tolong kirimkan akun yang terdampak?" },
      { role: "user", content: "akun testertimedoor@gmail.com" },
      { role: "assistant", content: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Detail yang diberikan sudah tercatat; kasus ini perlu diverifikasi secara manual oleh tim Customer Support." },
    ],
  );
  assert.match(newQuestionAfterClarification.answer, /prosedur verifikasi manual|knowledge/i);
  assert.doesNotMatch(newQuestionAfterClarification.answer, /detail yang diberikan sudah tercatat/i);

  const pointsAmbiguity = generateNoAiAnswer(
    "yaelah, aku ga ngerti",
    [],
    [
      { role: "user", content: 'Project A: aplikasi tidak bisa login sejak kemarin, muncul error "invalid token"' },
      { role: "assistant", content: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Detail yang diberikan sudah tercatat; kasus ini perlu diverifikasi secara manual oleh tim Customer Support." },
      { role: "user", content: "gimana cara verifikasi manual?" },
      { role: "assistant", content: "Belum ada knowledge perusahaan yang menjelaskan pertanyaan ini. Kasus ini perlu diverifikasi oleh tim Customer Support." },
      { role: "user", content: "oke. lalu kenapa saldo poin bisa 0?" },
      { role: "assistant", content: "Saldo poin dapat menampilkan 0 karena kendala sinkronisasi." },
      { role: "user", content: "Kenapa riwayat poin beda?" },
      { role: "assistant", content: "Riwayat poin dapat berbeda dari riwayat pesanan." },
    ],
  );
  assert.match(pointsAmbiguity.answer, /poin|jelas|bagian/i);
  assert.doesNotMatch(pointsAmbiguity.answer, /akun yang terdampak|langkah yang sudah dicoba/i);

  const loginAfterPoints = generateNoAiAnswer(
    "sudah coba login ulang aja sih",
    [],
    [
      { role: "user", content: 'Project A: aplikasi tidak bisa login sejak kemarin, muncul error "invalid token"' },
      { role: "assistant", content: "Belum ada knowledge perusahaan yang cukup relevan untuk menjawab issue ini. Detail yang diberikan sudah tercatat; kasus ini perlu diverifikasi secara manual oleh tim Customer Support." },
      { role: "user", content: "oke. lalu kenapa saldo poin bisa 0?" },
      { role: "assistant", content: "Saldo poin dapat menampilkan 0 karena kendala sinkronisasi." },
      { role: "user", content: "Kenapa riwayat poin beda?" },
      { role: "assistant", content: "Riwayat poin dapat berbeda dari riwayat pesanan." },
      { role: "user", content: "yaelah, aku ga ngerti" },
      { role: "assistant", content: "Bagian mana yang masih kurang jelas terkait saldo atau riwayat poin?" },
    ],
  );
  assert.doesNotMatch(loginAfterPoints.answer, /akun yang terdampak, langkah yang sudah dicoba/i);

  // Regression: after distinct Project A and Project B turns, an ambiguous
  // follow-up must ask which project rather than rank or mix both articles.
  const projectDocuments: KnowledgeDocument[] = [
    {
      id: "project-a-login",
      title: "Project A - Login",
      url: "https://notion.so/project-a-login",
      content: "Customer Safe Summary: Project A login gagal karena token expired.\nCustomer Reply: Silakan login kembali untuk memperbarui token Project A.",
      category: "project-a",
      synced_at: "",
    },
    {
      id: "project-b-payment",
      title: "Project B - Payment",
      url: "https://notion.so/project-b-payment",
      content: "Customer Safe Summary: Project B pembayaran gagal karena saldo tidak cukup.\nCustomer Reply: Mohon periksa saldo Project B sebelum membayar.",
      category: "project-b",
      synced_at: "",
    },
  ];
  const projectHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  const projectA = generateNoAiAnswer("Project A: aplikasi tidak bisa login, muncul error token expired", projectDocuments, projectHistory);
  projectHistory.push({ role: "user", content: "Project A: aplikasi tidak bisa login, muncul error token expired" }, { role: "assistant", content: projectA.answer });
  const projectB = generateNoAiAnswer("Project B: pembayaran saya gagal terus", projectDocuments, projectHistory);
  projectHistory.push({ role: "user", content: "Project B: pembayaran saya gagal terus" }, { role: "assistant", content: projectB.answer });
  const ambiguousProjectFollowUp = generateNoAiAnswer("gimana statusnya?", projectDocuments, projectHistory);
  assert.match(projectA.draft_reply, /Project A|login/i);
  assert.match(projectB.draft_reply, /Project B|saldo/i);
  assert.match(ambiguousProjectFollowUp.answer, /Project A.*Project B|Project B.*Project A/i);
  assert.equal(ambiguousProjectFollowUp.draft_reply, "");
  assert.equal(ambiguousProjectFollowUp.confidence, "low");

  const scopeHistory = [
    { role: "user" as const, content: "Kami sedang investigasi masalah di Project A terkait sinkronisasi data." },
    { role: "assistant" as const, content: "Kami sedang memeriksa kasusnya." },
  ];
  assert.equal(resolveProjectScope("Datanya sudah dicek, error muncul di modul export.", scopeHistory).project, "A");
  assert.equal(resolveProjectScope("Untuk Project B, laporan tidak muncul.", scopeHistory).project, "B");
  assert.equal(resolveProjectScope("Bisa cek status untuk ini?", [
    ...scopeHistory,
    { role: "user" as const, content: "Project B juga ada kendala, beda kasus." },
  ]).ambiguous, true);
  const scoped = filterDocumentsByProject(
    [
      { id: "scope-a", title: "Project A login", url: null, content: "Project A login", category: "project-a", synced_at: "" },
      { id: "scope-b", title: "Project B login", url: null, content: "Project B login", category: "project-b", synced_at: "" },
    ],
    "B",
  );
  assert.deepEqual(scoped.map((document) => document.id), ["scope-b"]);

  // A follow-up asking for timing must answer that intent, not repeat the
  // previous issue summary when the source has no SLA/timeline.
  const timelineFollowUp = generateNoAiAnswer(
    "Berapa lama biasanya ini bisa selesai?",
    projectDocuments,
    [
      { role: "user", content: "Kami ada masalah login di Project A." },
      { role: "assistant", content: "Kami akan membantu memeriksa kendala login Project A." },
    ],
  );
  assert.match(timelineFollowUp.answer, /estimasi|waktu|timeline/i);
  assert.equal(timelineFollowUp.draft_reply, "");
  assert.equal(timelineFollowUp.confidence, "low");

  // An explicit Project B question must not cite a Project A document merely
  // because both documents share a generic issue word such as "gagal".
  const switchedProject = generateNoAiAnswer(
    "Ganti topik — untuk Project B, kenapa laporan bulanan tidak muncul di dashboard?",
    [
      ...projectDocuments,
      { id: "project-a-payment", title: "Project A - Payment", url: "https://notion.so/project-a-payment", content: "Customer Safe Summary: Project A pembayaran gagal di checkout.\nCustomer Reply: Kami akan memeriksa pembayaran Project A.", category: "project-a", synced_at: "" },
      { id: "project-b-report", title: "Project B - Report", url: "https://notion.so/project-b-report", content: "Customer Safe Summary: Project B laporan bulanan tidak muncul di dashboard.\nCustomer Reply: Kami akan memeriksa laporan bulanan Project B.", category: "project-b", synced_at: "" },
    ],
    [{ role: "user", content: "Project A: pembayaran customer gagal terus di checkout." }],
  );
  assert.ok(switchedProject.citations.length > 0);
  assert.ok(switchedProject.citations.every((citation) => /project\s+b/i.test(citation.title)));
  assert.equal(switchedProject.citations.some((citation) => /project\s+a/i.test(citation.title)), false);

  // JSON primitives and arrays must be rejected before routes dereference body fields.
  void (async () => {
    for (const value of [null, [], "text", 42, true]) {
      await assert.rejects(() => readJson(new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(value),
        headers: { "content-type": "application/json" },
      })), /Invalid JSON body/);
    }
    console.log("readJson shape check passed");
  })();

  // Sarcasm/dismissive-reaction detection: known idioms route to
  // clarification instead of being treated as a literal answerable message.
  assert.equal(isSarcasticOrDismissive("yaelah, aku ga ngerti"), true);
  assert.equal(isSarcasticOrDismissive("ya ampun ribet banget"), true);
  assert.equal(isSarcasticOrDismissive("bagus banget nih aplikasinya, error terus"), true);
  assert.equal(isSarcasticOrDismissive("Project A: aplikasi tidak bisa login, muncul error invalid token"), false);
  assert.equal(isSarcasticOrDismissive("Nomor pesanannya 1234567890"), false);
  const sarcasmFallback = fallback("yaelah, aku ga ngerti", []);
  assert.equal(sarcasmFallback.draft_reply, "");
  assert.equal(sarcasmFallback.missing_context.length > 0, true);

  console.log("assistant-check passed");
}

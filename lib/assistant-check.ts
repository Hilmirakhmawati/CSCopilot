import assert from "assert/strict";
import { fallback, generateNoAiAnswer, mapCitations, extractFirstJsonObject } from "./anthropic";
import { POINT_ARTICLE_TITLE_MATCHES, classifyConversationIntent, continuationSignal, contextSatisfied, isClosingMessage, isCustomerContextRequest, isFeedbackMessage, isSarcasticOrDismissive, pointAnswer, pointArticleTitle, isPointTopic, selectPointArticle } from "./retrieval";
import { activeContextForPrompt, trimHistoryToBudget, updateActiveContext } from "./context";
import { readJson } from "./validation";
import type { Citation, KnowledgeDocument } from "./assistant-types";
import { filterDocumentsByProject, projectNames, resolveProjectScope } from "./project-scope";
import { enforceMissingContextInvariant, hasCustomerFacingSourceLeak, sanitizeAnswer } from "./answer-safety";

export { enforceMissingContextInvariant, hasCustomerFacingSourceLeak, sanitizeAnswer } from "./answer-safety";

export function validateCitations(citations: Citation[], documentIds: Set<string>) {
  return citations.filter((citation) => documentIds.has(citation.document_id));
}

if (process.argv[1]?.endsWith("assistant-check.ts")) {
  assert.equal(validateCitations([{ document_id: "known", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 1);
  assert.equal(validateCitations([{ document_id: "unknown", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 0);
  assert.equal(hasCustomerFacingSourceLeak("SOURCE 1\\nID: 0863960c-7058-4822-b749-8d931bec649c"), true);
  assert.equal(hasCustomerFacingSourceLeak("Mohon kirim nomor akun atau nomor pesanan terkait."), false);

  const docs: KnowledgeDocument[] = [
    { id: "doc-1", title: "A", url: null, content: "", category: null, synced_at: "" },
    { id: "doc-2", title: "B", url: "https://x", content: "q", category: null, synced_at: "" },
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

  const pointDraft = "Terima kasih sudah menghubungi kami. Untuk memeriksa perbedaan antara riwayat poin dan riwayat pesanan, mohon kirimkan nomor pesanan terkait. Tim kami akan meninjau riwayat tersebut.";
  const pointDraftHistory = [
    { role: "user" as const, content: "Kenapa riwayat poin beda?" },
    { role: "assistant" as const, content: "Riwayat poin dapat berbeda dari riwayat pesanan." },
  ];
  assert.equal(classifyConversationIntent("tolong buatkan draft balasan lainnya", pointDraftHistory, pointDraft), "draft_regeneration");
  assert.equal(classifyConversationIntent("draft balasannya belum sesuai", pointDraftHistory, pointDraft), "draft_feedback");
  assert.equal(classifyConversationIntent("kurang isi sapaan", pointDraftHistory, pointDraft), "draft_edit");
  assert.equal(classifyConversationIntent("ini akunnya: 083119349222", pointDraftHistory, pointDraft), "supplied_context");
  assert.equal(classifyConversationIntent("lalu apa saran yg bisa aku kasih ke client?", pointDraftHistory, pointDraft), "guidance_follow_up");

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
  assert.equal(isCustomerContextRequest(point?.draft_reply ?? ""), true);
  assert.deepEqual(point?.missing_context, ["Mohon minta nomor pesanan terkait sebelum kasus ini diverifikasi."]);
  const alternateDraft = pointAnswer("tolong buatkan draft balasan lainnya", pointDocuments, pointDraftHistory, pointDraft);
  assert.ok(alternateDraft);
  assert.match(alternateDraft?.draft_reply ?? "", /^Halo Kak,/);
  assert.match(alternateDraft?.draft_reply ?? "", /riwayat poin/i);
  assert.equal(alternateDraft?.citations[0]?.document_id, "point-1b");
  const greetedDraft = pointAnswer("kurang isi sapaan", pointDocuments, pointDraftHistory, pointDraft);
  assert.match(greetedDraft?.draft_reply ?? "", /^Halo Kak,/);
  assert.match(greetedDraft?.draft_reply ?? "", /riwayat pesanan/i);
  const feedbackDraft = pointAnswer("draft balasannya belum sesuai", pointDocuments, pointDraftHistory, pointDraft);
  assert.match(feedbackDraft?.draft_reply ?? "", /^Halo Kak,/);
  const guidanceDraft = pointAnswer("lalu apa saran yg bisa aku kasih ke client?", pointDocuments, pointDraftHistory);
  assert.equal(guidanceDraft?.intent, "Customer guidance");
  assert.match(guidanceDraft?.answer ?? "", /riwayat poin/i);
  assert.equal(guidanceDraft?.recommended_action, "Minta nomor pesanan terkait untuk verifikasi");
  assert.match(guidanceDraft?.draft_reply ?? "", /nomor pesanan/i);
  const suppliedAccount = pointAnswer(
    "ini akunnya: 083119349222",
    [{ ...pointDocuments[0], content: pointDocuments[0].content.replace("nomor pesanan terkait", "nomor akun terkait atau nomor pesanan terkait") }],
    [{ role: "user", content: "Kenapa riwayat poin beda?" }, { role: "assistant", content: "Mohon kirimkan nomor akun terkait atau nomor pesanan terkait." }],
  );
  assert.equal(suppliedAccount?.missing_context.length, 0);
  assert.doesNotMatch(suppliedAccount?.draft_reply ?? "", /083119349222|mohon kirimkan/i);
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
  assert.equal(isCustomerContextRequest("Mohon kirimkan nomor pesanan terkait agar kami dapat melakukan pengecekan lebih lanjut."), true);
  assert.equal(isCustomerContextRequest("Kami sedang memeriksa status pengajuan Anda."), false);
  assert.deepEqual(
    enforceMissingContextInvariant({ missing_context: [], draft_reply: "Terima kasih..." }),
    { missing_context: [], draft_reply: "Terima kasih..." },
  );
  assert.deepEqual(
    enforceMissingContextInvariant({ missing_context: ["nomor pesanan"], draft_reply: "Mohon kirimkan nomor pesanan terkait agar kami dapat melakukan pengecekan lebih lanjut." }),
    { missing_context: ["nomor pesanan"], draft_reply: "Mohon kirimkan nomor pesanan terkait agar kami dapat melakukan pengecekan lebih lanjut." },
  );
  const leakedClarification = sanitizeAnswer({
    intent: "Needs clarification", summary: "", missing_context: ["akun"], recommended_action: "", answer: "SOURCE 1", draft_reply: "SOURCE 1", citations: [], confidence: "low",
  });
  assert.equal(leakedClarification.draft_reply, "");
  assert.equal(mapCitations([{ reference_index: 1, quote: "not in source" }], [{ ...docs[0], content: "actual source" }]).length, 0);

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

  const projectALogin: KnowledgeDocument = {
    id: "project-a-login-isolation",
    title: "Project A - Login",
    url: "https://notion.so/project-a-login-isolation",
    content: "Customer Safe Summary: Project A login gagal karena account locked.\nCustomer Reply: Silakan buka kunci akun Project A.",
    category: "project-a",
    synced_at: "",
  };
  const projectBLogin: KnowledgeDocument = {
    id: "project-b-login-isolation",
    title: "Project B - Login",
    url: "https://notion.so/project-b-login-isolation",
    content: "Customer Safe Summary: Project B login gagal karena session expired.\nCustomer Reply: Silakan login kembali ke Project B.",
    category: "project-b",
    synced_at: "",
  };
  const projectBQuestion = generateNoAiAnswer(
    "Sekarang untuk Project B, user juga tidak bisa login tapi errornya session expired.",
    [projectALogin, projectBLogin],
  );
  assert.match(projectBQuestion.draft_reply, /session expired|Project B/i);
  assert.equal(projectBQuestion.citations.some((citation) => /Project A/i.test(citation.title)), false);

  const noProjectAKnowledge = generateNoAiAnswer(
    "Project A: kenapa fitur voice call tidak muncul?",
    [projectBLogin],
  );
  assert.equal(noProjectAKnowledge.citations.length, 0);
  assert.equal(noProjectAKnowledge.draft_reply, "");
  assert.equal(noProjectAKnowledge.confidence, "low");

  const projectAExport: KnowledgeDocument = {
    id: "project-a-export",
    title: "Project A - Export",
    url: "https://notion.so/project-a-export",
    content: "Customer Safe Summary: Export Project A gagal setelah sinkronisasi data.\nCustomer Reply: Kami akan memeriksa error export Project A.",
    category: "project-a",
    synced_at: "",
  };
  const inheritedProject = generateNoAiAnswer(
    "Apakah ada solusi untuk issue ini?",
    [projectAExport],
    [
      { role: "user", content: "Kami sedang investigasi masalah di Project A terkait sinkronisasi data." },
      { role: "assistant", content: "Kami sedang memeriksa kasusnya." },
      { role: "user", content: "Datanya sudah dicek, error muncul di modul export." },
    ],
  );
  assert.match(inheritedProject.draft_reply, /export|Project A/i);

  const naturalAmbiguousProject = generateNoAiAnswer(
    "Bisa cek status untuk ini?",
    [projectALogin, projectBLogin],
    [
      { role: "user", content: "Project A ada kendala di modul pembayaran." },
      { role: "assistant", content: "Kami sedang memeriksa Project A." },
      { role: "user", content: "Project B juga ada kendala di modul pembayaran, beda kasus." },
      { role: "assistant", content: "Kami sedang memeriksa Project B." },
    ],
  );
  assert.match(naturalAmbiguousProject.answer, /Project A.*Project B|Project B.*Project A/i);
  assert.equal(naturalAmbiguousProject.draft_reply, "");
  assert.equal(naturalAmbiguousProject.citations.length, 0);

  const scopeHistory = [
    { role: "user" as const, content: "Kami sedang investigasi masalah di Project A terkait sinkronisasi data." },
    { role: "assistant" as const, content: "Kami sedang memeriksa kasusnya." },
  ];
  assert.equal(resolveProjectScope("Datanya sudah dicek, error muncul di modul export.", scopeHistory).project, "A");
  assert.equal(resolveProjectScope("Untuk Project B, laporan tidak muncul.", scopeHistory).project, "B");
  assert.equal(resolveProjectScope("Project Alpha Mobile: login gagal", []).project, "Alpha Mobile");
  const inwanHistory = [
    { role: "user" as const, content: "inwan aplikasi tidak bisa login sejak kemarin, muncul error invalid token" },
    { role: "assistant" as const, content: "Mohon kirimkan detail tambahan." },
  ];
  assert.equal(resolveProjectScope("inwan aplikasi tidak bisa login", []).project, "inwan");
  assert.equal(resolveProjectScope("inwan", inwanHistory).project, "inwan");
  assert.equal(continuationSignal("inwan", inwanHistory), true);
  assert.equal(resolveProjectScope("budi", inwanHistory).project, "inwan");
  assert.equal(resolveProjectScope("Project B: export PDF bermasalah", inwanHistory).project, "B");
  assert.equal(resolveProjectScope("inwan", [
    ...inwanHistory,
    { role: "user" as const, content: "Project B: export PDF bermasalah" },
  ]).project, "inwan");
  assert.equal(resolveProjectScope("inwan", [
    ...inwanHistory,
    { role: "user" as const, content: "Project B: export PDF bermasalah" },
    { role: "user" as const, content: "Langkah sudah dicoba" },
  ]).project, "inwan");
  assert.equal(resolveProjectScope("apa yang harus dilakukan?", [
    { role: "user" as const, content: "Project Inwan: aplikasi tidak bisa login, error invalid token" },
    { role: "user" as const, content: "Project B: export PDF tidak muncul" },
  ]).project, "B");
  assert.equal(filterDocumentsByProject([
    { id: "proyek-a", title: "Proyek A - Login", url: null, content: "Proyek A login", category: "proyek-a", synced_at: "" },
  ], "A").length, 1);
  const naturalContext = updateActiveContext("Untuk Project-B, laporan terlambat", {}, false, "2026-01-01T00:00:00Z");
  assert.equal(naturalContext.project?.value, "B");
  assert.equal(resolveProjectScope("Bisa cek status untuk ini?", [
    { role: "user" as const, content: "Project Alpha Mobile ada kendala." },
    { role: "user" as const, content: "Project B juga ada kendala." },
  ]).projects.join(", "), "Alpha Mobile, B");
  assert.equal(resolveProjectScope("Bisa cek status untuk ini?", [
    ...scopeHistory,
    { role: "user" as const, content: "Project B juga ada kendala, beda kasus." },
  ]).ambiguous, true);
  const scopedClarification = generateNoAiAnswer(
    "Project B: Apakah sudah ada solusi?",
    [],
    [
      { role: "user", content: "Project A: akun user error \"account locked\"." },
      { role: "user", content: "Project B: laporan error \"timeout\"." },
      { role: "user", content: "Project B: langkah sudah dicoba." },
    ],
  );
  assert.match(scopedClarification.missing_context.join(" "), /akun|account/i);
  const scoped = filterDocumentsByProject(
    [
      { id: "scope-a", title: "Project A login", url: null, content: "Project A login", category: "project-a", synced_at: "" },
      { id: "scope-b", title: "Project B login", url: null, content: "Project B login", category: "project-b", synced_at: "" },
    ],
    "B",
  );
  assert.deepEqual(scoped.map((document) => document.id), ["scope-b"]);

  // Regression: ordinary question openers are not project aliases, and changing
  // topic preserves the established project while using generic point knowledge.
  assert.deepEqual(projectNames("Cara cek perhitungan poin?"), []);
  assert.deepEqual(projectNames("Kenapa saldo poin 0?"), []);
  assert.deepEqual(projectNames("Bagaimana cara login?"), []);
  const inwanTopicHistory = [
    { role: "user" as const, content: "Project Inwan: aplikasi tidak bisa login sejak kemarin, muncul error invalid token" },
    { role: "assistant" as const, content: "Belum ada knowledge perusahaan yang cukup relevan." },
    { role: "user" as const, content: "Kenapa riwayat poin beda?" },
    { role: "assistant" as const, content: "Knowledge point belum tersedia." },
  ];
  assert.equal(resolveProjectScope("Cara cek perhitungan poin?", inwanTopicHistory).project, "Inwan");
  assert.equal(resolveProjectScope("Kenapa saldo poin 0?", inwanTopicHistory).project, "Inwan");
  const genericPointReply = generateNoAiAnswer("Kenapa saldo poin 0?", [
    { id: "global-points", title: POINT_ARTICLE_TITLE_MATCHES[0], url: null, category: "points", synced_at: "", content: "Customer Safe Summary: Saldo poin dapat menampilkan 0 karena sinkronisasi.\nCustomer Action: Minta nomor pesanan terkait untuk verifikasi.\nCustomer Reply: Mohon kirimkan nomor pesanan terkait agar kami dapat memeriksa saldo poin Anda" },
  ], inwanTopicHistory);
  assert.equal(genericPointReply.citations.length, 1);
  assert.match(genericPointReply.answer, /Saldo poin/i);
  assert.notEqual(genericPointReply.answer, "Maksudnya Project Inwan atau Project Cara?");
  const feedback = generateNoAiAnswer("ya terus gimana dong, masa cuma itu?", [
    { id: "feedback-source", title: "Project Inwan Login", url: null, category: "project-inwan", synced_at: "", content: "Customer Safe Summary: Invalid token perlu diverifikasi.\nCustomer Action: Minta log autentikasi.\nCustomer Reply: Mohon kirimkan log autentikasi." },
  ], inwanTopicHistory);
  assert.equal(feedback.missing_context.some((item) => /Project belum jelas/i.test(item)), false);
  assert.notEqual(feedback.answer, "Maksudnya Project Inwan atau Project Cara?");

  for (const message of ["thank you", "thanks", "ok thanks", "thank you, got it", "oke deh thank you", "sip thank you", "ok deh thank you", "makasih ya", "terima kasih ya"]) {
    assert.equal(isClosingMessage(message), true, message);
    const acknowledgement = generateNoAiAnswer(message, [], inwanTopicHistory);
    assert.equal(acknowledgement.intent, "Conversation closed", message);
    assert.match(acknowledgement.answer, /membantu|sesuai|kurang jelas/i, message);
    assert.equal(acknowledgement.draft_reply.length > 0, true, message);
  }
  for (const message of ["ya terus gimana dong, masa cuma itu?", "masih kurang jelas", "belum menjawab pertanyaanku", "terus gimana?", "masa cuma itu?", "jawabannya masih kurang"]) {
    assert.equal(isFeedbackMessage(message), true, message);
    const feedbackReply = generateNoAiAnswer(message, [
      { id: "feedback-source", title: "Project Inwan Login", url: null, category: "project-inwan", synced_at: "", content: "Customer Safe Summary: Invalid token perlu diverifikasi.\nCustomer Action: Minta log autentikasi.\nCustomer Reply: Mohon kirimkan log autentikasi." },
    ], inwanTopicHistory);
    assert.equal(feedbackReply.missing_context.some((item) => /Project belum jelas/i.test(item)), false, message);
    assert.notEqual(feedbackReply.answer, "Maksudnya Project Inwan atau Project Cara?", message);
  }
  assert.equal(resolveProjectScope("inwan", [
    ...inwanTopicHistory,
    { role: "user" as const, content: "Cara cek perhitungan poin?" },
  ]).project, "Inwan");
  assert.equal(resolveProjectScope("A", [
    { role: "user" as const, content: "Project A: login gagal" },
    { role: "user" as const, content: "Project B: laporan terlambat" },
  ]).project, "A");
  assert.deepEqual(filterDocumentsByProject([
    { id: "bare-inwan", title: "Inwan Login", url: null, content: "Login error", category: "inwan", synced_at: "" },
    { id: "project-b", title: "Project B Login", url: null, content: "Project B login", category: "project-b", synced_at: "" },
  ], "Inwan").map((document) => document.id), ["bare-inwan"]);
  assert.equal(filterDocumentsByProject([
    { id: "global", title: "Point article", url: null, content: "Saldo poin", category: "points", synced_at: "" },
    { id: "other", title: "Project B export", url: null, content: "Project B export", category: "project-b", synced_at: "" },
  ], "Inwan").map((document) => document.id).includes("global"), true);

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

  const ownerOnlySource = generateNoAiAnswer(
    "Berapa lama biasanya ini bisa selesai?",
    [{ ...projectALogin, content: projectALogin.content.replace("Customer Reply: Silakan buka kunci akun Project A.", "Customer Reply: Akan ditangani oleh tim terkait.") }],
    [{ role: "user", content: "Kami ada masalah login di Project A." }],
  );
  assert.equal(ownerOnlySource.draft_reply, "");

  const timelineWithSource = generateNoAiAnswer(
    "Berapa lama biasanya ini bisa selesai?",
    [{
      ...projectALogin,
      content: projectALogin.content.replace("Customer Reply: Silakan buka kunci akun Project A.", "Customer Reply: Biasanya selesai dalam 2 hari kerja."),
    }],
    [{ role: "user", content: "Kami ada masalah login di Project A." }],
  );
  assert.match(timelineWithSource.draft_reply, /2 hari kerja/i);

  const mixedLanguageLogin = generateNoAiAnswer(
    "Project A: customer complain login-nya keep failing terus, udah dicoba reset password tapi masih error.",
    [projectALogin],
  );
  assert.match(mixedLanguageLogin.draft_reply, /login|akun|error/i);
  assert.doesNotMatch(mixedLanguageLogin.draft_reply, /reset password/i);

  const longHistory = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? "user" as const : "assistant" as const,
    content: index < 6 ? "Project A: checkout gagal karena payment gateway timeout." : "Project B: laporan mingguan terlambat terkirim.",
  }));
  const longHistoryAnswer = generateNoAiAnswer(
    "Untuk Project B tadi, siapa yang biasanya menangani ini kalau lewat dari jadwal?",
    [{
      id: "project-b-owner",
      title: "Project B - Report owner",
      url: "https://notion.so/project-b-owner",
      content: "Customer Safe Summary: Laporan mingguan Project B terlambat.\nCustomer Reply: Tim reporting menangani laporan Project B yang lewat jadwal.",
      category: "project-b",
      synced_at: "",
    }],
    longHistory,
  );
  assert.match(longHistoryAnswer.draft_reply, /tim reporting|Project B/i);
  assert.equal(longHistoryAnswer.draft_reply.match(/checkout|payment gateway/i), null);

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

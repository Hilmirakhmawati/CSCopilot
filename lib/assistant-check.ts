import assert from "assert/strict";
import { fallback, generateGroundedAnswer, generateNoAiAnswer, mapCitations, extractFirstJsonObject } from "./anthropic";
import { POINT_ARTICLE_TITLE_MATCHES, classifyConversationIntent, continuationSignal, contextSatisfied, isClosingMessage, isCustomerContextRequest, isFeedbackMessage, isSarcasticOrDismissive, isAccountLabelOnly, isOrderLabelOnly, isGreetingOnly, greetingAnswer, withThanksGreeting, pointAnswer, pointArticleTitle, isPointTopic, selectPointArticle } from "./retrieval";
import { activeContextForPrompt, trimHistoryToBudget, updateActiveContext } from "./context";
import { readJson } from "./validation";
import type { Citation, KnowledgeDocument } from "./assistant-types";
import { filterDocumentsByProject, projectNames, resolveProjectScope } from "./project-scope";
import { enforceMissingContextInvariant, hasCustomerFacingSourceLeak, hasFabricatedCheckClaim, sanitizeAnswer } from "./answer-safety";
import { buildGuidance, splitItems } from "./case-guidance";
import { detectConversationLanguage, detectLanguage } from "./language";
import { isSuppliedContextMessage, suppliedIdentifier } from "./retrieval";

export { enforceMissingContextInvariant, hasCustomerFacingSourceLeak, hasFabricatedCheckClaim, sanitizeAnswer } from "./answer-safety";

export function validateCitations(citations: Citation[], documentIds: Set<string>) {
  return citations.filter((citation) => documentIds.has(citation.document_id));
}

if (process.argv[1]?.endsWith("assistant-check.ts")) {
  assert.equal(validateCitations([{ document_id: "known", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 1);
  assert.equal(validateCitations([{ document_id: "unknown", title: "x", url: null, quote: "q" }], new Set(["known"])).length, 0);
  assert.equal(hasCustomerFacingSourceLeak("SOURCE 1\\nID: 0863960c-7058-4822-b749-8d931bec649c"), true);
  assert.equal(hasCustomerFacingSourceLeak("Mohon kirim nomor akun atau nomor pesanan terkait."), false);
  assert.equal(hasFabricatedCheckClaim("Saldo sudah kami cek."), true);
  assert.equal(hasFabricatedCheckClaim("Saldo akan kami bantu cek."), false);
  assert.equal(hasFabricatedCheckClaim("Saya akan mengecek saldo akun."), true);
  for (const claim of ["Sudah saya cek saldo Anda.", "Kami sedang memeriksa akun Anda.", "Saldo poin Anda adalah 0.", "I've checked your account.", "I can see your balance is 0.", "We are checking the order.", "Your current balance is 0.", "I will check the history.", "Tim kami melakukan audit dan penyesuaian saldo.", "Our team performed a manual adjustment."]) assert.equal(hasFabricatedCheckClaim(claim), true, claim);
  for (const ok of ["CS dapat mengecek riwayat poin.", "CS can check the point history.", "Please check the point balance and related transactions.", "I don't have direct access to the customer's account data, so I cannot verify the balance."]) assert.equal(hasFabricatedCheckClaim(ok), false, ok);
  const fabricatedClaim = sanitizeAnswer({
    intent: "Support issue", summary: "", missing_context: [], recommended_action: "", answer: "Saldo sudah kami cek.", draft_reply: "Saldo sudah kami cek.", citations: [], confidence: "high",
  });
  assert.equal(fabricatedClaim.confidence, "low");
  assert.notEqual(fabricatedClaim.draft_reply, "");
  assert.equal(hasFabricatedCheckClaim(fabricatedClaim.draft_reply), false);
  assert.match(fabricatedClaim.answer, /Tindakan CS/i);
  assert.match(fabricatedClaim.safety_warning ?? "", /verifikasi/i);
  assert.doesNotMatch(fabricatedClaim.answer, /sudah kami cek/i);

  assert.deepEqual(splitItems("1. Cek riwayat | 2) Cek transaksi | - Catat hasil"), ["Cek riwayat", "Cek transaksi", "Catat hasil"]);
  const guideDoc = (content: string): KnowledgeDocument => ({ id: "g1", title: "Saldo poin 0", url: null, content, category: null, synced_at: "" });
  const guideBase = { intent: "Support issue", summary: "", missing_context: [], recommended_action: "", answer: "a", draft_reply: "d", citations: [{ document_id: "g1", title: "t", url: null, quote: "q" }], confidence: "high" as const };
  const fullDoc = guideDoc("Customer Safe Summary: s\nCustomer Action: Minta nomor akun\nCustomer Reply: Mohon kirim nomor akun.\nRequired Context: nomor atau email akun terkait\nTroubleshooting Steps: 1. Cek riwayat poin | 2. Cek transaksi terkait\nEscalate When: Ada adjustment manual tidak dikenal\nLast Verified: 2020-01-01");
  const afterAccount = buildGuidance(guideBase, [fullDoc], "akun", [{ role: "user", content: "Kenapa saldo poin 0?" }, { role: "assistant", content: "x" }, { role: "user", content: "13181993131" }, { role: "assistant", content: "y" }]);
  assert.deepEqual(afterAccount.next_actions, ["Cek riwayat poin", "Cek transaksi terkait"]);
  assert.equal(afterAccount.case_understanding?.stage, "info_received");
  assert.deepEqual(afterAccount.case_understanding?.missing, []);
  assert.equal(afterAccount.knowledge_status, "complete");
  assert.equal(afterAccount.knowledge_stale, true);
  assert.doesNotMatch(afterAccount.answer, /13181993131/);
  const csResult = buildGuidance(guideBase, [fullDoc], "sudah saya cek, hasilnya ada saldo lama", [{ role: "user", content: "13181993131 akun" }]);
  assert.equal(csResult.case_understanding?.stage, "cs_result");
  const escalated = buildGuidance(guideBase, [fullDoc], "sudah saya cek, ada adjustment manual tidak dikenal", [{ role: "user", content: "13181993131 akun" }]);
  assert.equal(escalated.case_understanding?.stage, "escalate");
  const legacy = buildGuidance(guideBase, [guideDoc("Customer Safe Summary: s\nCustomer Action: Minta nomor akun")], "kenapa saldo 0", []);
  assert.equal(legacy.knowledge_status, "partial");
  assert.deepEqual(legacy.knowledge_missing, ["Troubleshooting Steps", "Customer Reply"]);
  assert.equal(legacy.next_actions, undefined);
  assert.equal(buildGuidance({ ...guideBase, citations: [] }, [], "pertanyaan baru", []).knowledge_status, "unavailable");
  assert.equal(classifyConversationIntent("sudah saya cek, ada adjustment manual", [{ role: "user", content: "Kenapa saldo poin 0?" }], ""), "case_update");

  const docs: KnowledgeDocument[] = [
    { id: "doc-1", title: "A", url: null, content: "", category: null, synced_at: "" },
    { id: "doc-2", title: "B", url: "https://x", content: "q", category: null, synced_at: "" },
  ];
  const mapped = mapCitations([{ reference_index: 2, quote: "q" }, { reference_index: 9, quote: "dropped" }], docs);
  assert.deepEqual(mapped, [{ document_id: "doc-2", title: "B", url: "https://x", quote: "q" }]);
  assert.equal(extractFirstJsonObject(`prefix {"answer":"brace } inside"} suffix {"ignored":true}`), '{"answer":"brace } inside"}');
  assert.equal(extractFirstJsonObject("no JSON here"), undefined);

  assert.equal(pointArticleTitle("Saldo poin customer tampil 0 padahal sebelumnya ada"), POINT_ARTICLE_TITLE_MATCHES[0]);
  assert.equal(pointArticleTitle("Why is my points balance 0?"), POINT_ARTICLE_TITLE_MATCHES[0]);
  assert.equal(pointArticleTitle("My points balance is zero"), POINT_ARTICLE_TITLE_MATCHES[0]);
  assert.equal(pointArticleTitle("Riwayat poin tidak sesuai dengan pesanan"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(isPointTopic("Why is my points balance 0?"), true);
  assert.equal(pointArticleTitle("Kenapa riwayat poin beda?"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Kenapa riwayat poin tidak sesuai?"), POINT_ARTICLE_TITLE_MATCHES[1]);
  assert.equal(pointArticleTitle("Perhitungan penggunaan poin saya salah"), POINT_ARTICLE_TITLE_MATCHES[2]);
  assert.equal(pointArticleTitle("Riwayat poin pada pesanan umum tidak konsisten"), POINT_ARTICLE_TITLE_MATCHES[3]);
  assert.equal(pointArticleTitle("Ada selisih saldo poin, minta audit"), POINT_ARTICLE_TITLE_MATCHES[4]);
  // Phase 5: every suggested question (ID + EN) and the roadmap examples route to their own article.
  const intentCases: Array<[string, number]> = [
    ["Kenapa saldo poin 0?", 0], ["Kenapa riwayat poin beda?", 1], ["Cara cek perhitungan poin?", 2], ["Kenapa riwayat poin tidak sesuai?", 1], ["Cara audit saldo poin?", 4],
    ["Why is the point balance 0?", 0], ["Why does the point history differ?", 1], ["How to check the point calculation?", 2], ["Why doesn't the point history match?", 1], ["How to audit a point balance?", 4],
    ["Why is my point history different?", 1], ["How are points calculated?", 2],
  ];
  for (const [question, index] of intentCases) {
    assert.equal(pointArticleTitle(question), POINT_ARTICLE_TITLE_MATCHES[index], question);
    assert.equal(isPointTopic(question), true, question);
  }
  assert.equal(pointArticleTitle("How do I reset my password?"), null);
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
  assert.equal(classifyConversationIntent("akunnya Rara 083119349229", pointDraftHistory, pointDraft), "supplied_context");
  assert.equal(classifyConversationIntent("nomor akun sudah dikirimkan, nama akunnya rara, nomornya 0831193487229 apa selanjutnya?", pointDraftHistory, pointDraft), "supplied_context");
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
  assert.equal(contextSatisfied("nomor atau email akun terkait", "akunnya Rara 083119349229"), true);
  assert.equal(contextSatisfied("nomor atau email akun terkait", "nomor akun sudah dikirimkan, nama akunnya rara, nomornya 0831193487229 apa selanjutnya?"), true);
  assert.equal(contextSatisfied("nomor atau email akun terkait", "1234567890"), false);
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
  assert.equal(pointAnswer("Why is my points balance 0?", zeroBalanceDocuments)?.citations[0]?.document_id, "point-0");
  assert.equal(continuationSignal("123344555"), true);
  assert.equal(continuationSignal("customer@example.com"), true);
  const verifiedBareIdentifier = pointAnswer("123344555", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(verifiedBareIdentifier?.missing_context.length, 0);
  assert.notEqual(verifiedBareIdentifier?.draft_reply, "");
  const verifiedPoint = pointAnswer("1223243144 ini adalah no pesanannya", zeroBalanceDocuments, [{ role: "user", content: "Kenapa saldo poin 0?" }]);
  assert.equal(verifiedPoint?.missing_context.length, 0);
  assert.notEqual(verifiedPoint?.draft_reply, "");
  assert.equal(verifiedPoint?.draft_reply.includes("Minta nomor pesanan terkait untuk verifikasi"), false);
  const englishAccountFollowUp = pointAnswer("13141411414 this account data", [{ ...zeroBalanceDocuments[0], content: zeroBalanceDocuments[0].content.replace("Nomor order", "Nomor akun").replace("nomor pesanan terkait", "nomor akun terkait") }], [{ role: "user", content: "Why is my point balance 0?" }]);
  assert.equal(detectLanguage("121311425255 account daya"), "en");
  assert.equal(detectLanguage("083119349222 akun saya"), "id");
  assert.equal(suppliedIdentifier("121311425255 account daya")?.kind, "account");
  assert.equal(isSuppliedContextMessage("121311425255 account daya"), true);
  const typoFollowUp = pointAnswer("121311425255 account daya", [{ ...zeroBalanceDocuments[0], content: zeroBalanceDocuments[0].content.replace("Nomor order", "Nomor akun").replace("nomor pesanan terkait", "nomor akun terkait") }], [{ role: "user", content: "Why is my point balance 0?" }]);
  assert.equal(typoFollowUp?.intent, "Identifier received");
  assert.doesNotMatch(`${typoFollowUp?.answer} ${typoFollowUp?.draft_reply}`, /Belum ada knowledge|Status Knowledge|pesan error/i);
  // Exact reported transcript: "<number> CUSTOMER NUMBER" is the account number, in English.
  const customerNumberDoc = [{ ...zeroBalanceDocuments[0], content: zeroBalanceDocuments[0].content.replace("Nomor order", "Nomor akun").replace("nomor pesanan terkait", "nomor akun terkait") }];
  for (const text of ["12344125255 CUSTOMER NUMBER", "customer number 12344125255", "12344125255 customer number", "nomor customer 12344125255"]) {
    assert.equal(suppliedIdentifier(text)?.kind, "account", text);
    assert.equal(isSuppliedContextMessage(text), true, text);
  }
  assert.equal(detectLanguage("12344125255 CUSTOMER NUMBER"), "en");
  assert.equal(detectLanguage("nomor customer 12344125255"), "id");
  const customerNumber = pointAnswer("12344125255 CUSTOMER NUMBER", customerNumberDoc, [
    { role: "user", content: "Why is my point balance 0?" },
    { role: "assistant", content: "Please provide the account number." },
  ]);
  assert.equal(customerNumber?.intent, "Identifier received");
  assert.equal(customerNumber?.missing_context.length, 0);
  assert.match(customerNumber?.answer ?? "", /account number has been received/i);
  assert.doesNotMatch(`${customerNumber?.answer} ${customerNumber?.draft_reply}`, /Belum ada knowledge|Status Knowledge|diperjelas/i);
  assert.notEqual(customerNumber?.draft_reply, "");
  assert.equal(englishAccountFollowUp?.intent, "Identifier received");
  assert.equal(englishAccountFollowUp?.missing_context.length, 0);
  assert.match(englishAccountFollowUp?.answer ?? "", /account number has been received|account number has been received as case information/i);
  assert.match(englishAccountFollowUp?.draft_reply ?? "", /account number|account data/i);
  assert.equal(point?.answer.includes("akan disesuaikan"), false);

  // Conversation-level language: neutral follow-ups inherit; explicit switches win.
  const enHistory = [{ role: "user" as const, content: "Why is my point balance 0?" }, { role: "assistant" as const, content: "Please provide the account number." }];
  assert.equal(detectConversationLanguage("12344125255", enHistory), "en");
  assert.equal(detectConversationLanguage("ok", enHistory), "en");
  assert.equal(detectConversationLanguage("Kenapa saldo poin 0?", enHistory), "id");
  assert.equal(detectConversationLanguage("12344125255"), "id");
  assert.equal(detectConversationLanguage("12344125255", [{ role: "user", content: "Kenapa saldo poin 0?" }]), "id");
  assert.equal(continuationSignal("ok how can i check it?", enHistory), true);
  // Reported: "what should i do for next" after an account number fell to "which part of the previous topic".
  for (const text of ["what should i do for next", "what should I do next?", "what's next", "next steps?", "apa langkah selanjutnya"]) assert.equal(continuationSignal(text, enHistory), true, text);
  const nextSteps = pointAnswer("what should i do for next", customerNumberDoc, [
    { role: "user", content: "Why is the customer's point balance showing 0?" },
    { role: "assistant", content: "Please provide the account number." },
    { role: "user", content: "1561381478178" },
  ], "", "en");
  assert.equal(nextSteps?.missing_context.length, 0);
  assert.ok(nextSteps?.citations.length);
  assert.match(`${nextSteps?.answer} ${nextSteps?.recommended_action}`, /poin|saldo|point|balance|history|riwayat|verifikasi|check/i);
  assert.equal(continuationSignal("Pembayaran saya gagal"), false);
  const neutralEn = pointAnswer("12344125255", customerNumberDoc, enHistory, "", detectConversationLanguage("12344125255", enHistory));
  assert.equal(neutralEn?.intent, "Identifier received");
  for (const text of [neutralEn?.answer, neutralEn?.draft_reply, ...(neutralEn?.missing_context ?? [])]) assert.notEqual(detectLanguage(text ?? ""), "id", text);
  // Reported: after "153184104" the draft and "Required" must stop asking for the account number.
  assert.equal(neutralEn?.missing_context.length, 0);
  assert.doesNotMatch(neutralEn?.draft_reply ?? "", /provide the customer's account number/i);
  assert.notEqual(neutralEn?.draft_reply, "");
  const bareAfterPoint = pointAnswer("153184104", customerNumberDoc, enHistory, "", "en");
  assert.equal(bareAfterPoint?.missing_context.length, 0);
  const neutralGuided = buildGuidance({ ...guideBase, citations: [{ document_id: "g1", title: "t", url: null, quote: "q" }] }, [fullDoc], "12344125255", enHistory, Date.now(), "en");
  assert.ok(neutralGuided.case_understanding?.received.every((label) => /not verified|unclear/.test(label)));
  // No API key / CSCOPILOT_NO_AI: guidance for an English conversation must not stay Indonesian.
  void (async () => {
    const previousNoAi = process.env.CSCOPILOT_NO_AI;
    process.env.CSCOPILOT_NO_AI = "1";
    try {
      const translatedGuide = await generateGroundedAnswer("Why is my point balance 0?", [{ ...fullDoc, id: "g1", title: POINT_ARTICLE_TITLE_MATCHES[0] }], [], "", "", "en");
      assert.ok(translatedGuide.next_actions?.length);
      for (const item of [...(translatedGuide.next_actions ?? []), ...(translatedGuide.escalate_when ?? [])]) assert.notEqual(detectLanguage(item), "id", item);
      console.log("neutral English guidance check passed");
    } finally {
      if (previousNoAi === undefined) delete process.env.CSCOPILOT_NO_AI;
      else process.env.CSCOPILOT_NO_AI = previousNoAi;
    }
  })();

  // Regression: the visible answer must follow identifier follow-ups instead
  // of repeating the initial point-balance summary.
  const accountRequiredDocuments: KnowledgeDocument[] = [{
    ...zeroBalanceDocuments[0],
    content: zeroBalanceDocuments[0].content
      .replace("Nomor order", "Nomor akun")
      .replace("nomor pesanan terkait", "nomor akun terkait"),
  }];
  const pointConversation = [{ role: "user" as const, content: "Kenapa saldo poin 0?" }];
  const bareIdentifier = pointAnswer("12142424 ini ya", accountRequiredDocuments, pointConversation);
  assert.ok(bareIdentifier);
  assert.match(bareIdentifier?.answer ?? "", /nomor akun/i);
  assert.notEqual(bareIdentifier?.draft_reply, "");
  const suppliedAccountAnswer = pointAnswer("Akunnya Rani 083119349229", accountRequiredDocuments, pointConversation);
  assert.ok(suppliedAccountAnswer);
  assert.match(suppliedAccountAnswer?.answer ?? "", /informasi (?:nomor )?akun.*diterima|memeriksa saldo poin/i);
  assert.doesNotMatch(suppliedAccountAnswer?.answer ?? "", /Beberapa akun sempat menampilkan saldo poin 0/i);
  assert.equal(suppliedAccountAnswer?.missing_context.length, 0);
  assert.match(suppliedAccountAnswer?.draft_reply ?? "", /informasi (?:nomor )?akun sudah kami terima/i);

  // Exact reported transcript: a later "no akun" confirms the preceding bare
  // number, and "itu aja?" asks for clarification about the active point topic.
  const accountConfirmed = pointAnswer(
    "no akun",
    accountRequiredDocuments,
    [...pointConversation, { role: "user", content: "1213442525" }],
  );
  assert.equal(accountConfirmed?.intent, "Identifier received");
  assert.match(accountConfirmed?.answer ?? "", /dicatat sebagai nomor akun|memeriksa saldo poin/i);
  assert.doesNotMatch(accountConfirmed?.answer ?? "", /1213442525/);
  assert.equal(accountConfirmed?.missing_context.length, 0);
  assert.match(accountConfirmed?.draft_reply ?? "", /nomor akun sudah kami terima/i);

  // Greetings are recognized structurally; names and team labels need no allowlist.
  for (const greeting of [
    "selamat sore", "Selamat pagi kak", "selamat malam", "selamat siang min", "selamat petang",
    "halo", "haloo", "hallo kak", "hai kak budi", "hello", "hi there", "good morning",
    "good evening team", "pagi", "pagi kak", "pagiii", "assalamualaikum", "assalamualaikum wr wb",
    "Assalamu'alaikum kak", "permisi", "permisi kak", "halo selamat pagi", "halo kak apa kabar",
    "selamat datang", "hey!", "👋", "hai tim support",
  ]) assert.equal(isGreetingOnly(greeting), true, greeting);
  for (const issue of [
    "selamat sore, saldo poin saya 0", "halo saldo poin saya 0", "halo mau tanya",
    "pagi, kenapa pesanan belum sampai", "halo 08123456789", "halo apa kabar? tolong cek akun",
    "kenapa saldo poin 0", "terima kasih", "oke",
  ]) assert.equal(isGreetingOnly(issue), false, issue);

  // "no pesanan" confirms the preceding bare number as an order number.
  assert.equal(isOrderLabelOnly("no pesanan"), true);
  assert.equal(isOrderLabelOnly("nomor pesanannya"), true);
  assert.equal(isOrderLabelOnly("pesanan saya belum sampai"), false);
  assert.equal(continuationSignal("no pesanan"), true);
  const orderConfirmed = pointAnswer(
    "no pesanan",
    zeroBalanceDocuments,
    [...pointConversation, { role: "user", content: "1617399381803" }],
  );
  assert.equal(orderConfirmed?.intent, "Identifier received");
  assert.match(orderConfirmed?.answer ?? "", /dicatat sebagai nomor pesanan/i);
  assert.doesNotMatch(orderConfirmed?.draft_reply ?? "", /1617399381803/);
  assert.equal(orderConfirmed?.missing_context.length, 0);
  assert.equal(withThanksGreeting("Terima kasih sudah menghubungi kami. Mohon tunggu."), "Terima kasih sudah menghubungi kami. Mohon tunggu.");
  assert.equal(withThanksGreeting("Mohon tunggu."), "Terima kasih sudah menghubungi kami. Mohon tunggu.");
  assert.doesNotMatch(fallback("saldo poin 0", zeroBalanceDocuments).draft_reply, /menghubungi kami\.\s+Terima kasih/i);

  // Exact reported transcript with the combined account/order Required Context.
  const combinedDocuments: KnowledgeDocument[] = [{
    ...zeroBalanceDocuments[0],
    content: zeroBalanceDocuments[0].content
      .replace("Nomor order", "Nomor akun atau nomor pesanan")
      .replace("nomor pesanan terkait", "nomor akun atau nomor pesanan terkait"),
  }];
  const typoAccount = pointAnswer("ini adlaha nomer akunya 13181993131", combinedDocuments, pointConversation);
  assert.equal(typoAccount?.missing_context.length, 0);
  assert.doesNotMatch(typoAccount?.draft_reply ?? "", /13181993131|mohon kirimkan/i);
  const combinedConfirmed = pointAnswer("akun", combinedDocuments, [
    ...pointConversation,
    { role: "user", content: "13181993131" },
    { role: "assistant", content: "Nomor sudah diterima. Mohon pastikan, itu nomor akun atau nomor pesanan?" },
  ]);
  assert.equal(combinedConfirmed?.intent, "Identifier received");
  assert.doesNotMatch(combinedConfirmed?.answer ?? "", /Saldo poin dapat menampilkan 0|13181993131/);
  assert.equal(combinedConfirmed?.missing_context.length, 0);
  assert.equal(combinedConfirmed?.citations.length, 1);
  assert.equal(isAccountLabelOnly("nomer akunya"), true);

  const topicFeedback = pointAnswer(
    "itu aja?",
    accountRequiredDocuments,
    [
      ...pointConversation,
      { role: "assistant", content: "Mohon kirimkan nomor akun terkait." },
      { role: "user", content: "1213442525" },
      { role: "assistant", content: "Mohon pastikan itu nomor akun." },
      { role: "user", content: "no akun" },
      { role: "assistant", content: "Nomor tersebut dicatat sebagai nomor akun." },
    ],
  );
  assert.equal(topicFeedback?.answer, "Boleh diperjelas, bagian mana dari topik poin sebelumnya yang masih kurang jelas, atau apakah ini pertanyaan baru?");
  assert.equal(topicFeedback?.draft_reply, "");
  assert.equal(topicFeedback?.citations.length, 1);
  assert.equal(topicFeedback?.missing_context[0], "Klarifikasi diperlukan terkait topik yang sedang dibahas.");
  assert.equal(isAccountLabelOnly("akun saya bermasalah"), false);
  assert.equal(isAccountLabelOnly("no akun"), true);
  assert.equal(pointAnswer("itu aja?", accountRequiredDocuments, [{ role: "user", content: "Kenapa login gagal?" }]), null);

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
    assert.match(acknowledgement.answer, /membantu|sesuai|kurang jelas|help|unclear/i, message);
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

  // English question + Indonesian-only article + no translation available: CS must be told the answer is untranslated,
  // but the customer-facing draft stays clean and Indonesian questions get no note.
  void (async () => {
    const previousNoAi = process.env.CSCOPILOT_NO_AI;
    process.env.CSCOPILOT_NO_AI = "1";
    try {
      const english = await generateGroundedAnswer("Why is my points balance 0?", zeroBalanceDocuments);
      assert.match(english.answer, /don't have direct access/i);
      assert.equal(detectLanguage(english.answer), "en");
      assert.equal(hasFabricatedCheckClaim(english.answer), false);
      assert.doesNotMatch(english.answer, /audit|penyesuaian|tim kami/i);
      assert.doesNotMatch(english.draft_reply, /could not be translated|mengecek|kami dapat/i);
      const received = await generateGroundedAnswer("My account number is 123456789", zeroBalanceDocuments, [{ role: "user", content: "Why is my points balance 0?" }]);
      if (received.intent === "Identifier received") assert.match(received.answer, /has been received\. I don't have direct access/i);
      const indonesian = await generateGroundedAnswer("Kenapa saldo poin 0?", zeroBalanceDocuments);
      assert.doesNotMatch(indonesian.answer, /could not be translated/i);
      console.log("untranslated point answer check passed");
    } finally {
      if (previousNoAi === undefined) delete process.env.CSCOPILOT_NO_AI;
      else process.env.CSCOPILOT_NO_AI = previousNoAi;
    }
  })();

  // Response language follows the latest message; ambiguous input stays Indonesian.
  assert.equal(detectLanguage("Why is my points balance 0?"), "en");
  assert.equal(detectLanguage("Please check this account"), "en");
  assert.equal(detectLanguage("Kenapa saldo poin 0?"), "id");
  assert.equal(detectLanguage("Why saldo poin saya 0?"), "id");
  assert.equal(detectLanguage("123344555"), "id");
  assert.equal(detectLanguage("order"), "id");
  assert.equal(detectLanguage(""), "id");
  // Marker tally: the side with more markers wins, so one stray token no longer flips the language.
  assert.equal(detectLanguage("Why is this error ada di app"), "en");
  assert.equal(detectLanguage("Topup error terus"), "id");
  assert.equal(detectLanguage("Pesanan 123 gagal"), "id");
  // No markers on either side: franc-min decides for 3+ words, shorter input stays Indonesian.
  assert.equal(detectLanguage("Refund not received after 3 days"), "en");
  assert.equal(detectLanguage("Payment gateway timeout on checkout"), "en");
  assert.equal(detectLanguage("Points balance 0 after purchase"), "en");
  assert.equal(detectLanguage("Order 123 failed"), "id");
  const indonesianWords = /\b(?:mohon|tolong|kami|anda|belum|sudah|terima kasih|knowledge perusahaan|maksudnya|boleh|diperjelas|kendala)\b/i;
  const englishUnknown = fallback("Why can't I log in to the app?", [], []);
  assert.doesNotMatch(`${englishUnknown.answer} ${englishUnknown.draft_reply} ${englishUnknown.missing_context.join(" ")}`, indonesianWords);
  assert.match(englishUnknown.answer, /company knowledge/i);
  const englishGreeting = greetingAnswer("Hello", []);
  assert.doesNotMatch(`${englishGreeting.answer} ${englishGreeting.draft_reply}`, indonesianWords);
  assert.match(greetingAnswer("Halo", []).answer, /Halo|Ada yang mau/i);
  const englishLeak = sanitizeAnswer({ ...englishUnknown, answer: "SOURCE 1", draft_reply: "SOURCE 1" }, "en");
  assert.doesNotMatch(englishLeak.answer, indonesianWords);
  assert.equal(hasFabricatedCheckClaim("I've already checked your account."), true);
  assert.equal(hasFabricatedCheckClaim("Our team has verified the order."), true);
  assert.equal(hasFabricatedCheckClaim("The system has processed refunds within 3 days for all orders."), false);
  assert.equal(hasFabricatedCheckClaim("The team has reviewed the policy and updated this guide."), false);
  assert.equal(hasFabricatedCheckClaim("Please send the order number."), false);

  console.log("assistant-check passed");
}

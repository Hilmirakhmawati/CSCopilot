# Suggest Reply — Manual QA Test Plan

**Purpose:** Verify Suggest Reply matches the client's latest question/context, and correctly isolates multi-project conversations. Use this plan BEFORE the prompt/context fix (baseline) and AFTER (regression/verification).

**Source:** Audit findings in `docs/` (Suggest Reply audit) — root causes: no latest-message priority instruction, no project isolation, broad unscoped history, heuristic retrieval.

**How to run:** For each test case, create a conversation via the app UI, send the messages in order, then inspect the returned `draft_reply` (Suggested reply panel) and `answer`/`citations`. Record Pass/Fail and paste the actual `draft_reply` text into the "Actual result" column of your run log.

**Run log columns to track per case:** Date | Build/commit | Actual draft_reply | Actual citations | Pass/Fail | Notes

## Known implementation constraints (from code audit — read before running)

- **No `project` column exists.** `knowledge_documents` (`supabase/migrations/001_cscopilot.sql`) has no project/product field. Project identity is inferred entirely from free text in the conversation and document title/content — there is no DB-level filter. TC-04/06/08 test whether the prompt+context fix can compensate for this via conversation text alone; they cannot test a project filter that doesn't exist.
- **History window:** server fetches the last 20 non-system messages, then keeps only the last 10 for the Claude request (`lib/message-processing.ts:115-127`). TC-09 is sized to push relevant context past that 10-message cutoff.
- **"Continuation" borrowing is conditional, not automatic:** `retrieveKnowledge` (`lib/retrieval.ts:101-125`) only folds prior user turns into the search query when the direct search on the current message returns zero rows AND the message is short/contains a reference word (`itu|nya|tersebut|ini|sebelumnya|barusan`, or ≤3 words — see `continuationSignal`). If the current message's own words happen to match unrelated documents, prior context is never consulted. This is the likely mechanism behind TC-02/05/06 failures pre-fix.
- **Closing messages** (`isClosingMessage`) and **greetings** (`isGreetingOnly`) skip retrieval entirely — relevant for TC-09's "Oke terima kasih" turn, which should short-circuit rather than reuse the prior topic's documents.
- **`draft_reply` fallback path:** when `ANTHROPIC_API_KEY` is unset or the model call/JSON parsing fails, `lib/anthropic.ts`'s `fallback()` ranks documents by raw word overlap with the (possibly continuation-expanded) query — a separate, simpler mechanism from the model prompt path. Note in the run log which path (`model` vs `fallback`) produced each result, since the fix may only target the model prompt.

---

## TC-01 — Single-project direct question

**Scenario:** Only one project discussed. Client asks a direct question about it.

**Conversation setup:** New conversation.

**Client message:**
```
Project A: aplikasi tidak bisa login sejak kemarin, muncul error "invalid token".
```

**Expected Suggest Reply behavior:**
- Directly addresses the login/invalid-token issue for Project A.
- Uses only knowledge relevant to that issue.
- No mention of any other project or unrelated topic.

**Failure conditions:**
- Draft answers a different/generic issue.
- Draft includes information not tied to the described error.
- Draft references a project not mentioned.

---

## TC-02 — Follow-up question ("this" reference)

**Scenario:** Client asks a vague follow-up that depends on the prior message.

**Conversation setup:** New conversation, two turns.

**Client message 1:**
```
Kami ada masalah login di Project A.
```
**Client message 2 (after assistant reply):**
```
Berapa lama biasanya ini bisa selesai?
```

**Expected Suggest Reply behavior:**
- "ini" resolved to "the Project A login issue" from turn 1.
- Draft reply answers a timeline/next-step question specific to that login issue, not a generic answer.

**Failure conditions:**
- Draft treats message 2 as topic-less (generic "please clarify" with no reference to login issue).
- Draft answers about a different issue than login.

---

## TC-03 — Topic switch (Project A → Project B)

**Scenario:** Project A discussed first, then client switches to Project B.

**Conversation setup:** New conversation, two turns.

**Client message 1:**
```
Project A: pembayaran customer gagal terus di checkout.
```
**Client message 2 (after assistant reply):**
```
Ganti topik — untuk Project B, kenapa laporan bulanan tidak muncul di dashboard?
```

**Expected Suggest Reply behavior:**
- Draft reply for message 2 addresses Project B's dashboard/report issue only.
- No mention of Project A's payment issue in the draft.

**Failure conditions:**
- Draft answers using Project A payment context.
- Draft mixes both issues in one reply.
- Draft cites Project A knowledge documents for a Project B question.

---

## TC-04 — Two projects with similar terminology ("login" in both)

**Scenario:** Project A and Project B both have login issues with different causes/solutions.

**Conversation setup:** New conversation, two turns. Requires knowledge base to have distinct "login" articles for two different projects/products — confirm this exists before running; if not, this case can only test conversation-side isolation, not retrieval-side.

**Client message 1:**
```
Project A: user tidak bisa login, muncul pesan "account locked".
```
**Client message 2 (after assistant reply):**
```
Sekarang untuk Project B, user juga tidak bisa login tapi errornya "session expired".
```

**Expected Suggest Reply behavior:**
- Message 2's draft addresses "session expired" (Project B), not "account locked" (Project A).
- Citations for message 2 belong to Project B's login article, not Project A's.

**Failure conditions:**
- Draft reuses Project A's solution ("account locked" / unlock steps) for the Project B question.
- Citations point to the wrong project's document.
- Draft conflates both errors into one explanation.

---

## TC-05 — Project named only earlier in conversation

**Scenario:** Project name appears several messages back; latest message uses only "this issue".

**Conversation setup:** New conversation, three turns.

**Client message 1:**
```
Kami sedang investigasi masalah di Project A terkait sinkronisasi data.
```
**Client message 2 (after assistant reply):**
```
Datanya sudah dicek, error muncul di modul export.
```
**Client message 3 (after assistant reply):**
```
Apakah ada solusi untuk issue ini?
```

**Expected Suggest Reply behavior:**
- Draft for message 3 is understood as Project A's data-sync/export issue, carried from message 1–2.

**Failure conditions:**
- Draft is generic / asks "which issue" despite clear earlier context within the same conversation.
- Draft references a different project.

---

## TC-06 — Ambiguous project reference

**Scenario:** Two projects discussed; client's follow-up doesn't specify which.

**Conversation setup:** New conversation, three turns.

**Client message 1:**
```
Project A ada kendala di modul pembayaran.
```
**Client message 2 (after assistant reply):**
```
Project B juga ada kendala di modul pembayaran, beda kasus.
```
**Client message 3 (after assistant reply):**
```
Bisa cek status untuk ini?
```

**Expected Suggest Reply behavior:**
- Draft does NOT silently pick one project.
- Draft either asks which project ("Project A or Project B?") or explicitly states the ambiguity in `missing_context`/draft text.

**Failure conditions:**
- Draft guesses one project without flagging ambiguity.
- Draft merges status of both projects into one answer.

---

## TC-07 — No relevant knowledge available

**Scenario:** Client asks about something not covered in the knowledge base.

**Conversation setup:** New conversation.

**Client message:**
```
Project A: kenapa fitur voice call tidak muncul di versi terbaru?
```
(Use a topic known not to exist in the synced knowledge documents.)

**Expected Suggest Reply behavior:**
- Draft does not invent a cause, policy, or fix.
- Draft communicates the limitation (e.g., "perlu verifikasi manual", asks for more detail) per existing `confidence: low` / `missing_context` behavior.
- `citations` is empty.

**Failure conditions:**
- Draft states a specific cause/fix with no supporting citation.
- Draft fabricates a policy or timeline.

---

## TC-08 — Conflicting knowledge across projects

**Scenario:** Retrieved documents contain information belonging to different projects for overlapping terms.

**Conversation setup:** New conversation. Pick a query term known to match knowledge documents from two different projects (coordinate with TC-04's knowledge prerequisite, or pick an existing overlapping term in the current knowledge base, e.g. "poin"/"point" articles if more than one project uses points).

**Client message:**
```
Project A: saldo poin customer tampil 0, ini kenapa ya?
```

**Expected Suggest Reply behavior:**
- Draft stays scoped to Project A's point-balance explanation only.
- If retrieval returns documents from multiple projects, draft does not combine them into one answer — it either picks the Project A-relevant one or asks for clarification.

**Failure conditions:**
- Draft blends causes/solutions from two different projects' articles into a single explanation.
- Draft cites a document belonging to a different project without labeling the mismatch.

---

## TC-09 — Long conversation / multiple topics

**Scenario:** Conversation exceeds the 10-message history window with several topic changes; latest question must still dominate.

**Conversation setup:** New conversation, at least 6 client turns (12+ total messages) covering: greeting → Project A issue #1 → Project A issue #2 → Project B issue #1 → small talk/closing ("oke terima kasih") → new question.

**Client messages (in order):**
```
1. Halo
2. Project A: user tidak bisa checkout.
3. Ternyata errornya di payment gateway timeout.
4. Ganti ke Project B: laporan mingguan telat terkirim.
5. Oke terima kasih.
6. Untuk Project B tadi, siapa yang biasanya menangani ini kalau lewat dari jadwal?
```

**Expected Suggest Reply behavior:**
- Draft for message 6 addresses Project B's report-scheduling question.
- Project A's checkout/timeout topic (messages 2–3) does not leak into the draft.

**Failure conditions:**
- Draft answers about Project A's payment timeout.
- Draft is generic and ignores the specific "who handles late reports" question.
- Draft merges Project A and Project B content.

---

## TC-10 — Indonesian / mixed-language message

**Scenario:** Client mixes Indonesian and English in one message.

**Conversation setup:** New conversation.

**Client message:**
```
Project A: customer complain login-nya keep failing terus, udah dicoba reset password tapi masih error.
```

**Expected Suggest Reply behavior:**
- Draft responds in natural Indonesian (mirroring the client's dominant language) per existing system prompt rule.
- Draft still directly addresses the login failure after password reset, not a generic reply.

**Failure conditions:**
- Draft responds in pure English when client used mostly Indonesian.
- Draft ignores that password reset was already tried (should not ask the customer to do it again as if untried).

---

## Cross-cutting checks (apply to every test case)

- [ ] `draft_reply` addresses the **latest** client message, not an earlier one.
- [ ] No project's information appears in a reply intended for a different project.
- [ ] `citations` reference documents consistent with the project/topic being answered.
- [ ] No invented facts, policies, or timelines beyond what knowledge/conversation supports.
- [ ] Existing source-leak protection still holds — no SOURCE/ID/UUID/URL/score text visible in `answer` or `draft_reply`.
- [ ] `missing_context` is used appropriately for ambiguous-project cases, not left empty when clarification is actually needed.

## Suggested run order

Run TC-01, 02, 03 first (cheapest signal on the core "latest question" problem). Run TC-04, 06, 08 next (multi-project isolation — the meeting's specific ask). Run TC-05, 07, 09, 10 last (context window, no-knowledge, language).

Re-run the full set after the prompt/context fix and diff each case's actual `draft_reply` against its baseline run.

# Suggest Reply Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Suggest Reply preserve the latest follow-up intent and keep knowledge, citations, fallback output, and Claude input scoped to the active project.

**Architecture:** Add one pure project-scope module that extracts explicit/inherited project context, detects ambiguous multi-project follow-ups, and filters documents by text markers. Apply that module before deterministic answering and before the Claude prompt; do not change Supabase or Notion schemas. Keep the existing `assistant-check.ts` executable assertions as the repository's regression harness.

**Tech Stack:** TypeScript, Next.js, Supabase RPC retrieval, `tsx`, Node `assert/strict`.

**Spec:** `docs/superpowers-spec-suggest-reply-isolation.md`

## Global Constraints

- Use existing text metadata only; no Supabase schema, Notion schema, RPC, or retrieval migration changes.
- Use the same filtered candidate set for deterministic fallback and the Claude prompt.
- If an explicit/inherited project has no matching candidates, do not fall back to another project.
- Never invent a timeline, owner, policy, refund, credential, or troubleshooting step.
- When clarification is required, keep `draft_reply` empty and set low confidence.
- Preserve source-leak protection and citation validation.
- Do not add a test framework or dependency; use `npx tsx lib/assistant-check.ts`.

## Review Focus

- Project references in natural Indonesian forms (`Project A:`, `di Project A`, `untuk Project B`, `Project B tadi`) must resolve to the same scope; test in Task 1.
- One active project in history plus a pronoun-only follow-up must inherit scope; test in Task 1.
- Multiple active projects plus an unqualified follow-up must clarify without citations or draft; test in Task 1.
- Explicit project with no matching marked documents must not receive another project's source; test in Task 2.
- Timeline/owner question with no supported source must not receive an invented answer, while a supported source must be used; test in Task 3.

---

### Task 1: Add the shared project-scope resolver

**Files:**
- Create: `lib/project-scope.ts`
- Modify: `lib/assistant-check.ts:1-6, around the existing project ambiguity regression block`

**Interfaces:**
- Consumes: `KnowledgeDocument` from `lib/assistant-types.ts`; chat history as `{ role: "user" | "assistant"; content: string }[]`.
- Produces: `resolveProjectScope(query, history)` and `filterDocumentsByProject(documents, project)` for retrieval and answer generation.

- [ ] **Step 1: Write failing assertions in `lib/assistant-check.ts`**

Add imports:

```ts
import { filterDocumentsByProject, resolveProjectScope } from "./project-scope";
```

Add assertions using project-tagged documents and history:

```ts
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
    { id: "a", title: "Project A login", url: null, content: "Project A login", category: "project-a", synced_at: "" },
    { id: "b", title: "Project B login", url: null, content: "Project B login", category: "project-b", synced_at: "" },
  ],
  "B",
);
assert.deepEqual(scoped.map((document) => document.id), ["b"]);
```

- [ ] **Step 2: Run the regression harness and verify the expected RED failure**

Run: `npx tsx lib/assistant-check.ts`

Expected: fail because `./project-scope` does not exist or the resolver functions are missing.

- [ ] **Step 3: Implement the pure resolver**

Create `lib/project-scope.ts` with these behaviors:

```ts
export type ChatHistory = Array<{ role: "user" | "assistant"; content: string }>;
export type ProjectScope = {
  project: string | null;
  projects: string[];
  explicit: boolean;
  ambiguous: boolean;
};

export function resolveProjectScope(query: string, history: ChatHistory): ProjectScope;
export function filterDocumentsByProject(documents: KnowledgeDocument[], project: string | null): KnowledgeDocument[];
```

Implementation rules:
- Extract project labels case-insensitively from `project A`, `project-a`, and `proyek A` forms.
- Stop the label at punctuation or common Indonesian issue words (`kenapa`, `bagaimana`, `gimana`, `untuk`, `di`, `tadi`, `status`, `siapa`, `tidak`, `ada`, `juga`) so `Project B tadi` resolves to `B`.
- Prefer a project named in the current query (`explicit: true`).
- If the query has no project and history has exactly one distinct project, inherit it.
- If the query has no project and history has at least two projects, set `ambiguous` only when the current query is a continuation/indirect follow-up (`ini`, `itu`, `yang tadi`, `status`, `berapa lama`, `siapa`, or similarly topic-free); otherwise leave the project null so ordinary unscoped retrieval remains compatible.
- Match a project against `category`, `title`, and `content` using a word-boundary-safe marker; return no documents when a non-null project has no matching marker.
- Keep the module free of Supabase, environment, or UI dependencies.

- [ ] **Step 4: Run the focused regression harness and verify GREEN**

Run: `npx tsx lib/assistant-check.ts`

Expected: `assistant-check passed` and `readJson shape check passed`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0 with no diagnostics.

- [ ] **Step 6: Commit the shared resolver**

```bash
git add lib/project-scope.ts lib/assistant-check.ts
git commit -m "feat: add shared project scope resolver"
```

---

### Task 2: Apply project scope before retrieval and deterministic answering

**Files:**
- Modify: `lib/retrieval.ts:305-335`
- Modify: `lib/anthropic.ts:123-223,322-327`
- Modify: `lib/message-processing.ts:211-223` only if the chosen clarification result needs to be surfaced before model execution
- Modify: `lib/assistant-check.ts` with TC-03/04/05/07/08/09 assertions

**Interfaces:**
- Consumes: `resolveProjectScope()` and `filterDocumentsByProject()` from Task 1.
- Produces: retrieval results with no cross-project candidates; `fallback()` and `generateGroundedAnswer()` using the same scope.

- [ ] **Step 1: Add failing isolation assertions**

Add deterministic fixtures with two login articles, two payment/report articles, and an unrelated Project B document. Assert:

```ts
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
```

- [ ] **Step 2: Run the harness and verify RED**

Run: `npx tsx lib/assistant-check.ts`

Expected: at least one new assertion fails because current direct answer generation does not apply the shared resolver to all paths.

- [ ] **Step 3: Apply scope to retrieval**

In `retrieveKnowledge()`:
- Resolve scope from `query` and `history` before returning search results.
- If scope is ambiguous, return `[]`; the caller must create a clarification answer rather than expose unrelated documents.
- Search the existing direct/combined/canonical queries, then pass every result through `filterDocumentsByProject()` before returning it.
- Preserve current point-article selection after project filtering.

- [ ] **Step 4: Apply the same scope to fallback and Claude input**

In `anthropic.ts`:
- Remove duplicate local project parsing helpers once the shared module covers their behavior.
- Resolve scope at the beginning of `fallback()` and `generateGroundedAnswer()`.
- For an ambiguous scope, return one low-confidence clarification object with empty citations and empty `draft_reply`.
- For a non-null scope, use only filtered documents for ranking, citations, and `KNOWLEDGE CONTEXT` sent to Claude.
- If a scoped query has no documents, use the existing no-knowledge fallback and never allow the model to answer from another project's document.
- Keep the existing `validateCitations()` backstop unchanged.

- [ ] **Step 5: Run regression and type checks**

Run:

```bash
npx tsx lib/assistant-check.ts
npm run typecheck
```

Expected: both exit 0; output includes `assistant-check passed` and `readJson shape check passed`.

- [ ] **Step 6: Commit the retrieval isolation**

```bash
git add lib/retrieval.ts lib/anthropic.ts lib/message-processing.ts lib/assistant-check.ts
git commit -m "fix: apply project scope across answer paths"
```

---

### Task 3: Make follow-up intent source-grounded

**Files:**
- Modify: `lib/anthropic.ts:149-215,270-304`
- Modify: `lib/assistant-check.ts` with timeline, owner, TC-09, and TC-10 assertions
- Modify: `docs/suggest-reply-test-plan.md` to record deterministic run status and remaining manual prerequisites

**Interfaces:**
- Consumes: scoped documents and history from Tasks 1-2.
- Produces: timeline/status/owner answers that either use a matching supported source or explicitly request internal confirmation.

- [ ] **Step 1: Add failing follow-up assertions**

Add two fixtures and assertions:

```ts
const timelineWithoutSource = generateNoAiAnswer(
  "Berapa lama biasanya ini bisa selesai?",
  [projectALogin],
  [{ role: "user", content: "Kami ada masalah login di Project A." }],
);
assert.match(timelineWithoutSource.answer, /estimasi|waktu|konfirmasi/i);
assert.equal(timelineWithoutSource.draft_reply, "");

const timelineWithSource = generateNoAiAnswer(
  "Berapa lama biasanya ini bisa selesai?",
  [{
    ...projectALogin,
    content: `${projectALogin.content}\nCustomer Reply: Biasanya selesai dalam 2 hari kerja.`,
  }],
  [{ role: "user", content: "Kami ada masalah login di Project A." }],
);
assert.match(timelineWithSource.draft_reply, /2 hari kerja/i);
```

For TC-09, assert the final owner/timing follow-up includes Project B report context and never includes Project A checkout/payment text.

- [ ] **Step 2: Run the harness and verify RED**

Run: `npx tsx lib/assistant-check.ts`

Expected: the supported-timeline assertion fails because the current timeline guard always returns empty `draft_reply`.

- [ ] **Step 3: Implement source-grounded follow-up handling**

In `anthropic.ts`:
- Keep the existing no-source timeline clarification behavior.
- Before returning that clarification, inspect only the scoped best candidate's `Customer Safe Summary` and `Customer Reply` for a concrete duration/date/owner phrase.
- If a supported source exists, use its customer-safe reply and citation; do not fabricate or append an estimate.
- If the source has no concrete support, return low confidence, empty draft, and a recommended internal confirmation action.
- Preserve the current rule that non-empty `missing_context` clears `draft_reply`.
- Ensure the answer for a follow-up describes the latest intent (timeline/status/owner), not merely the prior issue summary.

- [ ] **Step 4: Add mixed-language and long-history assertions**

Use a fixture with Indonesian customer text and English terms (`login`, `reset password`, `error`). Assert the draft is Indonesian or naturally mixed and does not ask the customer to repeat an already completed password reset.

Construct at least 12 prior messages, place Project A checkout/timeout early, Project B report late, then ask the owner/timing question. Assert citations and draft contain Project B report terms only.

- [ ] **Step 5: Update the test plan run log**

Add a dated verification section to `docs/suggest-reply-test-plan.md` with columns `Case | Path | Result | Evidence | Limitation`. Record deterministic results for TC-01/02/03/05/07/09/10 and mark TC-04/08 as fixture-dependent if project-marked conflicting knowledge is unavailable. State that live Supabase retrieval and the Claude model path still require manual UI QA.

- [ ] **Step 6: Run all available verification**

Run:

```bash
npx tsx lib/assistant-check.ts
npm run typecheck
git diff --check
```

Expected: all commands exit 0. Do not claim `npm test` passes; `package.json` has no `test` script.

- [ ] **Step 7: Commit follow-up behavior and documentation**

```bash
git add lib/anthropic.ts lib/assistant-check.ts docs/suggest-reply-test-plan.md
git commit -m "fix: ground suggest reply follow-ups in sources"
```

---

### Task 4: Manual app verification and final review

**Files:**
- Modify: none unless verification exposes a regression
- Review: `docs/suggest-reply-test-plan.md`, `lib/project-scope.ts`, `lib/retrieval.ts`, `lib/anthropic.ts`, `lib/assistant-check.ts`

**Interfaces:**
- Consumes: committed Tasks 1-3.
- Produces: evidence for UI/runtime behavior and a final review decision.

- [ ] **Step 1: Start the app using the existing environment**

Run: `npm run dev`

Confirm: `GET http://localhost:3000/api/health` returns HTTP 200 with the configured health checks. Do not expose environment values.

- [ ] **Step 2: Run the core UI scenarios**

In a fresh conversation, execute TC-01, TC-02, TC-03, TC-05, TC-07, TC-09, and TC-10 exactly as written in `docs/suggest-reply-test-plan.md`. Record `draft_reply`, `answer`, citations, and path (`model` or `fallback`).

- [ ] **Step 3: Verify cross-cutting protections**

For each response, check:
- latest message is answered;
- no foreign project appears in draft or citations;
- no source marker, UUID, URL, score, or internal metadata appears in customer-facing text;
- no unsupported timeline, owner, policy, or fix is invented;
- ambiguous project follow-ups have low confidence and empty draft.

- [ ] **Step 4: Run final checks**

Run:

```bash
npx tsx lib/assistant-check.ts
npm run typecheck
git diff --check
git status --short --branch
```

Expected: regression harness passes, typecheck passes, diff check passes, and the intended branch state is explicit.

- [ ] **Step 5: Review commit history and report limits**

Report the commit hashes, deterministic/manual case results, and any cases blocked by missing project-marked knowledge or unavailable live model behavior. Do not mark TC-04/08/10 fully verified unless their stated prerequisites were actually exercised.

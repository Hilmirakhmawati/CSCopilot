# Suggest Reply Isolation Design

## Goal

Make Suggest Reply consistently follow the latest client question, preserve valid follow-up context, and prevent cross-project sources from entering either the deterministic fallback or Claude model path.

## Scope

This phase uses existing text metadata only. No Supabase schema, Notion schema, RPC, or retrieval migration changes.

## Data flow

1. Parse project references from the current message using explicit forms such as `Project A:`, `di Project A`, and `untuk Project B`.
2. If the current message has no project reference, inspect recent user history:
   - one known project: inherit it;
   - multiple projects plus ambiguous follow-up: return clarification with no citations/draft;
   - multiple projects plus an issue that names a project: use the named project.
3. Filter candidate knowledge documents by project markers in `category`, `title`, and `content`.
4. Use the same filtered candidate set for deterministic fallback and the Claude prompt.
5. If an explicit/inherited project has no matching candidates, do not fall back to another project. Return a low-confidence knowledge gap.

## Follow-up behavior

- Continuation words (`ini`, `itu`, `yang tadi`, and similar) borrow recent user context.
- Timeline/status/ownership questions answer only from matching customer-safe knowledge. If no supported SLA/owner exists, state that confirmation is required and leave `draft_reply` empty; never invent a timeline or owner.
- A clear topic switch replaces prior project context for retrieval and citations.

## Testing

Add deterministic assertions to `lib/assistant-check.ts` covering:

- direct single-project question;
- follow-up timeline intent;
- Project A to Project B isolation;
- same-term login isolation;
- project inherited from earlier history;
- no-knowledge response with empty citations;
- conflicting project documents;
- long-history latest-topic behavior;
- mixed Indonesian/English response behavior;
- source-leak protection and missing-context invariant.

Run `npx tsx lib/assistant-check.ts`, `npm run typecheck`, and `git diff --check`. The repository currently has no `npm test` script. Full manual QA remains necessary for live Supabase retrieval and the Claude model path.

## Explicit limits

Text markers are a compatibility layer, not durable project isolation. Documents without a consistent project marker remain unscoped. A future schema-level project field and retrieval filter is required for strong isolation across all knowledge documents.

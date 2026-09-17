# Context management

CSCopilot keeps raw messages as the source of truth. Migration `005_context_management.sql` adds a small, conversation-scoped active-context record; apply it in Supabase before sending messages through the new flow.

## What is retained

`conversations.active_context` stores only conservative metadata extracted from the current user's message:

```json
{
  "topic": {
    "value": "Pembayaran saya gagal",
    "source": "system_extracted",
    "timestamp": "2026-09-17T00:00:00.000Z",
    "status": "active",
    "verification": "unverified"
  }
}
```

Values are not permanent memory, are not shared between conversations, and are never silently upgraded to verified. An explicit confirmation phrase can mark the current topic verified. Resolved or superseded values are excluded from the active prompt.

## Priority and switching

The effective order is: latest confirmed/current user information, recent messages, active context, previous summary, then company knowledge. A message with an explicit topic starts that topic. An indirect short follow-up such as `masih sama` can continue the active topic. This prevents an earlier point issue from overriding a new payment issue.

Multiple topics remain in raw history, but only the current active topic is sent as active context. Ambiguous messages should be clarified by the assistant rather than guessed.

## Prompt budget

Token estimates use `ceil(characters / 4)` to avoid a new tokenizer dependency. The current message is never truncated. Old history is removed first when the bounded context budget is reached; the active context and current issue remain available. Input validation still rejects a single message over 12,000 characters.

When a new explicit topic arrives, the prior active topic is marked `superseded` and retained only as a bounded summary line. This is an MVP boundary, not model training or permanent memory. Copy-pasted text remains a message and is not automatically stored as a knowledge document. Add richer extraction only after pilot examples show a measured need.

## Operations

1. Apply `supabase/migrations/005_context_management.sql`.
2. Run `npx tsx lib/assistant-check.ts`.
3. Run `npm run typecheck` and `npm run build`.
4. Manually test: point issue → payment issue, then `masih sama`; two topics; long paste near the input limit.

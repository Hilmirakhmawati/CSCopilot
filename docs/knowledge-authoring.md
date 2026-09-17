# Knowledge authoring guide

CSCopilot uses RAG: Notion content is synced to Supabase, then supplied to Claude. This is not model training.

## Required Notion fields

Every customer-safe row needs:

- `Visibility`: exactly `Chatbot Allowed`
- `Customer Safe Summary`: factual explanation safe to show customers
- `Customer Action`: approved next step or escalation instruction

Rows missing any required field are skipped. Internal notes, credentials, tokens, full payment data, and backend identifiers stay out of these fields.

## Recommended structure

Use one SOP per issue. Title it with customer wording plus the internal term, for example `Pembayaran Gagal (Payment Failed)`. Include:

- Symptoms and supported scope
- Required information: only details the customer must provide
- Customer-safe steps
- Escalation criteria and owner
- Prohibited disclosure: secrets, internal IDs, fraud rules, and unsupported promises
- Aliases: common Indonesian/English terms customers use
- Last-reviewed date and owner

Keep steps deterministic. Separate what the agent checks internally from what the customer must send. Never add a claim, timeline, refund promise, or troubleshooting step unless the SOP approves it.

## Before pilot use

Run the deterministic checks:

```sh
npx tsx scripts/evaluate-knowledge.mjs
npx tsx lib/assistant-check.ts
npm run typecheck
```

The evaluation intentionally does not fabricate production documents or call live Claude/Supabase. Validate real retrieval with a representative pilot question set after syncing approved Notion rows.

# Knowledge authoring guide

CSCopilot uses RAG: Notion content is synced to Supabase, then supplied to Claude. This is not model training.

## Required Notion fields

Every customer-safe row needs:

- `Visibility`: exactly `Chatbot Allowed`
- `Customer Safe Summary`: factual explanation for internal/CS analysis — never shown verbatim to the customer
- `Customer Action`: **internal instruction to the CS agent** (e.g. "Minta nomor pesanan terkait"). This is guidance for the human, not text to send. The app never uses it as a reply.

Rows missing either field are skipped entirely.

## Customer-facing reply field

- `Customer Reply`: the exact sentence(s) the app may offer as a Suggested Reply/draft. Write it as if speaking directly to the customer — polite, factual, no internal jargon.
- Rows without `Customer Reply` still sync (for internal guidance/search) but the app will **not** generate a draft for them — it returns a clarification state asking CS to complete the Notion row instead. `Customer Action` is never substituted in.

## Required Context (optional)

- `Required Context`: what the customer must supply before a draft is approvable, in plain words — e.g. `nomor pesanan`, `nomor akun`, `screenshot`. When set, the app blocks the draft until that information appears in the conversation (a 6+ digit number satisfies an order-number requirement).
- If left blank, the app infers it heuristically from `Customer Action` wording (order/account/screenshot mentions). Prefer setting it explicitly — heuristics are a fallback, not a guarantee.

## Example: point balance shows 0

```
Customer Safe Summary: Saldo poin dapat menampilkan 0 karena kendala sinkronisasi.
Customer Action: Minta nomor pesanan terkait untuk verifikasi sebelum eskalasi ke tim poin.
Customer Reply: Terima kasih sudah menghubungi kami. Mohon kirimkan nomor pesanan terkait agar tim kami dapat memeriksa saldo poin Anda.
Required Context: nomor pesanan
```

Internal notes, credentials, tokens, full payment data, and backend identifiers stay out of all four fields.

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

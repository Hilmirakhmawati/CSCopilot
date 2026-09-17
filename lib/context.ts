// Active context is a small, structured, conversation-scoped record — not a
// second copy of history. Values are only ever "system_extracted" from the
// customer's own words via keyword/regex matching (no extra Claude call, no
// vector store). Nothing here is promoted to "verified" without an explicit
// confirmation phrase, so the model is never fed a guess dressed as a fact.
export type ContextStatus = "active" | "pending" | "resolved" | "superseded" | "unknown";
export type ContextVerification = "verified" | "unverified";

export type ContextValue = {
  value: string;
  source: "system_extracted";
  timestamp: string;
  status: ContextStatus;
  verification: ContextVerification;
};

export type ActiveContext = Record<string, ContextValue>;

const resolvedPattern = /\b(sudah|udah)\s+(fixed|selesai|beres|diperbaiki|diupload|di-upload|terkirim)\b|\bsolved\b|\bresolved\b/i;
const pendingPattern = /\bmasih\s+(pending|menunggu|belum)\b|\bbelum\s+(selesai|beres|fixed)\b|\bwaiting\b/i;
const confirmPattern = /\b(benar|betul|iya\s+benar|confirmed|saya\s+konfirmasi|sudah\s+dikonfirmasi)\b/i;
const projectPattern = /\b(?:project|proyek)\s*[:=-]\s*([^,.\n]+)/i;

// Bound how much of a raw message becomes a "topic" label — this is a
// pointer for prompt context, not a transcript. The full message is already
// preserved verbatim in the messages table.
const TOPIC_LABEL_MAX = 120;

function withMeta(value: string, now: string, status: ContextStatus, verified: boolean): ContextValue {
  return { value, source: "system_extracted", timestamp: now, status, verification: verified ? "verified" : "unverified" };
}

// Called once per incoming user message. `isContinuation` (from
// `continuationSignal` in lib/retrieval.ts) decides whether this message
// still belongs to the current topic or starts a new one — an explicit new
// topic supersedes the old one rather than blending with it.
export function updateActiveContext(message: string, previous: ActiveContext, isContinuation: boolean, now = new Date().toISOString()): ActiveContext {
  const next = { ...previous };
  const confirmed = confirmPattern.test(message);

  if (!isContinuation) {
    next.topic = withMeta(message.slice(0, TOPIC_LABEL_MAX), now, "active", confirmed);
  } else if (next.topic) {
    if (resolvedPattern.test(message)) next.topic = { ...next.topic, status: "resolved", timestamp: now };
    else if (pendingPattern.test(message)) next.topic = { ...next.topic, status: "pending", timestamp: now };
    else if (confirmed) next.topic = { ...next.topic, verification: "verified", timestamp: now };
  }

  const project = message.match(projectPattern)?.[1]?.trim();
  if (project) next.project = withMeta(project, now, "active", confirmed);

  return next;
}

// What actually reaches the prompt: resolved/superseded entries are done, so
// they are dropped rather than sent as if still relevant.
export function activeContextForPrompt(context: ActiveContext): string {
  return Object.entries(context)
    .filter(([, item]) => item.status !== "resolved" && item.status !== "superseded")
    .map(([key, item]) => `${key}: ${item.value} [${item.status}, ${item.verification}]`)
    .join("\n");
}

// A topic that just got superseded is worth one line in the rolling summary
// so long conversations keep a trail after compaction — without keeping the
// full old context entry "active".
export function supersedeTopic(previous: ActiveContext, priorSummary: string, now = new Date().toISOString()): { context: ActiveContext; summary: string } {
  if (!previous.topic || previous.topic.status === "resolved" || previous.topic.status === "superseded") {
    return { context: previous, summary: priorSummary };
  }
  const line = `- ${previous.topic.value} (superseded ${now})`;
  const lines = [...priorSummary.split("\n").filter(Boolean), line].slice(-5);
  return { context: { ...previous, topic: { ...previous.topic, status: "superseded" } }, summary: lines.join("\n") };
}

// Character-based, not a real tokenizer — no new dependency, and it only
// needs to be conservative enough to keep requests bounded.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Drops the oldest messages first, keeping the most recent ones that fit the
// budget. The current user message is never part of `history` here — it is
// passed separately by the caller and so is never truncated.
export function trimHistoryToBudget<T extends { content: string }>(history: T[], budgetTokens: number): T[] {
  const kept: T[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(history[i].content);
    if (kept.length && used + cost > budgetTokens) break;
    kept.unshift(history[i]);
    used += cost;
  }
  return kept;
}

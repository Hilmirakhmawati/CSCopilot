import { generateGroundedAnswer } from "./anthropic";
import type { GroundedAnswer } from "./assistant-types";
import { getSupabaseAdmin } from "./db";
import { greetingAnswer, isGreetingOnly, retrieveKnowledge } from "./retrieval";
import { hasCustomerFacingSourceLeak, validateCitations } from "./assistant-check";

// Last-resort backstop: if the model still echoes a source marker or UUID
// into customer-facing text despite the system prompt, replace it with a
// safe holding reply rather than showing internal IDs to a customer.
const LEAK_FALLBACK_ANSWER = "Mohon maaf, jawaban ini perlu ditinjau ulang oleh tim Customer Support sebelum dikirim ke customer.";

function sanitizeAnswer(answer: GroundedAnswer): GroundedAnswer {
  if (!hasCustomerFacingSourceLeak(answer.answer) && !hasCustomerFacingSourceLeak(answer.draft_reply)) return answer;
  return { ...answer, answer: LEAK_FALLBACK_ANSWER, draft_reply: LEAK_FALLBACK_ANSWER, confidence: "low" };
}

type Database = ReturnType<typeof getSupabaseAdmin>;

type MessageResult = GroundedAnswer & {
  message_id: string;
  created_at?: string;
  sources: Awaited<ReturnType<typeof retrieveKnowledge>>;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  created_at?: string;
  idempotency_key?: string | null;
};

function replayResult(message: StoredMessage, sources: Awaited<ReturnType<typeof retrieveKnowledge>> = []): MessageResult {
  const citations = Array.isArray(message.citations) ? message.citations : [];
  return {
    intent: "Support request",
    summary: "Previously generated response.",
    missing_context: [],
    recommended_action: "Review the response and source references.",
    answer: message.content,
    draft_reply: message.content,
    citations: citations as GroundedAnswer["citations"],
    confidence: "medium",
    message_id: message.id,
    created_at: message.created_at,
    sources,
  };
}

// Migration 002 adds the idempotency columns. Until it has been applied to
// the database, selecting/inserting them errors — probe once per process,
// then degrade to legacy (non-idempotent) sends instead of failing every message.
let idempotencySupported: boolean | null = null;

export async function idempotencyReady(db: Database): Promise<boolean> {
  if (idempotencySupported === null) {
    const probe = await db.from("messages").select("idempotency_key").limit(1);
    idempotencySupported = !probe.error;
    if (probe.error) console.warn("Idempotency columns unavailable; apply 002_message_idempotency.sql to enable replay protection");
  }
  return idempotencySupported;
}

// Serializes calls per conversation within this process — two tabs/rapid
// double-sends on the same conversation queue instead of racing each other's
// history reads and inserts. ponytail: process-local only; a multi-instance
// deploy would need a DB-level lock (e.g. pg_advisory_lock) instead.
const conversationLocks = new Map<string, Promise<unknown>>();

async function withConversationLock<T>(conversationId: string, run: () => Promise<T>): Promise<T> {
  const previous = conversationLocks.get(conversationId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  conversationLocks.set(conversationId, next);
  try {
    return await next;
  } finally {
    if (conversationLocks.get(conversationId) === next) conversationLocks.delete(conversationId);
  }
}

export async function processConversationMessage(
  db: Database,
  conversationId: string,
  userId: string,
  issue: string,
  idempotencyKey?: string,
): Promise<MessageResult> {
  return withConversationLock(conversationId, () => processConversationMessageUnlocked(db, conversationId, userId, issue, idempotencyKey));
}

async function processConversationMessageUnlocked(
  db: Database,
  conversationId: string,
  userId: string,
  issue: string,
  idempotencyKey?: string,
): Promise<MessageResult> {
  const owner = await db.from("conversations").select("id").eq("id", conversationId).eq("created_by", userId).single();
  if (owner.error) throw new Error("Conversation not found");

  const key = idempotencyKey && (await idempotencyReady(db)) ? idempotencyKey : undefined;
  if (key) {
    const existing = await db
      .from("messages")
      .select("id,role,content,citations,created_at,idempotency_key")
      .eq("conversation_id", conversationId)
      .eq("idempotency_key", key)
      .eq("role", "assistant")
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return replayResult(existing.data as StoredMessage);
  }

  const prior = await db
    .from("messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .neq("role", "system")
    .order("created_at", { ascending: true })
    .limit(20);
  if (prior.error) throw prior.error;

  const history = (prior.data ?? []).slice(-10).map((message) => ({
    role: message.role as "user" | "assistant",
    content: message.content as string,
  }));
  const input = await db
    .from("messages")
    .insert(key
      ? { conversation_id: conversationId, role: "user", content: issue, idempotency_key: key }
      : { conversation_id: conversationId, role: "user", content: issue })
    .select("id")
    .single();
  if (input.error) {
    if (key && input.error.code === "23505") {
      const existing = await db
        .from("messages")
        .select("id,role,content,citations,created_at,idempotency_key")
        .eq("conversation_id", conversationId)
        .eq("idempotency_key", key)
        .eq("role", "assistant")
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return replayResult(existing.data as StoredMessage);
    }
    throw input.error;
  }

  try {
    const greeting = isGreetingOnly(issue);
    const documents = greeting ? [] : await retrieveKnowledge(issue, history);
    if (!greeting && documents.length === 0) {
      // Reused audit_events rather than a new table — same shape (actor,
      // metadata) fits, and it already has an admin view to build on.
      const zeroResult = await db.from("audit_events").insert({ actor_id: userId, entity_type: "knowledge_query", entity_id: null, action: "zero_result", metadata: { query: issue, conversation_id: conversationId } });
      if (zeroResult.error) console.error("Failed to log zero-result query", zeroResult.error);
    }
    const answer = sanitizeAnswer(greeting
      ? greetingAnswer(issue, history)
      : await generateGroundedAnswer(issue, documents, history));
    answer.citations = validateCitations(
      answer.citations ?? [],
      new Set(documents.map((document) => document.id)),
    );

    const output = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: answer.answer,
        citations: answer.citations,
        ...(key ? { idempotency_key: key, reply_to_id: input.data.id } : {}),
      })
      .select("id,content,citations,created_at")
      .single();
    if (output.error) throw output.error;

    const updated = await db
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (updated.error) throw updated.error;

    return {
      ...answer,
      message_id: output.data.id,
      created_at: output.data.created_at,
      sources: documents,
    };
  } catch (error) {
    const cleanup = await db.from("messages").delete().eq("id", input.data.id).eq("role", "user");
    if (cleanup.error) console.error("Failed to clean up failed user message", cleanup.error);
    throw error;
  }
}

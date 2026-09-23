import { generateGroundedAnswer } from "./anthropic";
import type { GroundedAnswer } from "./assistant-types";
import { getSupabaseAdmin } from "./db";
import { greetingAnswer, isGreetingOnly, retrieveKnowledge, continuationSignal } from "./retrieval";
import { activeContextForPrompt, estimateTokens, supersedeTopic, trimHistoryToBudget, updateActiveContext, type ActiveContext } from "./context";
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
  const startedAt = Date.now();
  // Migration 005 adds the context columns. Keep the context feature optional
  // until that migration has reached every environment.
  const ownerWithContext = await db
    .from("conversations")
    .select("id,context_summary,active_context")
    .eq("id", conversationId)
    .eq("created_by", userId)
    .single();
  let contextColumnsAvailable = true;
  let ownerData = ownerWithContext.data as { id: string; context_summary?: string | null; active_context?: unknown } | null;
  if (ownerWithContext.error) {
    // PostgREST uses PGRST116 when `.single()` finds no owned row. Missing
    // columns are a deploy-order issue, not a missing conversation.
    if (ownerWithContext.error.code === "PGRST116") throw new Error("Conversation not found");
    if (!(["PGRST204", "42703"] as string[]).includes(ownerWithContext.error.code ?? "")) throw ownerWithContext.error;
    contextColumnsAvailable = false;
    const legacyOwner = await db
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("created_by", userId)
      .single();
    if (legacyOwner.error) {
      if (legacyOwner.error.code === "PGRST116") throw new Error("Conversation not found");
      throw legacyOwner.error;
    }
    ownerData = legacyOwner.data;
  }
  if (!ownerData) throw new Error("Conversation not found");
  const storedContext = (ownerData.active_context ?? {}) as ActiveContext;
  const contextSummary: string = ownerData.context_summary ?? "";
  const continuation = continuationSignal(issue);

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

  // Use the newest turns as context. The secondary order keeps pagination
  // deterministic when two messages share the same timestamp.
  const prior = await db
    .from("messages")
    .select("id,role,content")
    .eq("conversation_id", conversationId)
    .neq("role", "system")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(10);
  if (prior.error) throw prior.error;

  // The model expects conversation messages oldest-first; the DB query is
  // newest-first so the limit selects the correct window efficiently.
  const history = (prior.data ?? []).reverse().map((message) => ({
    role: message.role as "user" | "assistant",
    content: message.content as string,
  }));
  // An explicit new topic supersedes the old one rather than blending with
  // it; the superseded topic leaves one line in the rolling summary so long
  // conversations keep a trail after it drops out of active context.
  const { context: baseContext, summary: nextSummary } = continuation
    ? { context: storedContext, summary: contextSummary }
    : supersedeTopic(storedContext, contextSummary);
  const activeContext = updateActiveContext(issue, baseContext, continuation);
  const activeContextText = activeContextForPrompt(activeContext);
  const contextBudget = 6_000;
  const contextText = [
    activeContextText && `ACTIVE CONTEXT:\n${activeContextText}`,
    nextSummary && `PREVIOUS CONTEXT SUMMARY:\n${nextSummary}`,
  ].filter(Boolean).join("\n\n");
  const historyBudget = Math.max(0, contextBudget - estimateTokens(contextText) - estimateTokens(issue));
  const boundedHistory = trimHistoryToBudget(history, historyBudget);
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
    const documents = greeting ? [] : await retrieveKnowledge(issue, boundedHistory);
    if (!greeting && documents.length === 0) {
      // Reused audit_events rather than a new table — same shape (actor,
      // metadata) fits, and it already has an admin view to build on.
      const zeroResult = await db.from("audit_events").insert({ actor_id: userId, entity_type: "knowledge_query", entity_id: null, action: "zero_result", metadata: { query: issue, conversation_id: conversationId } });
      if (zeroResult.error) console.error("Failed to log zero-result query", zeroResult.error);
    }
    const answer = sanitizeAnswer(greeting
      ? greetingAnswer(issue, boundedHistory)
      : await generateGroundedAnswer(issue, documents, boundedHistory, contextText));
    answer.citations = validateCitations(
      answer.citations ?? [],
      new Set(documents.map((document) => document.id)),
    );

    void db.from("audit_events").insert({
      actor_id: userId,
      entity_type: "system_metric",
      entity_id: null,
      action: "knowledge_query",
      metadata: {
        latency_ms: Date.now() - startedAt,
        knowledge_count: documents.length,
        citation_count: answer.citations.length,
        confidence: answer.confidence,
        clarification: answer.missing_context.length > 0,
        source_found: documents.length > 0,
      },
    }).then(({ error }) => {
      if (error) console.error("Failed to record query telemetry", error);
    });

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
      .update(contextColumnsAvailable
        ? { active_context: activeContext, context_summary: nextSummary, context_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { updated_at: new Date().toISOString() })
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
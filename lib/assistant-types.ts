export type Citation = {
  document_id: string;
  title: string;
  url: string | null;
  quote: string;
};

export type GroundedAnswer = {
  intent: string;
  summary: string;
  missing_context: string[];
  recommended_action: string;
  answer: string;
  draft_reply: string;
  citations: Citation[];
  confidence: "low" | "medium" | "high";
  // True when draft_reply is empty because the Notion article itself is
  // unfinished (missing Customer Reply / Customer Safe Summary / Customer
  // Action) — a knowledge-authoring gap, not something the customer needs
  // to supply. Distinguishes that from missing_context, which is data CS
  // still needs to collect from the customer. Optional/undefined = false.
  knowledge_gap?: boolean;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  url: string | null;
  content: string;
  category: string | null;
  synced_at: string;
};

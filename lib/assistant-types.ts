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
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  url: string | null;
  content: string;
  category: string | null;
  synced_at: string;
};

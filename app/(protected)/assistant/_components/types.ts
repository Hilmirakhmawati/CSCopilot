import type { Citation } from "@/lib/assistant-types";

export type Conversation = { id: string; title: string | null; updated_at?: string };
export type Message = { id: string; role: "user" | "assistant" | "system"; content: string; citations?: Citation[]; created_at?: string };

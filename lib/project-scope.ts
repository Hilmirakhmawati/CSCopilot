import type { KnowledgeDocument } from "./assistant-types";

export type ChatHistory = Array<{ role: "user" | "assistant"; content: string }>;

export type ProjectScope = {
  project: string | null;
  projects: string[];
  explicit: boolean;
  ambiguous: boolean;
};

const projectPattern = /\b(?:project|proyek)\s*[-:]?\s*([a-z0-9][a-z0-9_-]*)/gi;
const ambiguousFollowUpPattern = /\b(ini|itu|yang tadi|sebelumnya|status|berapa lama|kapan|siapa)\b|^(?:bisa|boleh|apakah|gimana|bagaimana|kenapa)\b/i;

function projectNames(value: string) {
  return [...value.matchAll(projectPattern)].map((match) => match[1]);
}

function uniqueProjects(values: string[]) {
  return values.filter((value, index) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
}

function projectMarker(project: string) {
  const escaped = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bproject[\\s_-]*${escaped}\\b`, "i");
}

export function resolveProjectScope(query: string, history: ChatHistory): ProjectScope {
  const explicitProjects = uniqueProjects(projectNames(query));
  const historyProjects = uniqueProjects(history.filter((message) => message.role === "user").flatMap((message) => projectNames(message.content)));
  const projects = uniqueProjects([...historyProjects, ...explicitProjects]);
  if (explicitProjects.length > 0) {
    return { project: explicitProjects[explicitProjects.length - 1], projects, explicit: true, ambiguous: explicitProjects.length > 1 };
  }
  if (historyProjects.length === 1) {
    return { project: historyProjects[0], projects, explicit: false, ambiguous: false };
  }
  const ambiguous = historyProjects.length > 1 && ambiguousFollowUpPattern.test(query.trim());
  return { project: null, projects, explicit: false, ambiguous };
}

export function filterDocumentsByProject(documents: KnowledgeDocument[], project: string | null) {
  if (!project) return documents;
  const marker = projectMarker(project);
  return documents.filter((document) => marker.test(`${document.category ?? ""} ${document.title} ${document.content}`));
}

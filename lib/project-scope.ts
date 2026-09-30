import type { KnowledgeDocument } from "./assistant-types";

export type ChatHistory = Array<{ role: "user" | "assistant"; content: string }>;

export type ProjectScope = {
  project: string | null;
  projects: string[];
  explicit: boolean;
  ambiguous: boolean;
};

const projectPattern = /\b(?:project|proyek)\s*[-:]?\s*([a-z0-9][a-z0-9_-]*(?:\s+[a-z0-9][a-z0-9_-]*)*?)(?=\s*(?:[:,]|$)|\s+(?:ada|juga|tadi|ini|terkait|mengenai|untuk|dengan|user|customer|aplikasi|laporan|kenapa|mengapa|bagaimana|gimana|tidak|bisa|masalah|kendala|error|login|pembayaran|poin)\b)/gi;
const ambiguousFollowUpPattern = /\b(ini|itu|yang tadi|sebelumnya|status|berapa lama|kapan|siapa)\b|^(?:bisa|boleh|apakah|gimana|bagaimana|kenapa)\b/i;
const aliasIssuePattern = /\b(?:aplikasi|app|masalah|kendala|error|login|pembayaran|payment|export|laporan|dashboard|poin|point|gagal|tidak\s+bisa)\b/i;
const leadingAliasPattern = /^([a-z][a-z0-9_-]{1,})(?=\s+)/i;
const reservedAliasWords = new Set(["saldo", "saya", "kami", "customer", "user", "akun", "account", "kenapa", "bagaimana", "gimana", "tolong", "mohon", "ini", "itu", "datanya", "katanya", "sudah", "tetap", "passwordnya", "tapi", "yang"]);

export function projectNames(value: string) {
  const explicit = [...value.matchAll(projectPattern)].map((match) => match[1].trim());
  if (explicit.length) return explicit;
  const alias = value.match(leadingAliasPattern)?.[1];
  return alias && !reservedAliasWords.has(alias.toLowerCase()) && aliasIssuePattern.test(value.slice(alias.length)) ? [alias] : [];
}

export function isStandaloneProjectAlias(value: string, history: ChatHistory) {
  const token = value.trim().match(/^([a-z][a-z0-9_-]{1,})$/i)?.[1];
  if (!token || reservedAliasWords.has(token.toLowerCase())) return false;
  return history
    .filter((message) => message.role === "user")
    .flatMap((message) => projectNames(message.content))
    .some((project) => project.toLowerCase() === token.toLowerCase());
}

function uniqueProjects(values: string[]) {
  return values.filter((value, index) => values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
}

function projectMarker(project: string) {
  const escaped = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:project|proyek)[\\s_-]*${escaped}\\b`, "i");
}

export function historyForProject(history: ChatHistory, project: string): ChatHistory {
  const selected: ChatHistory = [];
  let currentProject: string | null = null;
  for (const message of history) {
    if (message.role === "user") {
      const explicit = projectNames(message.content)[0] ?? null;
      if (explicit) currentProject = explicit;
      if (currentProject?.toLowerCase() === project.toLowerCase()) selected.push(message);
    } else if (currentProject?.toLowerCase() === project.toLowerCase()) {
      selected.push(message);
    }
  }
  return selected;
}

export function resolveProjectScope(query: string, history: ChatHistory): ProjectScope {
  const explicitProjects = uniqueProjects(projectNames(query));
  const userProjectTurns = history
    .filter((message) => message.role === "user")
    .map((message) => ({ projects: projectNames(message.content), content: message.content }));
  const historyProjects = uniqueProjects(userProjectTurns.flatMap((turn) => turn.projects));
  const standalone = query.trim().toLowerCase();
  const latestProjectTurn = [...userProjectTurns].reverse().find((turn) => turn.projects.length > 0);
  const latestEstablishedProject = latestProjectTurn?.projects[latestProjectTurn.projects.length - 1] ?? null;
  const establishedProject = historyProjects.find((project) => project.toLowerCase() === standalone) ?? null;
  const projects = uniqueProjects([...historyProjects, ...explicitProjects]);
  if (establishedProject) {
    return {
      project: latestEstablishedProject ?? establishedProject,
      projects,
      explicit: true,
      ambiguous: false,
    };
  }
  if (explicitProjects.length > 0) {
    return { project: explicitProjects[explicitProjects.length - 1], projects, explicit: true, ambiguous: explicitProjects.length > 1 };
  }
  if (historyProjects.length === 1) {
    return { project: historyProjects[0], projects, explicit: false, ambiguous: false };
  }
  if (latestEstablishedProject && !ambiguousFollowUpPattern.test(query.trim())) {
    return { project: latestEstablishedProject, projects, explicit: false, ambiguous: false };
  }
  const ambiguous = historyProjects.length > 1 && ambiguousFollowUpPattern.test(query.trim());
  return { project: null, projects, explicit: false, ambiguous };
}

export function filterDocumentsByProject(documents: KnowledgeDocument[], project: string | null) {
  if (!project) return documents;
  const marker = projectMarker(project);
  return documents.filter((document) => marker.test(`${document.category ?? ""} ${document.title} ${document.content}`));
}

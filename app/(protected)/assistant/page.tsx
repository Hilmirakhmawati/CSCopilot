"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, FileText, History, LogOut, Menu, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabasePublic } from "@/lib/db";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Citation, GroundedAnswer } from "@/lib/assistant-types";

type Conversation = { id: string; title: string | null; updated_at?: string };
type DraftVersion = { id: string; version: number; content: string; created_at: string };
type Message = { id: string; role: "user" | "assistant" | "system"; content: string; citations?: Citation[]; created_at?: string };
type AssistantResponse = GroundedAnswer & { message_id: string; created_at?: string; error?: string };
type NewConversationResponse = AssistantResponse & { conversation: Conversation };

const supabase = getSupabasePublic();
let cachedToken: string | undefined;
let tokenExpiresAt = 0;
let tokenRequest: Promise<string | null> | null = null;

function clearTokenCache() {
  cachedToken = undefined;
  tokenExpiresAt = 0;
}

supabase.auth.onAuthStateChange(clearTokenCache);

async function accessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (!tokenRequest) {
    tokenRequest = supabase.auth.getSession().then(({ data }) => {
      cachedToken = data.session?.access_token;
      tokenExpiresAt = cachedToken ? Date.now() + 60_000 : 0;
      return cachedToken ?? null;
    }).finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

const suggestions = ["Cari SOP keterlambatan respons", "Bagaimana menangani pembayaran gagal?", "Template balasan pembuka"];
const initialMessage: Message = { id: "welcome", role: "assistant", content: "Halo, ceritakan issue yang sedang ditangani. Saya akan mencari solusi dari knowledge perusahaan." }; // Kept for active threads with no persisted messages.

async function apiFetch(input: RequestInfo | URL, init?: RequestInit, retried = false) {
  const headers = new Headers(init?.headers);
  const token = await accessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && !retried) {
    cachedToken = undefined;
    tokenExpiresAt = 0;
    return apiFetch(input, init, true);
  }
  return response;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(response.ok ? "Server returned invalid JSON" : `Request failed (${response.status})`);
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export default function AssistantPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Tracks the last-saved text so the button can show a persistent "Tersimpan"
  // state instead of a transient one that looks like the save reverted.
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const [history, setHistory] = useState<DraftVersion[] | null>(null);
  const [restoredFromVersion, setRestoredFromVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/api/conversations").then((response) => readJson<Conversation[]>(response)).then((data) => {
      if (Array.isArray(data)) setConversations(data);
    }).catch(() => undefined);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function selectConversation(id: string) {
    setError(""); setMobileOpen(false); setActiveId(id); setConversationId(id); setAnswer(null); setDraft(""); setDraftId(null); setApproved(false); setApproving(false); setRejected(false); setRejecting(false); setSavedDraft(null); setHistory(null); setRestoredFromVersion(null);
    const data = await apiFetch(`/api/conversations/${id}/messages`).then((response) => readJson<Message[]>(response));
    setMessages(data.length ? data : [initialMessage]);
  }

  function newChat() {
    setActiveId(null); setConversationId(null); setMessages([]); setAnswer(null); setDraft(""); setDraftId(null); setApproved(false); setApproving(false); setRejected(false); setRejecting(false); setSavedDraft(null); setHistory(null); setRestoredFromVersion(null); setError(""); setInput(""); setMobileOpen(false);
  }

  async function deleteConversation(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    if (!window.confirm("Hapus chat ini dari history? Chat dan semua pesannya akan dihapus permanen.")) return;
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" }).then((response) => readJson<{ ok: boolean }>(response));
      setConversations((items) => items.filter((item) => item.id !== id));
      if (activeId === id) newChat();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete conversation"); }
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading) return;
    setLoading(true); setError(""); setInput(""); setApproved(false); setRejected(false);
    // One key per logical send: a 401-token retry reuses it so the server
    // replays instead of duplicating the user turn.
    const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `send-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      let id = conversationId;
      let result: AssistantResponse;
      const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() };
      setMessages((items) => [...items, userMessage]);
      if (!id) {
        const created = await apiFetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ title: content.slice(0, 80), content }) }).then((response) => readJson<NewConversationResponse>(response));
        if (!created.conversation?.id) throw new Error("Could not create conversation");
        id = created.conversation.id;
        result = created;
        setConversationId(id); setActiveId(id); setConversations((items) => [created.conversation, ...items]);
      } else {
        result = await apiFetch(`/api/conversations/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ content }) }).then((response) => readJson<AssistantResponse>(response));
      }
      if (result.error) throw new Error(result.error);
      setAnswer(result); setDraft(result.draft_reply ?? ""); setDraftId(null); setSavedDraft(null); setHistory(null); setRestoredFromVersion(null); setMessages((items) => [...items, { id: result.message_id, role: "assistant", content: result.answer, citations: result.citations ?? [], created_at: result.created_at }]);
      setConversations((items) => items.map((item) => item.id === id ? { ...item, title: item.title || content.slice(0, 80), updated_at: new Date().toISOString() } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Unexpected error"); }
    finally { setLoading(false); }
  }

  async function saveDraft() {
    const content = draft;
    if (!conversationId || !content.trim() || approved) return null;
    try {
      const result = await apiFetch(draftId ? `/api/drafts/${draftId}` : `/api/conversations/${conversationId}/drafts`, { method: draftId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, restored_from_version: restoredFromVersion }) }).then((response) => readJson<{ id: string }>(response));
      setDraft(content); setDraftId(result.id); setSavedDraft(content); setHistory(null); setRestoredFromVersion(null); return result;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save draft"); return null; }
  }

  async function approve() {
    if (approving || approved || rejected) return;
    setApproving(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      await apiFetch(`/api/drafts/${saved.id}/approve`, { method: "POST" }).then((response) => readJson<{ ok: boolean }>(response));
      setApproved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not approve draft"); }
    finally { setApproving(false); }
  }

  async function reject() {
    if (rejecting || approved || rejected) return;
    // window.prompt, not a modal component — reason is optional feedback,
    // not a form worth its own UI state. Skip if adding structured reason
    // categories later.
    const reason = window.prompt("Kenapa draft ini ditolak? (opsional)")?.trim() || undefined;
    setRejecting(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      await apiFetch(`/api/drafts/${saved.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }).then((response) => readJson<{ id: string }>(response));
      setRejected(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reject draft"); }
    finally { setRejecting(false); }
  }

  async function copyDraft() { await navigator.clipboard?.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1600); }

  async function toggleHistory() {
    if (history) { setHistory(null); return; }
    if (!draftId) return;
    try {
      const data = await apiFetch(`/api/drafts/${draftId}/history`).then((response) => readJson<DraftVersion[]>(response));
      setHistory(data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load history"); }
  }

  function restoreVersion(content: string, version: number) { setDraft(content); setSavedDraft(null); setHistory(null); setRestoredFromVersion(version); }

  async function logout() {
    try { await supabase.auth.signOut(); } finally { router.push("/login"); }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
  }

  return <div className="flex h-dvh overflow-hidden bg-background text-foreground">
    {mobileOpen && <button className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[270px] -translate-x-full flex-col border-r bg-white transition-transform lg:relative lg:translate-x-0 ${mobileOpen ? "translate-x-0" : ""}`}>
      <div className="flex h-20 shrink-0 items-center gap-3 border-b px-[26px]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="font-semibold">CSCoPilot</p><p className="text-[11px] text-muted-foreground">Support chatbot</p></div><Button className="ml-auto lg:hidden" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></Button></div>
      <Button variant="outline" className="mx-3.5 mb-1 mt-4 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10" onClick={newChat}><Plus className="h-4 w-4" />New chat</Button>
      <div className="flex-1 overflow-y-auto px-3.5 py-2"><p className="px-1.5 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Recent</p>{conversations.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Belum ada percakapan</p> : conversations.map((item) => <div key={item.id} role="button" tabIndex={0} onClick={() => void selectConversation(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void selectConversation(item.id); } }} className={`group mb-0.5 flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-left text-sm ${activeId === item.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-slate-50"}`}><div className="min-w-0 flex-1"><span className="block truncate">{item.title || "New support case"}</span><small className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">{item.updated_at ? new Date(item.updated_at).toLocaleDateString("id-ID") : "Recent"}</small></div><button type="button" aria-label={`Hapus chat ${item.title || "ini"}`} title="Hapus chat" onClick={(event) => void deleteConversation(event, item.id)} className="ml-2 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
      <div className="shrink-0 border-t p-3.5"><button onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} className="flex w-full items-center gap-2.5 rounded-xl border border-primary/20 p-3 text-left shadow-[0_4px_14px_rgba(16,175,19,.06)] hover:bg-primary/5"><Avatar className="h-[34px] w-[34px] bg-primary"><AvatarFallback className="bg-primary text-[11px] font-bold text-white">CS</AvatarFallback></Avatar><div className="min-w-0"><p className="text-[13px] font-bold leading-tight">Customer Support</p><small className="mt-0.5 block text-[11px] text-muted-foreground">Timedoor Indonesia</small></div><ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} /></button>{profileOpen && <Button variant="outline" className="mt-2 w-full justify-start gap-2 text-destructive hover:bg-red-50 hover:text-destructive" onClick={() => void logout()}><LogOut className="h-4 w-4" />Logout</Button>}</div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-[18px] lg:hidden"><Button variant="outline" size="icon" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu className="h-4 w-4" /></Button><b>CSCoPilot</b></div>
      <header className="hidden h-20 shrink-0 items-center justify-between border-b bg-white px-8 lg:flex"><div><p className="text-xs font-bold text-primary">Customer Support Timedoor Indonesia</p><h1 className="mt-0.5 text-[19px] font-bold">{conversations.find((item) => item.id === activeId)?.title || "New conversation"}</h1></div><div className="flex items-center gap-1.5 text-xs text-emerald-600"><span>✓</span> Knowledge synced today</div></header>
      <div className="flex-1 overflow-y-auto py-8"><div className="mx-auto flex max-w-[760px] flex-col gap-[22px] px-6">
        {!loading && messages.length === 0 ? <div className="px-6 pb-2.5 pt-16 text-center"><div className="mx-auto mb-4.5 grid h-13 w-13 place-items-center rounded-[14px] bg-primary/10 text-2xl text-primary">✦</div><h2 className="mb-2 text-2xl font-bold tracking-tight">Mulai percakapan baru</h2><p className="mx-auto max-w-[420px] leading-7 text-muted-foreground">Jelaskan issue customer dengan bahasa natural. CSCoPilot akan mencari knowledge yang relevan dan memberikan jawaban beserta source reference.</p></div> : null}
        {messages.map((message) => <div key={message.id} className={`flex max-w-[88%] gap-3 ${message.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}><div className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-sm font-bold ${message.role === "user" ? "bg-slate-200 text-slate-700" : "bg-primary text-white"}`}>{message.role === "user" ? "CS" : "✦"}</div><div className={`min-w-0 break-words rounded-[14px] border px-4 py-3.5 leading-7 ${message.role === "user" ? "rounded-tr-[4px] border-primary bg-primary text-white" : "rounded-tl-[4px] bg-white"}`}><p className="whitespace-pre-line">{message.content}</p>{message.citations?.length ? <details className="mt-3"><summary className={`cursor-pointer text-xs font-semibold ${message.role === "user" ? "text-white/80" : "text-muted-foreground"}`}>Lihat sumber ({message.citations.length})</summary><div className="mt-1.5 grid gap-1.5">{message.citations.map((citation, index) => citation.url ? <a key={`${message.id}-${citation.document_id}-${index}`} href={citation.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground"><FileText className="h-3.5 w-3.5" /><b className="truncate text-foreground">{citation.title}</b><Badge className="ml-auto shrink-0 bg-green-100 text-green-700 hover:bg-green-100">Open source</Badge></a> : <div key={`${message.id}-${citation.document_id}-${index}`} className="flex items-center gap-2 rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /><b className="truncate text-foreground">{citation.title}</b><Badge className="ml-auto shrink-0 bg-slate-200 text-slate-600 hover:bg-slate-200">Source</Badge></div>)}</div></details> : null}{message.created_at ? <p className={`mt-2 text-[11px] ${message.role === "user" ? "text-white/70" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p> : null}</div></div>)}
        {answer?.missing_context?.length ? <div className="ml-[42px] max-w-[calc(88%-42px)] rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800"><b className="mb-0.5 block text-amber-900">Butuh informasi tambahan</b>{answer.missing_context.join(" ")}</div> : null}
        {loading && <div className="flex gap-3"><div className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-primary text-white">✦</div><div className="flex items-center gap-1 rounded-[14px] border bg-white px-4 py-3"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:.2s]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:.4s]" /></div></div>}
        {error && <Alert className="border-red-200 bg-red-50"><AlertTitle>Request failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {draft && answer && answer.intent !== "Greeting" && <div className="ml-[42px] max-w-[calc(88%-42px)] break-words rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">Suggested reply</p><div className="flex items-center gap-1">{draftId && <Button variant="ghost" size="sm" onClick={() => void toggleHistory()}><History className="h-4 w-4" />{history ? "Hide history" : "History"}</Button>}<Button variant="ghost" size="sm" onClick={() => void copyDraft()}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</Button></div></div>{history && <div className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-primary/10 bg-white p-2">{history.length === 0 ? <p className="p-1 text-xs text-muted-foreground">Belum ada versi sebelumnya.</p> : history.map((v) => <button key={v.id} type="button" onClick={() => restoreVersion(v.content, v.version)} className="block w-full rounded-md p-2 text-left text-xs hover:bg-muted"><span className="font-semibold">v{v.version}</span> · <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span><p className="mt-0.5 line-clamp-2 text-foreground/80">{v.content}</p></button>)}</div>}<Textarea value={draft} disabled={approved || approving || rejected || rejecting} onChange={(event) => { setDraft(event.target.value); setSavedDraft(null); }} className="min-h-24 resize-y bg-white" /><div className="mt-3 flex gap-2"><Button variant="outline" className="flex-1" disabled={approved || approving || rejected || rejecting} onClick={() => void saveDraft()}>{approved ? "Draft approved" : rejected ? "Draft rejected" : savedDraft === draft ? "Draft tersimpan" : "Save draft"}</Button><Button variant="outline" className="flex-1 text-destructive hover:text-destructive" disabled={approved || approving || rejected || rejecting} onClick={() => void reject()}>{rejected ? "Rejected" : rejecting ? "Rejecting..." : "Reject draft"}</Button><Button className="flex-1" disabled={approved || approving || rejected || rejecting} onClick={() => void approve()}>{approved ? "Approved" : approving ? "Approving..." : "Approve draft"}</Button></div></div>}
        <div ref={bottomRef} />
      </div></div>
      <div className="shrink-0 border-t bg-white px-[18px] pb-5 pt-4 lg:px-8 lg:pb-[26px]"><div className="mx-auto flex max-w-[760px] flex-col gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Coba tanyakan</p><div className="flex gap-2.5 overflow-x-auto pb-1">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} className="whitespace-nowrap rounded-full border bg-white px-4 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary">{suggestion}</button>)}</div></div><div className="flex items-end gap-3 rounded-2xl border bg-white px-5 py-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} placeholder="Jelaskan issue customer..." className="max-h-36 min-h-6 resize-none border-0 p-2 leading-6 shadow-none focus-visible:ring-0" /><Button size="icon" aria-label="Send message" disabled={!input.trim() || loading} onClick={() => void sendMessage()} className="h-10 w-10 shrink-0 rounded-xl"><Send className="h-4 w-4" /></Button></div><p className="m-0 text-center text-[11px] leading-5 text-muted-foreground">CSCoPilot menjawab berdasarkan knowledge yang tersedia. Selalu periksa source sebelum digunakan kepada client.</p></div></div>
    </main>
  </div>;
}

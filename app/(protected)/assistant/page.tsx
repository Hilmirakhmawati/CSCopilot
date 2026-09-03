"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clipboard, FileText, LogOut, Menu, Plus, Send, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabasePublic } from "@/lib/db";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Citation, GroundedAnswer } from "@/lib/assistant-types";

type Conversation = { id: string; title: string | null; updated_at?: string };
type Message = { id: string; role: "user" | "assistant" | "system"; content: string; citations?: Citation[]; created_at?: string };

const suggestions = ["Cari SOP keterlambatan respons", "Bagaimana menangani pembayaran gagal?", "Template balasan pembuka"];
const initialMessage: Message = { id: "welcome", role: "assistant", content: "Halo, ceritakan issue yang sedang ditangani. Saya akan mencari solusi dari knowledge perusahaan." }; // Kept for active threads with no persisted messages.

async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data } = await getSupabasePublic().auth.getSession();
  const headers = new Headers(init?.headers);
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/api/conversations").then((response) => response.json()).then((data) => {
      if (Array.isArray(data)) setConversations(data);
    }).catch(() => undefined);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function selectConversation(id: string) {
    setError(""); setMobileOpen(false); setActiveId(id); setConversationId(id); setAnswer(null); setDraft(""); setDraftId(null); setApproved(false);
    const response = await apiFetch(`/api/conversations/${id}/messages`);
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Could not load conversation");
    setMessages(data.length ? data : [initialMessage]);
  }

  function newChat() {
    setActiveId(null); setConversationId(null); setMessages([]); setAnswer(null); setDraft(""); setDraftId(null); setApproved(false); setError(""); setInput(""); setMobileOpen(false);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading) return;
    setLoading(true); setError(""); setInput(""); setApproved(false);
    try {
      let id = conversationId;
      if (!id) {
        const conversation = await apiFetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: content.slice(0, 80) }) }).then((r) => r.json());
        if (!conversation.id) throw new Error(conversation.error ?? "Could not create conversation");
        id = conversation.id; setConversationId(id); setActiveId(id); setConversations((items) => [conversation, ...items]);
      }
      const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() };
      setMessages((items) => [...items, userMessage]);
      const result = await apiFetch(`/api/conversations/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }).then((r) => r.json());
      if (result.error) throw new Error(result.error);
      setAnswer(result); setDraft(result.draft_reply ?? ""); setDraftId(null); setMessages((items) => [...items, { id: result.message_id, role: "assistant", content: result.answer, citations: result.citations ?? [], created_at: result.created_at }]);
      setConversations((items) => items.map((item) => item.id === id ? { ...item, title: item.title || content.slice(0, 80), updated_at: new Date().toISOString() } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Unexpected error"); }
    finally { setLoading(false); }
  }

  async function saveDraft() {
    if (!conversationId || !draft.trim()) return null;
    const response = await apiFetch(draftId ? `/api/drafts/${draftId}` : `/api/conversations/${conversationId}/drafts`, { method: draftId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not save draft"); return null; }
    setDraftId(result.id); return result;
  }

  async function approve() {
    const saved = await saveDraft();
    if (!saved && !draftId) return;
    const response = await apiFetch(`/api/drafts/${draftId ?? saved.id}/approve`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) return setError(result.error ?? "Could not approve draft");
    setApproved(true);
  }

  async function copyDraft() { await navigator.clipboard?.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1600); }

  async function logout() {
    try { await getSupabasePublic().auth.signOut(); } finally { router.push("/login"); }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
  }

  return <div className="flex h-dvh overflow-hidden bg-background text-foreground">
    {mobileOpen && <button className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-[270px] -translate-x-full flex-col border-r bg-white transition-transform lg:relative lg:translate-x-0 ${mobileOpen ? "translate-x-0" : ""}`}>
      <div className="flex h-20 shrink-0 items-center gap-3 border-b px-[26px]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="font-semibold">CSCoPilot</p><p className="text-[11px] text-muted-foreground">Support chatbot</p></div><Button className="ml-auto lg:hidden" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></Button></div>
      <Button variant="outline" className="mx-3.5 mb-1 mt-4 border-primary/25 bg-primary/5 text-primary hover:bg-primary/10" onClick={newChat}><Plus className="h-4 w-4" />New chat</Button>
      <div className="flex-1 overflow-y-auto px-3.5 py-2"><p className="px-1.5 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Recent</p>{conversations.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Belum ada percakapan</p> : conversations.map((item) => <button key={item.id} onClick={() => void selectConversation(item.id)} className={`mb-0.5 block w-full rounded-lg px-3 py-2.5 text-left text-sm ${activeId === item.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-slate-50"}`}><span className="block truncate">{item.title || "New support case"}</span><small className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">{item.updated_at ? new Date(item.updated_at).toLocaleDateString("id-ID") : "Recent"}</small></button>)}</div>
      <div className="shrink-0 border-t p-3.5"><button onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen} className="flex w-full items-center gap-2.5 rounded-xl border border-primary/20 p-3 text-left shadow-[0_4px_14px_rgba(16,175,19,.06)] hover:bg-primary/5"><Avatar className="h-[34px] w-[34px] bg-primary"><AvatarFallback className="bg-primary text-[11px] font-bold text-white">CS</AvatarFallback></Avatar><div className="min-w-0"><p className="text-[13px] font-bold leading-tight">Customer Support</p><small className="mt-0.5 block text-[11px] text-muted-foreground">Timedoor Indonesia</small></div><ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} /></button>{profileOpen && <Button variant="outline" className="mt-2 w-full justify-start gap-2 text-destructive hover:bg-red-50 hover:text-destructive" onClick={() => void logout()}><LogOut className="h-4 w-4" />Logout</Button>}</div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-[18px] lg:hidden"><Button variant="outline" size="icon" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu className="h-4 w-4" /></Button><b>CSCoPilot</b></div>
      <header className="hidden h-20 shrink-0 items-center justify-between border-b bg-white px-8 lg:flex"><div><p className="text-xs font-bold text-primary">Customer Support Timedoor Indonesia</p><h1 className="mt-0.5 text-[19px] font-bold">{conversations.find((item) => item.id === activeId)?.title || "New conversation"}</h1></div><div className="flex items-center gap-1.5 text-xs text-emerald-600"><span>✓</span> Knowledge synced today</div></header>
      <div className="flex-1 overflow-y-auto py-8"><div className="mx-auto flex max-w-[760px] flex-col gap-[22px] px-6">
        {!loading && messages.length === 0 ? <div className="px-6 pb-2.5 pt-16 text-center"><div className="mx-auto mb-4.5 grid h-13 w-13 place-items-center rounded-[14px] bg-primary/10 text-2xl text-primary">✦</div><h2 className="mb-2 text-2xl font-bold tracking-tight">Mulai percakapan baru</h2><p className="mx-auto max-w-[420px] leading-7 text-muted-foreground">Jelaskan issue customer dengan bahasa natural. CSCoPilot akan mencari knowledge yang relevan dan memberikan jawaban beserta source reference.</p></div> : null}
        {messages.map((message) => <div key={message.id} className={`flex max-w-[88%] gap-3 ${message.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}><div className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-sm font-bold ${message.role === "user" ? "bg-slate-200 text-slate-700" : "bg-primary text-white"}`}>{message.role === "user" ? "CS" : "✦"}</div><div className={`min-w-0 break-words rounded-[14px] border px-4 py-3.5 leading-7 ${message.role === "user" ? "rounded-tr-[4px] border-primary bg-primary text-white" : "rounded-tl-[4px] bg-white"}`}><p className="whitespace-pre-line">{message.content}</p>{message.citations?.length ? <details className="mt-3"><summary className={`cursor-pointer text-xs font-semibold ${message.role === "user" ? "text-white/80" : "text-muted-foreground"}`}>Lihat sumber ({message.citations.length})</summary><div className="mt-1.5 grid gap-1.5">{message.citations.map((citation) => citation.url ? <a key={`${message.id}-${citation.document_id}`} href={citation.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground"><FileText className="h-3.5 w-3.5" /><b className="truncate text-foreground">{citation.title}</b><Badge className="ml-auto shrink-0 bg-green-100 text-green-700 hover:bg-green-100">Open source</Badge></a> : <div key={`${message.id}-${citation.document_id}`} className="flex items-center gap-2 rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /><b className="truncate text-foreground">{citation.title}</b><Badge className="ml-auto shrink-0 bg-slate-200 text-slate-600 hover:bg-slate-200">Source</Badge></div>)}</div></details> : null}{message.created_at ? <p className={`mt-2 text-[11px] ${message.role === "user" ? "text-white/70" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p> : null}</div></div>)}
        {answer?.missing_context?.length ? <div className="ml-[42px] max-w-[calc(88%-42px)] rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800"><b className="mb-0.5 block text-amber-900">Butuh informasi tambahan</b>{answer.missing_context.join(" ")}</div> : null}
        {loading && <div className="flex gap-3"><div className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-primary text-white">✦</div><div className="flex items-center gap-1 rounded-[14px] border bg-white px-4 py-3"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:.2s]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:.4s]" /></div></div>}
        {error && <Alert className="border-red-200 bg-red-50"><AlertTitle>Request failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {draft && answer && <div className="ml-[42px] max-w-[calc(88%-42px)] break-words rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">Suggested reply</p><Button variant="ghost" size="sm" onClick={() => void copyDraft()}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}{copied ? "Copied" : "Copy"}</Button></div><Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-24 resize-y bg-white" /><div className="mt-3 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => void saveDraft()}>Save draft</Button><Button className="flex-1" disabled={approved} onClick={() => void approve()}>{approved ? "Approved" : "Approve draft"}</Button></div></div>}
        <div ref={bottomRef} />
      </div></div>
      <div className="shrink-0 border-t bg-white px-[18px] pb-5 pt-4 lg:px-8 lg:pb-[26px]"><div className="mx-auto flex max-w-[760px] flex-col gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Coba tanyakan</p><div className="flex gap-2.5 overflow-x-auto pb-1">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} className="whitespace-nowrap rounded-full border bg-white px-4 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary">{suggestion}</button>)}</div></div><div className="flex items-end gap-3 rounded-2xl border bg-white px-5 py-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} rows={1} placeholder="Jelaskan issue customer..." className="max-h-36 min-h-6 resize-none border-0 p-2 leading-6 shadow-none focus-visible:ring-0" /><Button size="icon" aria-label="Send message" disabled={!input.trim() || loading} onClick={() => void sendMessage()} className="h-10 w-10 shrink-0 rounded-xl"><Send className="h-4 w-4" /></Button></div><p className="m-0 text-center text-[11px] leading-5 text-muted-foreground">CSCoPilot menjawab berdasarkan knowledge yang tersedia. Selalu periksa source sebelum digunakan kepada client.</p></div></div>
    </main>
  </div>;
}

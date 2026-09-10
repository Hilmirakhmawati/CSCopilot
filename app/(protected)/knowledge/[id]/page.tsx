"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabasePublic } from "@/lib/db";

type KnowledgeDetail = { id: string; title: string; url: string | null; category: string | null; content: string; synced_at: string };

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<KnowledgeDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabasePublic().auth.getSession().then(({ data: session }) => {
      const headers = new Headers();
      if (session.session?.access_token) headers.set("Authorization", `Bearer ${session.session.access_token}`);
      return fetch(`/api/knowledge/${id}`, { headers });
    }).then(async (response) => {
      if (response.status === 404) { setMissing(true); return; }
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Could not load knowledge");
      setItem(data);
    }).catch((e) => setError(e instanceof Error ? e.message : "Could not load knowledge")).finally(() => setLoading(false));
  }, [id]);

  if (missing) notFound();

  return <AppShell active="knowledge"><div className="mx-auto max-w-4xl space-y-8">
    <Button asChild variant="ghost" className="-ml-3"><Link href="/knowledge"><ArrowLeft className="h-4 w-4" />Back to Knowledge Hub</Link></Button>
    {loading ? <Card className="h-40 animate-pulse bg-muted/40" /> : error ? <Alert className="border-red-200 bg-red-50"><AlertTitle>Knowledge unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : item ? <>
      <section><div className="flex flex-wrap items-center gap-2"><Badge>{item.category ?? "General"}</Badge><span className="text-sm text-muted-foreground">Synced {new Date(item.synced_at).toLocaleString()}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1></section>
      <Alert className="border-blue-200 bg-blue-50/60"><LockKeyhole className="h-4 w-4 text-primary" /><AlertTitle>Notion is the source of truth</AlertTitle><AlertDescription>Dokumen ini read-only di CSCoPilot. Perubahan utama dilakukan pada Notion dan akan tampil setelah sinkronisasi.</AlertDescription></Alert>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Knowledge content</CardTitle></CardHeader><CardContent><div className="whitespace-pre-line break-words text-sm leading-8 text-slate-700">{item.content}</div></CardContent></Card>
      <Card className="bg-muted/40"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">Source reference</p><p className="mt-1 text-sm text-muted-foreground">{item.url ?? "Notion"}</p></div>{item.url ? <Button asChild variant="outline" size="sm"><a href={item.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Open source</a></Button> : <Button variant="outline" size="sm" disabled><ExternalLink className="h-4 w-4" />Source unavailable</Button>}</CardContent></Card>
    </> : null}
  </div></AppShell>;
}

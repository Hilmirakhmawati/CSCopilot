"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { KnowledgeCard } from "@/components/knowledge/knowledge-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { categories, type Category, type KnowledgeItem } from "@/lib/mock-data";

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/knowledge").then((r) => r.json()).then((data) => {
      if (data.error) { setError(data.error); setItems([]); return; }
      const mapped = (data as Array<{ id: string; title: string; category: string | null; content: string; url: string | null; synced_at: string }>).map((row) => ({
        id: row.id, title: row.title, category: row.category as KnowledgeItem["category"], excerpt: row.content.slice(0, 140), content: row.content, source: row.url ?? "Notion", synced: new Date(row.synced_at).toLocaleString(),
      }));
      setItems(mapped);
    }).catch(() => setError("Could not load knowledge"));
  }, []);
  const filtered = useMemo(() => items.filter((item) => (category === "All" || item.category === category) && `${item.title} ${item.excerpt} ${item.content}`.toLowerCase().includes(query.toLowerCase())), [category, items, query]);
  return <AppShell active="knowledge"><div className="space-y-8"><section><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div><div><p className="text-sm font-medium text-primary">Knowledge Hub</p><h1 className="text-3xl font-semibold tracking-tight">Find the right knowledge</h1></div></div><p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Akses cepat ke dokumentasi yang disinkronkan dari Notion. Source of truth tetap berada di Notion.</p></section><Card><CardContent className="p-4 sm:p-6"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search knowledge" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SOP, FAQ, troubleshooting..." className="h-11 pl-10" /></div><div className="mt-4 flex flex-wrap items-center gap-2"><SlidersHorizontal className="mr-1 h-4 w-4 text-muted-foreground" />{categories.map((item) => <Button key={item} onClick={() => setCategory(item)} variant={category === item ? "default" : "outline"} size="sm">{item}</Button>)}</div></CardContent></Card><div className="flex items-center justify-between"><div><p className="font-medium">{filtered.length} knowledge found</p><p className="text-sm text-muted-foreground">{error || "Showing synced company knowledge"}</p></div><Badge variant="outline">Notion source</Badge></div>{filtered.length > 0 ? <div className="grid gap-5 md:grid-cols-2">{filtered.map((item) => <KnowledgeCard item={item} key={item.id} />)}</div> : <Alert><AlertTitle>No knowledge found</AlertTitle><AlertDescription>Coba kata kunci lain atau jalankan sinkronisasi Notion. <Link className="text-primary underline" href="/knowledge">Refresh</Link></AlertDescription></Alert>}</div></AppShell>;
}

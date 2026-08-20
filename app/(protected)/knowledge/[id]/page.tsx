import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { knowledgeItems } from "@/lib/mock-data";

export function generateStaticParams() { return knowledgeItems.map((item) => ({ id: item.id })); }
export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const item = knowledgeItems.find((entry) => entry.id === id); if (!item) notFound(); return <AppShell active="knowledge"><div className="mx-auto max-w-4xl space-y-8"><Button asChild variant="ghost" className="-ml-3"><Link href="/knowledge"><ArrowLeft className="h-4 w-4" />Back to Knowledge Hub</Link></Button><section><div className="flex flex-wrap items-center gap-2"><Badge>{item.category}</Badge><span className="text-sm text-muted-foreground">Synced {item.synced}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1><p className="mt-3 text-muted-foreground">{item.excerpt}</p></section><Alert className="border-blue-200 bg-blue-50/60"><LockKeyhole className="h-4 w-4 text-primary" /><AlertTitle>Notion is the source of truth</AlertTitle><AlertDescription>Dokumen ini read-only di CSCoPilot. Perubahan utama dilakukan pada Notion dan akan tampil setelah sinkronisasi.</AlertDescription></Alert><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Knowledge content</CardTitle></CardHeader><CardContent><div className="whitespace-pre-line text-sm leading-8 text-slate-700">{item.content}</div></CardContent></Card><Card className="bg-muted/40"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">Source reference</p><p className="mt-1 text-sm text-muted-foreground">{item.source}</p></div><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" />Open source</Button></CardContent></Card></div></AppShell>; }

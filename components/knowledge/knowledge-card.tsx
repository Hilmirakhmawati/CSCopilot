import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeItem } from "@/lib/mock-data";

export function KnowledgeCard({ item }: { item: KnowledgeItem }) { return <Card className="group transition-shadow hover:shadow-soft"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><Badge variant="secondary">{item.category}</Badge><Link href={`/knowledge/${item.id}`} className="rounded-md text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100" aria-label={`Buka ${item.title}`}><ArrowUpRight className="h-4 w-4" /></Link></div><CardTitle className="text-base leading-snug"><Link href={`/knowledge/${item.id}`} className="hover:text-primary">{item.title}</Link></CardTitle></CardHeader><CardContent><p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.excerpt}</p><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Synced {item.synced}</div></CardContent></Card>; }

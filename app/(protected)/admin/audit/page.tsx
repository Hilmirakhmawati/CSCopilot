"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabasePublic } from "@/lib/db";

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles: { email: string } | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabasePublic().auth.getSession().then(({ data: session }) => {
      const headers = new Headers();
      if (session.session?.access_token) headers.set("Authorization", `Bearer ${session.session.access_token}`);
      return fetch("/api/admin/audit?limit=50", { headers });
    }).then((r) => r.json()).then((data) => {
      if (data.error) { setError(data.error); setRows([]); return; }
      setRows(data as AuditRow[]);
    }).catch(() => setError("Could not load audit log")).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell active="audit">
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Admin</p>
              <h1 className="text-3xl font-semibold tracking-tight">Audit Log</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Riwayat aksi admin dan draft terbaru, urut dari yang terbaru.</p>
        </section>
        {loading ? (
          <Card className="h-40 animate-pulse bg-muted/40" aria-label="Loading audit log" />
        ) : error ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertTitle>Audit log unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <Alert>
            <AlertTitle>No audit events yet</AlertTitle>
            <AlertDescription>Aksi admin dan draft akan muncul di sini.</AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{row.action} <span className="text-muted-foreground">· {row.entity_type}</span></p>
                    <p className="truncate text-sm text-muted-foreground">{row.profiles?.email ?? "system"} {row.entity_id ? `· ${row.entity_id.slice(0, 8)}` : ""}</p>
                    {typeof row.metadata?.query === "string" && (
                      <p className="truncate text-sm italic text-muted-foreground">"{row.metadata.query}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{new Date(row.created_at).toLocaleString()}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

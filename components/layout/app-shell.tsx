"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, LogOut, Menu, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSupabasePublic } from "@/lib/db";

export function AppShell({ children, active }: { children: React.ReactNode; active: "dashboard" | "knowledge" | "assistant" }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: "/assistant", key: "assistant" as const, label: "AI Assistant", icon: Bot },
  ];

  async function logout() {
    await getSupabasePublic().auth.signOut();
    router.push("/login");
  }

  const navigation = <nav className="flex-1 space-y-1 p-4"><p className="px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>{nav.map(({ href, key, label, icon: Icon }) => <Link key={key} href={href} onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4" />{label}</Link>)}</nav>;
  const profile = <div className="border-t p-4"><div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3"><Avatar><AvatarFallback>CS</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Customer Support</p><p className="truncate text-xs text-muted-foreground">Timedoor Indonesia</p></div><Button variant="ghost" size="icon" aria-label="Logout" onClick={() => void logout()}><LogOut className="h-4 w-4" /></Button></div></div>;

  return <div className="min-h-screen bg-background lg:flex">
    {mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r bg-white transition-transform lg:relative lg:translate-x-0", mobileOpen && "translate-x-0")}>
      <div className="flex h-20 items-center gap-3 border-b px-7"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="font-semibold tracking-tight">CSCoPilot</p><p className="text-xs text-muted-foreground">Support workspace</p></div><Button className="ml-auto lg:hidden" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></Button></div>
      {navigation}
      {profile}
    </aside>
    <div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b bg-white px-5 lg:px-10"><div className="flex items-center gap-3"><Button className="lg:hidden" variant="outline" size="icon" aria-label="Open menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu className="h-4 w-4" /></Button><div className="flex items-center gap-3 lg:hidden"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div><span className="font-semibold">CSCoPilot</span></div></div><div className="flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:inline">Support workspace</span><Avatar className="h-9 w-9 lg:hidden"><AvatarFallback>CS</AvatarFallback></Avatar></div></header><main className="mx-auto w-full max-w-7xl p-5 lg:p-10">{children}</main></div>
  </div>;
}

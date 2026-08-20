import Link from "next/link";
import { BookOpen, Bot, LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({ children, active }: { children: React.ReactNode; active: "dashboard" | "knowledge" | "assistant" }) {
  const nav = [
    { href: "/dashboard", key: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { href: "/knowledge", key: "knowledge" as const, label: "Knowledge Hub", icon: BookOpen },
    { href: "/assistant", key: "assistant" as const, label: "AI Assistant", icon: Bot },
  ];
  return <div className="min-h-screen bg-background lg:flex">
    <aside className="hidden w-72 shrink-0 border-r bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center gap-3 border-b px-7"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="font-semibold tracking-tight">CSCoPilot</p><p className="text-xs text-muted-foreground">Support workspace</p></div></div>
      <nav className="flex-1 space-y-1 p-4"><p className="px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>{nav.map(({ href, key, label, icon: Icon }) => <Link key={key} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4" />{label}</Link>)}</nav>
      <div className="border-t p-4"><div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3"><Avatar><AvatarFallback>AD</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Ayu Dewi</p><p className="truncate text-xs text-muted-foreground">Customer Support</p></div><Button variant="ghost" size="icon" aria-label="Logout"><LogOut className="h-4 w-4" /></Button></div></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b bg-white px-5 lg:px-10"><div className="flex items-center gap-3 lg:hidden"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div><span className="font-semibold">CSCoPilot</span></div><div className="ml-auto flex items-center gap-3"><span className="hidden text-sm text-muted-foreground sm:inline">Tuesday, 11 August 2026</span><Avatar className="h-9 w-9 lg:hidden"><AvatarFallback>AD</AvatarFallback></Avatar></div></header><main className="mx-auto w-full max-w-7xl p-5 lg:p-10">{children}</main></div>
  </div>;
}

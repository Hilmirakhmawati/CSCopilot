"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BookOpen, Bot, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabasePublic } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    const nextEmailError = !normalizedEmail ? "Email wajib diisi." : !emailPattern.test(normalizedEmail) ? "Format email tidak valid." : "";
    const nextPasswordError = !password ? "Password wajib diisi." : "";
    setEmailError(nextEmailError); setPasswordError(nextPasswordError); setError("");
    if (nextEmailError || nextPasswordError) return;

    setLoading(true);
    try {
      const { error: authError } = await getSupabasePublic().auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) {
        const code = "code" in authError ? authError.code : undefined;
        if (code === "invalid_credentials" || /invalid login credentials|user not found/i.test(authError.message)) {
          throw new Error("Email atau password salah. Periksa kembali lalu coba lagi.");
        }
        if (code === "email_not_confirmed") throw new Error("Email belum dikonfirmasi. Cek inbox email Anda.");
        throw new Error("Login gagal. Periksa koneksi atau konfigurasi Supabase.");
      }
      router.push("/assistant");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login gagal. Coba lagi.");
    } finally { setLoading(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5"><div className="grid w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]"><section className="hidden bg-gradient-to-br from-[#10AF13] to-[#0c4a0e] p-12 text-white lg:block"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Sparkles className="h-5 w-5" /></div><span className="font-semibold">CSCoPilot</span></div><div className="mt-28 max-w-md"><p className="mb-4 text-sm font-medium text-green-100">Internal chatbot</p><h1 className="text-4xl font-semibold leading-tight tracking-tight">Tanya issue-nya. Langsung dapat jawaban.</h1><p className="mt-5 leading-7 text-green-50/80">Chatbot internal untuk Customer Support. Temukan knowledge yang relevan, jawaban, dan referensi sumber dalam satu percakapan.</p><div className="mt-10 grid gap-3 text-sm text-green-50/85"><div className="flex items-center gap-3"><BookOpen className="h-4 w-4" />Knowledge dari Notion</div><div className="flex items-center gap-3"><Bot className="h-4 w-4" />Jawaban berbasis konteks</div></div></div></section><section className="p-6 sm:p-12"><div className="mx-auto max-w-sm"><Card className="border-0 shadow-none"><CardHeader className="px-0"><p className="mb-2 text-sm font-medium text-primary">Internal System</p><CardTitle className="text-3xl tracking-tight">Welcome back</CardTitle><CardDescription className="pt-1">Masuk untuk mengakses CSCoPilot chatbot.</CardDescription></CardHeader><CardContent className="px-0"><form className="space-y-4" onSubmit={login} noValidate><div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="email">Email perusahaan</label><input id="email" className={`h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${emailError ? "border-red-400" : ""}`} type="email" autoComplete="email" placeholder="cs@timedoor.net" value={email} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined} onChange={(e) => { setEmail(e.target.value); setEmailError(""); setError(""); }} />{emailError && <p id="email-error" className="mt-1.5 text-xs text-red-600">{emailError}</p>}</div><div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="password">Password</label><input id="password" className={`h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${passwordError ? "border-red-400" : ""}`} type="password" autoComplete="current-password" placeholder="Password" value={password} aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? "password-error" : undefined} onChange={(e) => { setPassword(e.target.value); setPasswordError(""); setError(""); }} />{passwordError && <p id="password-error" className="mt-1.5 text-xs text-red-600">{passwordError}</p>}</div>{error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}<Button type="submit" disabled={loading} className="h-11 w-full">{loading ? "Memeriksa..." : <>Masuk <ArrowRight className="h-4 w-4" /></>}</Button><p className="text-center text-xs text-muted-foreground">Akses mengikuti kebijakan Internal System.</p></form></CardContent></Card></div></section></div></main>;
}

"use client";

export default function AssistantError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-semibold">Halaman assistant gagal dimuat.</p>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <button className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground" onClick={reset}>Coba lagi</button>
    </main>
  );
}

import { Button } from "@/components/ui/button";
import type { Conversation } from "./types";

type Props = { item: Conversation; deleting: boolean; onCancel: () => void; onConfirm: () => void };

export function DeleteDialog({ item, deleting, onCancel, onConfirm }: Props) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={() => { if (!deleting) onCancel(); }}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc" onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-xl">
      <h2 id="delete-title" className="text-lg font-bold">Hapus chat ini?</h2>
      <p id="delete-desc" className="mt-1.5 text-sm leading-6 text-muted-foreground">Semua pesan dalam chat ini akan dihapus secara permanen dan tidak dapat dipulihkan.</p>
      <p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium">{item.title || "New support case"}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" autoFocus disabled={deleting} onClick={onCancel}>Batal</Button>
        <Button variant="destructive" disabled={deleting} onClick={onConfirm}>{deleting ? "Menghapus..." : "Hapus"}</Button>
      </div>
    </div>
  </div>;
}

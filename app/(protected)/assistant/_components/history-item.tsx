import { Check, Pencil, Trash2, X } from "lucide-react";
import type { Conversation } from "./types";

type Props = {
  item: Conversation;
  active: boolean;
  editing: boolean;
  editTitle: string;
  onEditTitleChange: (value: string) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  english: boolean;
};

export function HistoryItem({ item, active, editing, editTitle, onEditTitleChange, onSelect, onStartEdit, onCommit, onCancel, onDelete, english }: Props) {
  const title = item.title || "New support case";
  return <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }} className={`group mb-0.5 flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-left text-sm ${active ? "bg-primary/10 font-semibold text-primary" : "hover:bg-slate-50"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}>{editing ? <><input autoFocus aria-label={english ? "Chat name" : "Nama chat"} maxLength={120} value={editTitle} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onEditTitleChange(event.target.value)} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); onCommit(); } else if (event.key === "Escape") onCancel(); }} onBlur={onCancel} className="min-w-0 flex-1 rounded border border-primary/40 bg-white px-2 py-1 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/30" /><button type="button" aria-label={english ? "Save chat name" : "Simpan nama chat"} title={english ? "Save" : "Simpan"} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); onCommit(); }} className="ml-1 shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"><Check className="h-4 w-4" /></button><button type="button" aria-label={english ? "Cancel rename" : "Batal ubah nama"} title={english ? "Cancel" : "Batal"} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); onCancel(); }} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"><X className="h-4 w-4" /></button></> : <><div className="min-w-0 flex-1"><span className="block truncate">{title}</span><small className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">{item.updated_at ? new Date(item.updated_at).toLocaleDateString("id-ID") : (english ? "Recent" : "Terbaru")}</small></div><button type="button" aria-label={`${english ? "Rename chat" : "Ubah nama chat"} ${title}`} title={english ? "Rename chat" : "Ubah nama chat"} onClick={(event) => { event.stopPropagation(); onStartEdit(); }} className="ml-1 shrink-0 rounded-md p-1.5 text-muted-foreground opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`${english ? "Delete chat" : "Hapus chat"} ${title}`} title={english ? "Delete chat" : "Hapus chat"} onClick={(event) => { event.stopPropagation(); onDelete(); }} className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button></>}</div>;
}

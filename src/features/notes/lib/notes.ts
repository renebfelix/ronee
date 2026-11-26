import type { Note, NoteFolder } from "./types";

export const FOLDER_COLORS = ["#5b5bf0", "#1f8ae0", "#16a571", "#d98a06", "#e0384f", "#c04fd8", "#0ea5a4", "#64748b"];

export const EXCERPT_LENGTH = 240;

export function excerptOf(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > EXCERPT_LENGTH ? `${clean.slice(0, EXCERPT_LENGTH)}…` : clean;
}

export function countWords(text: string) {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Pastas filhas de `parentId`, em ordem alfabética. */
export function childFolders(folders: NoteFolder[], parentId: string | null) {
  return folders
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

/** Ids da pasta e de todas as suas descendentes. */
export function descendantIds(folders: NoteFolder[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Caminho da raiz até a pasta (inclusive). */
export function folderPath(folders: NoteFolder[], id: string | null): NoteFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: NoteFolder[] = [];
  let cur = id ? byId.get(id) : undefined;
  while (cur && path.length < 50) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** Fixadas primeiro, depois as editadas mais recentemente. */
export function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

export function normalize(s: string) {
  return s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function formatUpdated(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

export function safeFileName(title: string) {
  return (title.trim() || "nota").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

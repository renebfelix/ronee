"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc, writeBatch, type DocumentReference } from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { FOLDER_COLORS } from "../lib/notes";
import type { Note, NoteFolder, NoteKind } from "../lib/types";

/**
 * Dados em `users/{uid}/modules/notes/...`:
 * - `folders/{id}` → { name, parentId, color, createdAt }
 * - `notes/{id}` → { title, folderId, kind, pinned, excerpt, words, createdAt, updatedAt } (só metadados)
 * - `contents/{id}` → { html } (conteúdo completo, carregado ao abrir a nota)
 */
type Col = "folders" | "notes";
const COLS: Col[] = ["folders", "notes"];

export interface SaveContentInput {
  title: string;
  html: string;
  excerpt: string;
  words: number;
}

export interface NotesData {
  folders: NoteFolder[];
  notes: Note[];

  addFolder: (name: string, parentId: string | null, color?: string) => Promise<string>;
  updateFolder: (id: string, data: Partial<Omit<NoteFolder, "id">>) => Promise<void>;
  /** Exclui a pasta; subpastas e notas sobem para a pasta-mãe. */
  removeFolder: (id: string) => Promise<void>;

  createNote: (input: { kind: NoteKind; folderId: string | null; title?: string; html?: string }) => Promise<string>;
  updateNote: (id: string, data: Partial<Omit<Note, "id">>) => Promise<void>;
  saveContent: (id: string, input: SaveContentInput) => Promise<void>;
  loadContent: (id: string) => Promise<string>;
  duplicateNote: (id: string) => Promise<string>;
  removeNote: (id: string) => Promise<void>;
}

const NotesContext = createContext<NotesData | null>(null);

interface Raw {
  folders: NoteFolder[];
  notes: Note[];
}

export function NotesDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [raw, setRaw] = useState<Raw>({ folders: [], notes: [] });
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "notes"), [uid]);
  const col = useCallback((name: string) => collection(moduleDoc(), name), [moduleDoc]);
  const ref = useCallback((name: string, id: string) => doc(moduleDoc(), name, id) as DocumentReference, [moduleDoc]);

  useEffect(() => {
    const unsubs = COLS.map((name) =>
      onSnapshot(
        col(name),
        (snap) => {
          const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          setRaw((prev) => ({ ...prev, [name]: docs }));
          setReady((r) => ({ ...r, [name]: true }));
        },
        () => setError(true),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [col]);

  const value = useMemo<NotesData>(
    () => ({
      folders: raw.folders,
      notes: raw.notes,

      addFolder: async (name, parentId, color) => {
        const r = doc(col("folders"));
        await setDoc(r, {
          name,
          parentId,
          color: color ?? FOLDER_COLORS[raw.folders.length % FOLDER_COLORS.length],
          createdAt: Date.now(),
        });
        return r.id;
      },
      updateFolder: (id, data) => updateDoc(ref("folders", id), data),
      removeFolder: async (id) => {
        const folder = raw.folders.find((f) => f.id === id);
        const parentId = folder?.parentId ?? null;
        const batch = writeBatch(getDb());
        raw.folders.filter((f) => f.parentId === id).forEach((f) => batch.update(ref("folders", f.id), { parentId }));
        raw.notes.filter((n) => n.folderId === id).forEach((n) => batch.update(ref("notes", n.id), { folderId: parentId }));
        batch.delete(ref("folders", id));
        await batch.commit();
      },

      createNote: async ({ kind, folderId, title = "", html = "" }) => {
        const r = doc(col("notes"));
        const now = Date.now();
        const batch = writeBatch(getDb());
        batch.set(r, { title, folderId, kind, pinned: false, excerpt: "", words: 0, createdAt: now, updatedAt: now });
        batch.set(ref("contents", r.id), { html });
        await batch.commit();
        return r.id;
      },
      updateNote: (id, data) => updateDoc(ref("notes", id), data),
      saveContent: async (id, { title, html, excerpt, words }) => {
        const batch = writeBatch(getDb());
        batch.update(ref("notes", id), { title, excerpt, words, updatedAt: Date.now() });
        batch.set(ref("contents", id), { html });
        await batch.commit();
      },
      loadContent: async (id) => {
        const snap = await getDoc(ref("contents", id));
        return snap.exists() ? ((snap.data().html as string | undefined) ?? "") : "";
      },
      duplicateNote: async (id) => {
        const src = raw.notes.find((n) => n.id === id);
        if (!src) throw new Error("Nota não encontrada.");
        const snap = await getDoc(ref("contents", id));
        const html = snap.exists() ? ((snap.data().html as string | undefined) ?? "") : "";
        const r = doc(col("notes"));
        const now = Date.now();
        const { id: _omit, ...meta } = src;
        void _omit;
        const batch = writeBatch(getDb());
        batch.set(r, { ...meta, title: `${src.title || "Sem título"} (cópia)`, pinned: false, createdAt: now, updatedAt: now });
        batch.set(ref("contents", r.id), { html });
        await batch.commit();
        return r.id;
      },
      removeNote: async (id) => {
        const batch = writeBatch(getDb());
        batch.delete(ref("notes", id));
        batch.delete(ref("contents", id));
        await batch.commit();
      },
    }),
    [raw, col, ref],
  );

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar as notas">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (COLS.some((c) => !ready[c])) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
        <Spinner label="Carregando notas" />
      </div>
    );
  }

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesData {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes precisa ser usado dentro de <NotesDataProvider>.");
  return ctx;
}

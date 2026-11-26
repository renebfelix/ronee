"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Copy,
  FileCode2,
  FileText,
  FileType2,
  Folder,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  NotebookPen,
  Pin,
  PinOff,
  Printer,
  Trash2,
} from "lucide-react";
import { IconButton, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { useNotes } from "../data/NotesDataProvider";
import { RichEditor, type RichEditorChange } from "../editor/RichEditor";
import { Popover } from "../editor/Popover";
import { childFolders, countWords, excerptOf, folderPath, safeFileName } from "../lib/notes";
import type { Note, NoteFolder } from "../lib/types";
import styles from "./Notes.module.scss";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const SAVE_DELAY = 800;

function FolderOptions({ folders, parentId, depth }: { folders: NoteFolder[]; parentId: string | null; depth: number }) {
  return (
    <>
      {childFolders(folders, parentId).map((f) => (
        <FolderOption key={f.id} folders={folders} folder={f} depth={depth} />
      ))}
    </>
  );
}

function FolderOption({ folders, folder, depth }: { folders: NoteFolder[]; folder: NoteFolder; depth: number }) {
  return (
    <>
      <option value={folder.id}>{`${"   ".repeat(depth)}${folder.name}`}</option>
      <FolderOptions folders={folders} parentId={folder.id} depth={depth + 1} />
    </>
  );
}

function printHtml(title: string, html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const doc = w.document;
  doc.title = title || "Nota";
  const style = doc.createElement("style");
  style.textContent = `
    body{font-family:Inter,Arial,sans-serif;line-height:1.65;color:#111;max-width:760px;margin:40px auto;padding:0 24px}
    h1.doc-title{font-size:2.2em;margin:0 0 .6em}
    img{max-width:100%;height:auto}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;vertical-align:top}th{background:#f3f4f6;text-align:left}
    blockquote{border-left:4px solid #999;margin:0;padding-left:1em;color:#444;font-style:italic}
    pre{background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap}code{font-family:Consolas,monospace}
    ul[data-type=taskList]{list-style:none;padding-left:0}ul[data-type=taskList] li{display:flex;gap:.5em}ul[data-type=taskList] li>div>*{margin:0}
    @media print{body{margin:0 auto}}
  `;
  doc.head.appendChild(style);
  const h = doc.createElement("h1");
  h.className = "doc-title";
  h.textContent = title || "Sem título";
  doc.body.appendChild(h);
  const content = doc.createElement("div");
  content.innerHTML = html;
  doc.body.appendChild(content);
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}

function download(name: string, type: string, data: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

export function NoteEditor({
  note,
  onBack,
  onDelete,
  onOpen,
  onError,
}: {
  note: Note;
  onBack: () => void;
  onDelete: (note: Note) => void;
  onOpen: (id: string) => void;
  onError: (message: string) => void;
}) {
  const s = useNotes();
  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState(note.title);
  const [save, setSave] = useState<SaveState>("idle");
  const [fullscreen, setFullscreen] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const latest = useRef({ title: note.title, html: "", text: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const saveContent = s.saveContent;

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    const { title: t, html: h, text } = latest.current;
    setSave("saving");
    try {
      await saveContent(note.id, { title: t.trim(), html: h, excerpt: excerptOf(text), words: countWords(text) });
      setSave((st) => (st === "saving" ? "saved" : st));
    } catch {
      dirty.current = true;
      setSave("error");
    }
  }, [note.id, saveContent]);

  const schedule = useCallback(() => {
    dirty.current = true;
    setSave("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  }, [flush]);

  // Carrega o conteúdo completo.
  useEffect(() => {
    let alive = true;
    s.loadContent(note.id)
      .then((h) => {
        if (!alive) return;
        latest.current.html = h;
        setHtml(h);
      })
      .catch(() => alive && onError("Não foi possível abrir a nota."));
    return () => {
      alive = false;
    };
    // Só ao trocar de nota (o componente recebe key={note.id}).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Salva o que estiver pendente ao sair da nota ou fechar a aba.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Ctrl+S salva na hora.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flush]);

  // Ajusta a altura do título.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, html]);

  const onChange = useCallback(
    ({ html: h, text }: RichEditorChange) => {
      latest.current.html = h;
      latest.current.text = text;
      schedule();
    },
    [schedule],
  );

  const onReady = useCallback((e: Editor) => {
    editorRef.current = e;
    latest.current.text = e.getText({ blockSeparator: "\n" });
  }, []);

  const path = folderPath(s.folders, note.folderId);
  const isDoc = note.kind === "document";

  const exportHtml = () => {
    const h = editorRef.current?.getHTML() ?? latest.current.html;
    const t = latest.current.title || "Sem título";
    download(
      `${safeFileName(t)}.html`,
      "text/html;charset=utf-8",
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(t)}</title></head><body><h1>${escapeHtml(t)}</h1>${h}</body></html>`,
    );
  };
  const exportTxt = () => {
    const text = editorRef.current?.getText({ blockSeparator: "\n\n" }) ?? latest.current.text;
    const t = latest.current.title || "Sem título";
    download(`${safeFileName(t)}.txt`, "text/plain;charset=utf-8", `${t}\n\n${text}`);
  };

  return (
    <section className={cn(styles.editorPane, fullscreen && styles.fullscreen)} aria-label="Editor">
      <header className={styles.editorHead}>
        <IconButton icon={ArrowLeft} label="Voltar para a lista" size="sm" className={styles.backBtn} onClick={onBack} />
        <div className={styles.crumbs}>
          {isDoc ? <FileText size={16} aria-hidden /> : <NotebookPen size={16} aria-hidden />}
          <span className={styles.crumbText}>
            {path.length ? path.map((f) => f.name).join(" / ") : "Sem pasta"}
          </span>
        </div>

        <SaveIndicator state={save} />

        <div className={styles.headActions}>
          <IconButton
            icon={note.pinned ? PinOff : Pin}
            label={note.pinned ? "Desafixar" : "Fixar no topo"}
            size="sm"
            onClick={() => void s.updateNote(note.id, { pinned: !note.pinned })}
          />
          <IconButton
            icon={fullscreen ? Minimize2 : Maximize2}
            label={fullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
            size="sm"
            onClick={() => setFullscreen((v) => !v)}
          />
          <Popover icon={MoreHorizontal} label="Mais opções" caret={false} align="end">
            {(close) => (
              <div className={styles.moreMenu}>
                <label className={styles.moveField}>
                  <span>
                    <Folder size={14} aria-hidden /> Pasta
                  </span>
                  <select
                    value={note.folderId ?? ""}
                    onChange={(e) => {
                      void s.updateNote(note.id, { folderId: e.target.value || null });
                      close();
                    }}
                  >
                    <option value="">Sem pasta</option>
                    <FolderOptions folders={s.folders} parentId={null} depth={0} />
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.moreItem}
                  onClick={() => {
                    void s.updateNote(note.id, { kind: isDoc ? "note" : "document" });
                    close();
                  }}
                >
                  {isDoc ? <NotebookPen size={16} aria-hidden /> : <FileText size={16} aria-hidden />}
                  {isDoc ? "Converter em nota" : "Converter em documento"}
                </button>
                <button
                  type="button"
                  className={styles.moreItem}
                  onClick={async () => {
                    close();
                    await flush();
                    try {
                      onOpen(await s.duplicateNote(note.id));
                    } catch {
                      onError("Não foi possível duplicar.");
                    }
                  }}
                >
                  <Copy size={16} aria-hidden /> Duplicar
                </button>
                <hr className={styles.moreSep} />
                <button
                  type="button"
                  className={styles.moreItem}
                  onClick={() => {
                    close();
                    printHtml(latest.current.title, editorRef.current?.getHTML() ?? latest.current.html);
                  }}
                >
                  <Printer size={16} aria-hidden /> Imprimir / salvar PDF
                </button>
                <button
                  type="button"
                  className={styles.moreItem}
                  onClick={() => {
                    close();
                    exportHtml();
                  }}
                >
                  <FileCode2 size={16} aria-hidden /> Exportar HTML
                </button>
                <button
                  type="button"
                  className={styles.moreItem}
                  onClick={() => {
                    close();
                    exportTxt();
                  }}
                >
                  <FileType2 size={16} aria-hidden /> Exportar texto (.txt)
                </button>
                <hr className={styles.moreSep} />
                <button
                  type="button"
                  className={cn(styles.moreItem, styles.moreDanger)}
                  onClick={() => {
                    close();
                    onDelete(note);
                  }}
                >
                  <Trash2 size={16} aria-hidden /> Excluir
                </button>
              </div>
            )}
          </Popover>
        </div>
      </header>

      {html === null ? (
        <div className={styles.editorLoading}>
          <Spinner label="Abrindo nota" />
        </div>
      ) : (
        <RichEditor
          initialHtml={html}
          layout={isDoc ? "page" : "plain"}
          placeholder={isDoc ? "Comece a escrever seu documento…" : "Escreva sua nota…"}
          onChange={onChange}
          onReady={onReady}
          onError={onError}
          header={
            <textarea
              ref={titleRef}
              className={cn(styles.titleInput, isDoc && styles.titleDoc)}
              value={title}
              rows={1}
              placeholder="Sem título"
              aria-label="Título"
              onChange={(e) => {
                const t = e.target.value.replace(/\n/g, " ");
                setTitle(t);
                latest.current.title = t;
                schedule();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
                  e.preventDefault();
                  editorRef.current?.commands.focus("start");
                }
              }}
              autoFocus={!note.title && !note.excerpt}
            />
          }
        />
      )}
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    pending: { icon: Loader2, text: "Editando…", cls: styles.savePending },
    saving: { icon: Loader2, text: "Salvando…", cls: styles.savePending },
    saved: { icon: Check, text: "Salvo", cls: styles.saveOk },
    error: { icon: CloudOff, text: "Erro ao salvar", cls: styles.saveErr },
  } as const;
  const { icon: Icon, text, cls } = map[state];
  return (
    <span className={cn(styles.save, cls)} role="status">
      <Icon size={14} aria-hidden className={state === "saving" ? styles.spin : undefined} />
      <span className={styles.saveText}>{text}</span>
    </span>
  );
}

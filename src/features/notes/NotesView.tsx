"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  FolderInput,
  FolderPlus,
  Inbox,
  Library,
  NotebookPen,
  Pin,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button, EmptyState, IconButton } from "@/components/ui";
import { ConfirmModal } from "@/features/finance/components/kit";
import { cn } from "@/lib/utils/cn";
import { useNotes } from "./data/NotesDataProvider";
import { FolderModal } from "./components/FolderModal";
import { DRAG_NOTE, FolderTree, ScopeRow } from "./components/FolderTree";
import { NoteEditor } from "./components/NoteEditor";
import { childFolders, folderPath, formatUpdated, normalize, sortNotes } from "./lib/notes";
import type { Note, NoteFolder, NoteKind, NotesScope } from "./lib/types";
import styles from "./components/Notes.module.scss";

type Pane = "folders" | "list" | "editor";
const LAST_KEY = "ronee:notes:last";

export function NotesView() {
  const s = useNotes();
  const [scope, setScope] = useState<NotesScope>({ type: "all" });
  // Reabre a última nota (só no computador, onde as três colunas aparecem juntas).
  // Só renderiza no cliente: o provedor mostra o carregamento até os dados chegarem.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const last = localStorage.getItem(LAST_KEY);
    return last && window.matchMedia("(min-width: 1024px)").matches && s.notes.some((n) => n.id === last) ? last : null;
  });
  const [pane, setPane] = useState<Pane>("list");
  const [query, setQuery] = useState("");
  const [folderModal, setFolderModal] = useState<{ editing: NoteFolder | null; parentId: string | null } | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<NoteFolder | null>(null);
  const [deleteNote, setDeleteNote] = useState<Note | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState<NoteKind | null>(null);

  useEffect(() => {
    if (selectedId) localStorage.setItem(LAST_KEY, selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = s.notes.find((n) => n.id === selectedId) ?? null;

  // A pasta escolhida foi excluída (aqui ou em outro aparelho).
  const activeFolder = scope.type === "folder" ? s.folders.find((f) => f.id === scope.id) : undefined;
  const effectiveScope = useMemo<NotesScope>(() => (scope.type === "folder" && !activeFolder ? { type: "all" } : scope), [scope, activeFolder]);

  const counts = useMemo(() => {
    const m = new Map<string | null, number>();
    s.notes.forEach((n) => m.set(n.folderId, (m.get(n.folderId) ?? 0) + 1));
    return m;
  }, [s.notes]);

  const q = normalize(query.trim());
  const visible = useMemo(() => {
    let list = s.notes;
    if (q) {
      list = list.filter((n) => normalize(`${n.title} ${n.excerpt}`).includes(q));
    } else if (effectiveScope.type === "pinned") list = list.filter((n) => n.pinned);
    else if (effectiveScope.type === "unfiled") list = list.filter((n) => !n.folderId);
    else if (effectiveScope.type === "folder") list = list.filter((n) => n.folderId === effectiveScope.id);
    return sortNotes(list);
  }, [s.notes, q, effectiveScope]);

  const subfolders = effectiveScope.type === "folder" && !q ? childFolders(s.folders, effectiveScope.id) : [];

  const scopeTitle = q
    ? "Resultados da busca"
    : effectiveScope.type === "all"
      ? "Todas as notas"
      : effectiveScope.type === "pinned"
        ? "Fixadas"
        : effectiveScope.type === "unfiled"
          ? "Sem pasta"
          : activeFolder!.name;

  const selectScope = (sc: NotesScope) => {
    setScope(sc);
    setQuery("");
    setPane("list");
  };

  const open = (id: string) => {
    setSelectedId(id);
    setPane("editor");
  };

  const create = async (kind: NoteKind) => {
    setCreating(kind);
    try {
      const folderId = effectiveScope.type === "folder" ? effectiveScope.id : null;
      const id = await s.createNote({ kind, folderId });
      if (effectiveScope.type === "pinned") await s.updateNote(id, { pinned: true });
      setQuery("");
      open(id);
    } catch {
      setToast("Não foi possível criar a nota.");
    } finally {
      setCreating(null);
    }
  };

  const moveNote = (noteId: string, folderId: string | null) => {
    const n = s.notes.find((x) => x.id === noteId);
    if (!n || n.folderId === folderId) return;
    s.updateNote(noteId, { folderId }).catch(() => setToast("Não foi possível mover a nota."));
  };

  const parentPath = activeFolder ? folderPath(s.folders, activeFolder.parentId) : [];

  return (
    <div className={styles.layout} data-pane={pane}>
      {/* ───────── Pastas ───────── */}
      <aside className={styles.foldersPane} aria-label="Pastas">
        <div className={styles.paneHead}>
          <h1 className={styles.paneTitle}>Notas</h1>
          <IconButton icon={FolderPlus} label="Nova pasta" size="sm" onClick={() => setFolderModal({ editing: null, parentId: null })} />
        </div>
        <nav className={styles.foldersScroll}>
          <ScopeRow icon={Library} label="Todas as notas" count={s.notes.length} active={effectiveScope.type === "all"} onClick={() => selectScope({ type: "all" })} />
          <ScopeRow
            icon={Pin}
            label="Fixadas"
            count={s.notes.filter((n) => n.pinned).length}
            active={effectiveScope.type === "pinned"}
            onClick={() => selectScope({ type: "pinned" })}
            drop={(id) => void s.updateNote(id, { pinned: true })}
          />
          <ScopeRow
            icon={Inbox}
            label="Sem pasta"
            count={counts.get(null) ?? 0}
            active={effectiveScope.type === "unfiled"}
            onClick={() => selectScope({ type: "unfiled" })}
            drop={(id) => moveNote(id, null)}
          />

          <div className={styles.treeHead}>
            <span>Pastas</span>
            <button type="button" className={styles.treeAdd} onClick={() => setFolderModal({ editing: null, parentId: null })}>
              <Plus size={14} aria-hidden /> Nova
            </button>
          </div>
          {s.folders.length === 0 ? (
            <p className={styles.treeEmpty}>Crie pastas e subpastas para organizar suas notas. Arraste notas para dentro delas.</p>
          ) : (
            <FolderTree
              folders={s.folders}
              counts={counts}
              scope={effectiveScope}
              onSelect={selectScope}
              onNewSubfolder={(parentId) => setFolderModal({ editing: null, parentId })}
              onEdit={(f) => setFolderModal({ editing: f, parentId: f.parentId })}
              onDelete={setDeleteFolder}
              onDropNote={moveNote}
              onDropFolder={(fid, parentId) => void s.updateFolder(fid, { parentId })}
            />
          )}
        </nav>
      </aside>

      {/* ───────── Lista ───────── */}
      <section className={styles.listPane} aria-label={scopeTitle}>
        <div className={styles.paneHead}>
          <IconButton icon={ArrowLeft} label="Pastas" size="sm" className={styles.backBtn} onClick={() => setPane("folders")} />
          <div className={styles.listTitleWrap}>
            {parentPath.length > 0 && !q && <span className={styles.listCrumb}>{parentPath.map((f) => f.name).join(" / ")}</span>}
            <h2 className={styles.listTitle}>{scopeTitle}</h2>
          </div>
          <div className={styles.newBtns}>
            <IconButton icon={NotebookPen} label="Nova nota" size="sm" variant="primary" disabled={!!creating} onClick={() => void create("note")} />
            <IconButton icon={FileText} label="Novo documento" size="sm" variant="outline" disabled={!!creating} onClick={() => void create("document")} />
          </div>
        </div>

        <div className={styles.searchBox}>
          <Search size={16} aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar em todas as notas" aria-label="Buscar notas" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        <div className={styles.listScroll}>
          {subfolders.length > 0 && (
            <ul className={styles.subfolders}>
              {subfolders.map((f) => (
                <li key={f.id}>
                  <button type="button" className={styles.subfolder} onClick={() => selectScope({ type: "folder", id: f.id })}>
                    <FolderInput size={16} style={{ color: f.color }} aria-hidden />
                    <span>{f.name}</span>
                    <span className={styles.count}>{counts.get(f.id) ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {visible.length === 0 ? (
            <EmptyState
              className={styles.listEmpty}
              icon={q ? Search : NotebookPen}
              title={q ? "Nada encontrado" : "Nenhuma nota aqui"}
              description={q ? `Nenhuma nota com “${query.trim()}”.` : "Crie uma nota rápida ou um documento completo."}
              action={
                !q && (
                  <div className={styles.emptyActions}>
                    <Button size="sm" icon={NotebookPen} onClick={() => void create("note")} loading={creating === "note"}>
                      Nova nota
                    </Button>
                    <Button size="sm" variant="outline" icon={FileText} onClick={() => void create("document")} loading={creating === "document"}>
                      Novo documento
                    </Button>
                  </div>
                )
              }
            />
          ) : (
            <ul className={styles.noteList}>
              {visible.map((n) => {
                const folder = n.folderId ? s.folders.find((f) => f.id === n.folderId) : undefined;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(styles.noteItem, n.id === selectedId && styles.noteItemOn)}
                      onClick={() => open(n.id)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_NOTE, n.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <span className={styles.noteTop}>
                        {n.kind === "document" ? (
                          <FileText size={15} aria-label="Documento" className={styles.kindIcon} />
                        ) : (
                          <NotebookPen size={15} aria-label="Nota" className={styles.kindIcon} />
                        )}
                        <span className={styles.noteTitle}>{n.title || "Sem título"}</span>
                        {n.pinned && <Pin size={13} aria-label="Fixada" className={styles.pinIcon} />}
                      </span>
                      <span className={styles.noteExcerpt}>{n.excerpt || "Sem conteúdo"}</span>
                      <span className={styles.noteMeta}>
                        <span>{formatUpdated(n.updatedAt)}</span>
                        {(effectiveScope.type !== "folder" || q) && folder && (
                          <span className={styles.noteFolder}>
                            <span className={styles.folderDot} style={{ background: folder.color }} />
                            {folder.name}
                          </span>
                        )}
                        {n.words > 0 && <span>{n.words.toLocaleString("pt-BR")} palavras</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ───────── Editor ───────── */}
      {selected ? (
        <NoteEditor
          key={selected.id}
          note={selected}
          onBack={() => setPane("list")}
          onDelete={setDeleteNote}
          onOpen={open}
          onError={setToast}
        />
      ) : (
        <section className={cn(styles.editorPane, styles.editorEmpty)}>
          <EmptyState
            icon={NotebookPen}
            title="Selecione uma nota"
            description="Escolha uma nota na lista ou crie uma nova. Tudo é salvo automaticamente."
            action={
              <div className={styles.emptyActions}>
                <Button icon={NotebookPen} onClick={() => void create("note")} loading={creating === "note"}>
                  Nova nota
                </Button>
                <Button variant="outline" icon={FileText} onClick={() => void create("document")} loading={creating === "document"}>
                  Novo documento
                </Button>
              </div>
            }
          />
        </section>
      )}

      {toast && (
        <div className={styles.toast} role="alert">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Fechar">
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {folderModal && (
        <FolderModal
          editing={folderModal.editing}
          parentId={folderModal.parentId}
          onClose={() => setFolderModal(null)}
          onCreated={(id) => selectScope({ type: "folder", id })}
        />
      )}

      <ConfirmModal
        open={!!deleteFolder}
        onClose={() => setDeleteFolder(null)}
        title="Excluir pasta"
        text={
          deleteFolder
            ? `Excluir a pasta “${deleteFolder.name}”? As notas e subpastas dela não serão apagadas: vão para ${
                deleteFolder.parentId ? `“${s.folders.find((f) => f.id === deleteFolder.parentId)?.name ?? "a pasta-mãe"}”` : "a raiz (Sem pasta)"
              }.`
            : ""
        }
        onConfirm={async () => {
          const f = deleteFolder!;
          setDeleteFolder(null);
          try {
            await s.removeFolder(f.id);
            if (scope.type === "folder" && scope.id === f.id) setScope(f.parentId ? { type: "folder", id: f.parentId } : { type: "all" });
          } catch {
            setToast("Não foi possível excluir a pasta.");
          }
        }}
      />

      <ConfirmModal
        open={!!deleteNote}
        onClose={() => setDeleteNote(null)}
        title={deleteNote?.kind === "document" ? "Excluir documento" : "Excluir nota"}
        text={deleteNote ? `Excluir “${deleteNote.title || "Sem título"}” para sempre? Essa ação não pode ser desfeita.` : ""}
        onConfirm={async () => {
          const n = deleteNote!;
          setDeleteNote(null);
          if (selectedId === n.id) {
            setSelectedId(null);
            setPane("list");
            localStorage.removeItem(LAST_KEY);
          }
          try {
            await s.removeNote(n.id);
          } catch {
            setToast("Não foi possível excluir.");
          }
        }}
      />
    </div>
  );
}

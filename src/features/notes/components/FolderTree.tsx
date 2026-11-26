"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, FolderPlus, MoreVertical, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Popover } from "../editor/Popover";
import { childFolders, descendantIds } from "../lib/notes";
import type { NoteFolder, NotesScope } from "../lib/types";
import styles from "./Notes.module.scss";

/** Tipos de arrasto aceitos pela árvore. */
export const DRAG_NOTE = "application/x-ronee-note";
export const DRAG_FOLDER = "application/x-ronee-folder";

export interface FolderTreeProps {
  folders: NoteFolder[];
  counts: Map<string | null, number>;
  scope: NotesScope;
  onSelect: (scope: NotesScope) => void;
  onNewSubfolder: (parentId: string) => void;
  onEdit: (folder: NoteFolder) => void;
  onDelete: (folder: NoteFolder) => void;
  /** Soltar nota (ou pasta) numa pasta; `null` = raiz / sem pasta. */
  onDropNote: (noteId: string, folderId: string | null) => void;
  onDropFolder: (folderId: string, parentId: string | null) => void;
}

export function useDropTarget(accept: (e: DragEvent) => boolean, onDrop: (e: DragEvent) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!accept(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        if (!accept(e)) return;
        e.preventDefault();
        onDrop(e);
      },
    },
  };
}

const hasType = (e: DragEvent, t: string) => Array.from(e.dataTransfer.types).includes(t);

export function ScopeRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  drop,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  drop?: (noteId: string) => void;
}) {
  const target = useDropTarget(
    (e) => !!drop && hasType(e, DRAG_NOTE),
    (e) => drop?.(e.dataTransfer.getData(DRAG_NOTE)),
  );
  return (
    <button
      type="button"
      className={cn(styles.scopeRow, active && styles.scopeRowOn, target.over && styles.dropOver)}
      onClick={onClick}
      aria-current={active || undefined}
      {...target.props}
    >
      <Icon size={17} aria-hidden className={styles.scopeIcon} />
      <span className={styles.scopeLabel}>{label}</span>
      {count != null && count > 0 && <span className={styles.count}>{count}</span>}
    </button>
  );
}

export function FolderTree(props: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const roots = childFolders(props.folders, null);
  if (!roots.length) return null;
  return (
    <ul className={styles.tree} role="tree">
      {roots.map((f) => (
        <FolderNode key={f.id} folder={f} depth={0} expanded={expanded} toggle={toggle} setExpanded={setExpanded} {...props} />
      ))}
    </ul>
  );
}

function FolderNode({
  folder,
  depth,
  expanded,
  toggle,
  setExpanded,
  ...p
}: FolderTreeProps & {
  folder: NoteFolder;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  setExpanded: (fn: (prev: Set<string>) => Set<string>) => void;
}) {
  const kids = childFolders(p.folders, folder.id);
  const open = expanded.has(folder.id);
  const active = p.scope.type === "folder" && p.scope.id === folder.id;
  const count = p.counts.get(folder.id) ?? 0;

  const target = useDropTarget(
    (e) => {
      if (hasType(e, DRAG_NOTE)) return true;
      return hasType(e, DRAG_FOLDER);
    },
    (e) => {
      const noteId = e.dataTransfer.getData(DRAG_NOTE);
      if (noteId) return p.onDropNote(noteId, folder.id);
      const fid = e.dataTransfer.getData(DRAG_FOLDER);
      // Não deixa mover a pasta para dentro dela mesma ou de uma descendente.
      if (fid && !descendantIds(p.folders, fid).has(folder.id)) {
        p.onDropFolder(fid, folder.id);
        setExpanded((prev) => new Set(prev).add(folder.id));
      }
    },
  );

  const rowMenu: ReactNode = (
    <Popover icon={MoreVertical} label={`Opções da pasta ${folder.name}`} caret={false} align="end">
      {(close) => (
        <div className={styles.moreMenu}>
          <button
            type="button"
            className={styles.moreItem}
            onClick={() => {
              close();
              p.onNewSubfolder(folder.id);
              setExpanded((prev) => new Set(prev).add(folder.id));
            }}
          >
            <FolderPlus size={16} aria-hidden /> Nova subpasta
          </button>
          <button
            type="button"
            className={styles.moreItem}
            onClick={() => {
              close();
              p.onEdit(folder);
            }}
          >
            <Pencil size={16} aria-hidden /> Renomear / cor
          </button>
          <button
            type="button"
            className={cn(styles.moreItem, styles.moreDanger)}
            onClick={() => {
              close();
              p.onDelete(folder);
            }}
          >
            <Trash2 size={16} aria-hidden /> Excluir pasta
          </button>
        </div>
      )}
    </Popover>
  );

  const FolderIcon = open && kids.length ? FolderOpen : Folder;

  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={active}>
      <div
        className={cn(styles.folderRow, active && styles.scopeRowOn, target.over && styles.dropOver)}
        style={{ paddingLeft: `calc(${depth} * 16px + 4px)` }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_FOLDER, folder.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        {...target.props}
      >
        <button
          type="button"
          className={cn(styles.chev, open && styles.chevOpen, !kids.length && styles.chevHidden)}
          aria-label={open ? "Recolher" : "Expandir"}
          tabIndex={kids.length ? 0 : -1}
          onClick={() => toggle(folder.id)}
        >
          <ChevronRight size={14} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.folderMain}
          onClick={() => p.onSelect({ type: "folder", id: folder.id })}
          onDoubleClick={() => kids.length && toggle(folder.id)}
        >
          <FolderIcon size={17} aria-hidden style={{ color: folder.color }} className={styles.folderIcon} />
          <span className={styles.scopeLabel}>{folder.name}</span>
          {count > 0 && <span className={styles.count}>{count}</span>}
        </button>
        <span className={styles.rowMenu}>{rowMenu}</span>
      </div>
      {open && kids.length > 0 && (
        <ul role="group" className={styles.tree}>
          {kids.map((k) => (
            <FolderNode key={k.id} folder={k} depth={depth + 1} expanded={expanded} toggle={toggle} setExpanded={setExpanded} {...p} />
          ))}
        </ul>
      )}
    </li>
  );
}

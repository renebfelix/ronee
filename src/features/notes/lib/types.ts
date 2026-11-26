/** "note" = nota rápida; "document" = documento com layout de página. */
export type NoteKind = "note" | "document";

export interface NoteFolder {
  id: string;
  name: string;
  /** `null` = pasta na raiz. */
  parentId: string | null;
  color: string;
  createdAt: number;
}

/** Metadados da nota (o conteúdo HTML fica em `contents/{id}` e só é carregado ao abrir). */
export interface Note {
  id: string;
  title: string;
  folderId: string | null;
  kind: NoteKind;
  pinned: boolean;
  /** Começo do texto, para a lista e a busca. */
  excerpt: string;
  words: number;
  createdAt: number;
  updatedAt: number;
}

/** Filtros fixos da barra de pastas (além das pastas do usuário). */
export type NotesScope = { type: "all" } | { type: "pinned" } | { type: "unfiled" } | { type: "folder"; id: string };

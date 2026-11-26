"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { ErrorText, Field, ui } from "@/features/finance/components/kit";
import { cn } from "@/lib/utils/cn";
import { useNotes } from "../data/NotesDataProvider";
import { FOLDER_COLORS, folderPath } from "../lib/notes";
import type { NoteFolder } from "../lib/types";
import styles from "./Notes.module.scss";

export function FolderModal({
  editing,
  parentId,
  onClose,
  onCreated,
}: {
  editing: NoteFolder | null;
  parentId: string | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const s = useNotes();
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? FOLDER_COLORS[s.folders.length % FOLDER_COLORS.length]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parent = editing ? editing.parentId : parentId;
  const where = folderPath(s.folders, parent)
    .map((f) => f.name)
    .join(" / ");

  const submit = async () => {
    const n = name.trim();
    if (!n) return setError("Informe o nome da pasta.");
    const clash = s.folders.some(
      (f) => f.id !== editing?.id && (f.parentId ?? null) === (parent ?? null) && f.name.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"),
    );
    if (clash) return setError("Já existe uma pasta com esse nome aqui.");
    setBusy(true);
    try {
      if (editing) await s.updateFolder(editing.id, { name: n, color });
      else onCreated?.(await s.addFolder(n, parent, color));
      onClose();
    } catch {
      setError("Não foi possível salvar a pasta.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Editar pasta" : parent ? "Nova subpasta" : "Nova pasta"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {editing ? "Salvar" : "Criar pasta"}
          </Button>
        </>
      }
    >
      <form
        className={ui.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {where && <p className={styles.modalHint}>Dentro de: {where}</p>}
        <Field label="Nome">
          <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Trabalho" autoFocus />
        </Field>
        <div className={ui.field}>
          <span className={ui.label}>Cor</span>
          <div className={styles.colorChoices}>
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(styles.colorChoice, c === color && styles.colorChoiceOn)}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              >
                {c === color && <Check size={14} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

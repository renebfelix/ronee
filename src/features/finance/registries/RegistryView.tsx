"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus, Star, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/layout";
import { Alert, Badge, Button, Card, EmptyState, IconButton, Modal } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { ConfirmModal, ErrorText, ui } from "../components/kit";
import styles from "./RegistryView.module.scss";

export interface RegistryRow {
  id: string;
  name: string;
  /** Ícone/avatar à esquerda. */
  visual: ReactNode;
  /** Linha de detalhes abaixo do nome. */
  meta?: ReactNode;
  /** Valor em destaque à direita (ex.: saldo). */
  aside?: ReactNode;
  inactive?: boolean;
  /** Selo ao lado do nome (ex.: "Padrão"). */
  badge?: ReactNode;
  /** Botões extras antes de editar/excluir. */
  extraActions?: ReactNode;
}

/** Estrela para marcar o item como padrão nos novos lançamentos (clicar de novo desmarca). */
export function DefaultToggle({ on, name, onToggle }: { on: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cn(styles.star, on && styles.starOn)}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? `${name} é o padrão — remover padrão` : `Definir ${name} como padrão`}
      title={on ? "Padrão nos novos lançamentos (clique para remover)" : "Definir como padrão nos novos lançamentos"}
    >
      <Star size={16} fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

interface RegistryViewProps<T extends { id: string; name: string }> {
  /** Id do subitem em `src/config/navigation.ts` (título e ícone da página). */
  navId: string;
  description: string;
  newLabel: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyText: string;
  items: T[];
  toRow: (item: T) => RegistryRow;
  /** Conteúdo acima da lista (ex.: seletor de tipo). */
  toolbar?: ReactNode;
  /** Controles extras no cabeçalho, antes do botão de criar. */
  headerActions?: ReactNode;
  /** Quando definido, aparece no lugar da lista (ex.: outra aba da página). */
  content?: ReactNode;
  /** Mensagem quando o item não pode ser excluído (está em uso); `null` libera a exclusão. */
  blockDelete: (item: T) => string | null;
  onDelete: (item: T) => Promise<void>;
  deleteTitle: string;
  /** Modal de criação/edição. `editing` é null ao criar. */
  renderForm: (editing: T | null, close: () => void) => ReactNode;
}

/** Lista de um cadastro do módulo de Finanças, com criação, edição e exclusão. */
export function RegistryView<T extends { id: string; name: string }>({
  navId,
  description,
  newLabel,
  emptyIcon,
  emptyTitle,
  emptyText,
  items,
  toRow,
  toolbar,
  headerActions,
  content,
  blockDelete,
  onDelete,
  deleteTitle,
  renderForm,
}: RegistryViewProps<T>) {
  const { label, icon } = getNavSubItem(navId);
  const [form, setForm] = useState<{ open: boolean; editing: T | null }>({ open: false, editing: null });
  const [del, setDel] = useState<T | null>(null);
  const [blocked, setBlocked] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const close = () => setForm({ open: false, editing: null });

  const askDelete = (item: T) => {
    const reason = blockDelete(item);
    setBlocked(reason ?? "");
    if (!reason) setDel(item);
  };
  const confirmDelete = async () => {
    if (!del) return;
    try {
      await onDelete(del);
      setDel(null);
    } catch {
      setDeleteError(true);
    }
  };

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description={description}
        actions={
          <>
            {headerActions}
            <Button icon={Plus} onClick={() => setForm({ open: true, editing: null })}>
              {newLabel}
            </Button>
          </>
        }
      />

      {blocked && (
        <Alert tone="warning" className={styles.alert}>
          {blocked}
        </Alert>
      )}
      {content ?? (
        <>
          {toolbar && <div className={styles.toolbar}>{toolbar}</div>}

          {items.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyText}
              action={
                <Button icon={Plus} onClick={() => setForm({ open: true, editing: null })}>
                  {newLabel}
                </Button>
              }
            />
          ) : (
            <Card padding="none">
              <ul className={styles.list}>
                {items.map((item) => {
                  const row = toRow(item);
                  return (
                    <li key={row.id} className={styles.row}>
                      {row.visual}
                      <div className={styles.main}>
                        <span className={styles.name}>
                          {row.name}
                          {row.badge}
                          {row.inactive && <Badge>Desativado</Badge>}
                        </span>
                        {row.meta && <span className={styles.meta}>{row.meta}</span>}
                      </div>
                      {row.aside && <div className={styles.aside}>{row.aside}</div>}
                      <div className={styles.actions}>
                        {row.extraActions}
                        <IconButton icon={Pencil} size="sm" label={`Editar ${row.name}`} onClick={() => setForm({ open: true, editing: item })} />
                        <IconButton icon={Trash2} size="sm" label={`Excluir ${row.name}`} onClick={() => askDelete(item)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      {form.open && renderForm(form.editing, close)}
      <ConfirmModal
        open={!!del}
        onClose={() => {
          setDel(null);
          setDeleteError(false);
        }}
        onConfirm={confirmDelete}
        title={deleteTitle}
        text={
          deleteError
            ? "Não foi possível excluir. Verifique sua conexão e tente de novo."
            : `Excluir “${del?.name}”? Essa ação não pode ser desfeita.`
        }
      />
    </>
  );
}

/** Estrutura padrão da modal de cadastro: valida, salva e mostra o erro. */
export function RegistryForm({
  title,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Devolve uma mensagem de erro de validação, ou nada quando salvou. */
  onSubmit: () => Promise<string | void>;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const problem = await onSubmit();
      if (problem) setError(problem);
      else onClose();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className={ui.stack}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {children}
        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

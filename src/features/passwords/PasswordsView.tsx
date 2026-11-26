"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Button, Card, EmptyState, IconButton, Input, Modal } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { ConfirmModal, ErrorText, ui } from "@/features/finance/components/kit";
import { useVault } from "./data/VaultProvider";
import { decryptSecret } from "./lib/crypto";
import type { PasswordEntry } from "./lib/types";
import { PasswordForm } from "./components/PasswordForm";
import { TagChip } from "./components/TagChip";
import { VaultTimer } from "./components/VaultTimer";
import styles from "./components/PasswordsView.module.scss";

const REVEAL_MS = 20_000;

/** Senha mascarada: só é decifrada quando o usuário pede para ver ou copiar, e some sozinha. */
function Secret({ entry }: { entry: PasswordEntry }) {
  const [plain, setPlain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (plain === null) return;
    const t = window.setTimeout(() => setPlain(null), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [plain]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const decrypt = async () => {
    try {
      setFailed(false);
      return await decryptSecret(entry.passwordCipher);
    } catch {
      setFailed(true);
      return null;
    }
  };

  const toggle = async () => setPlain(plain === null ? await decrypt() : null);
  const copy = async () => {
    const p = await decrypt();
    if (p === null) return;
    await navigator.clipboard.writeText(p);
    setCopied(true);
  };

  return (
    <div className={styles.secret}>
      <code className={cn(styles.secretValue, failed && styles.secretFailed)}>
        {failed ? "não foi possível decifrar" : (plain ?? "••••••••••")}
      </code>
      <IconButton icon={plain === null ? Eye : EyeOff} size="sm" label={plain === null ? "Mostrar senha" : "Ocultar senha"} onClick={toggle} />
      <IconButton icon={copied ? Check : Copy} size="sm" label={copied ? "Copiada" : "Copiar senha"} onClick={copy} />
    </div>
  );
}

function ChangeVaultPasswordModal({ onClose }: { onClose: () => void }) {
  const { changeVaultPassword } = useVault();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (next.length < 6) return setError("A nova senha precisa ter pelo menos 6 caracteres.");
    if (next !== confirm) return setError("As novas senhas não conferem.");
    setBusy(true);
    try {
      if (await changeVaultPassword(current, next)) onClose();
      else setError("Senha de segurança atual incorreta.");
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Alterar senha do cofre"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
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
        <Input type="password" label="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
        <Input type="password" label="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <Input type="password" label="Confirme a nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function PasswordsView() {
  const v = useVault();
  const { label, icon } = getNavSubItem("passwords-list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string[]>([]);
  const [form, setForm] = useState<{ open: boolean; editing: PasswordEntry | null }>({ open: false, editing: null });
  const [del, setDel] = useState<PasswordEntry | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [changing, setChanging] = useState(false);

  const tags = useMemo(() => [...v.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [v.tags]);
  const tagById = useMemo(() => new Map(v.tags.map((t) => [t.id, t])), [v.tags]);
  const activeFilter = filter.filter((id) => tagById.has(id));

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return v.entries
      .filter((e) => activeFilter.length === 0 || activeFilter.some((id) => e.tagIds.includes(id)))
      .filter(
        (e) =>
          !q ||
          [e.name, e.url, e.username ?? "", e.description].some((s) => s.toLocaleLowerCase("pt-BR").includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [v.entries, activeFilter, query]);

  const toggleFilter = (id: string) => setFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const openNew = () => setForm({ open: true, editing: null });

  const confirmDelete = async () => {
    if (!del) return;
    try {
      await v.remove("entries", del.id);
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
        description="Suas senhas ficam criptografadas e só aparecem enquanto o cofre está aberto."
        actions={
          <>
            <VaultTimer />
            <IconButton icon={Settings2} variant="outline" label="Alterar senha do cofre" onClick={() => setChanging(true)} />
            <Button icon={Plus} onClick={openNew}>
              Nova senha
            </Button>
          </>
        }
      />

      {v.entries.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Input icon={Search} placeholder="Buscar por nome, URL, usuário ou descrição" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar senhas" />
          </div>
          {tags.length > 0 && (
            <div className={styles.chips} role="group" aria-label="Filtrar por tag">
              <button type="button" className={cn(styles.chip, activeFilter.length === 0 && styles.chipOn)} onClick={() => setFilter([])} aria-pressed={activeFilter.length === 0}>
                Todas
              </button>
              {tags.map((t) => (
                <TagChip key={t.id} tag={t} selected={activeFilter.includes(t.id)} onClick={() => toggleFilter(t.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {v.entries.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Nenhuma senha salva"
          description="Guarde aqui suas senhas com segurança. Elas são criptografadas antes de sair do seu navegador."
          action={
            <Button icon={Plus} onClick={openNew}>
              Nova senha
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Nenhuma senha corresponde à busca ou às tags selecionadas." />
      ) : (
        <Card padding="none">
          <ul className={styles.list}>
            {items.map((e) => (
              <li key={e.id} className={styles.row}>
                <div className={styles.main}>
                  <span className={styles.name}>{e.name}</span>
                  <span className={styles.meta}>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {hostOf(e.url)}
                        <ExternalLink size={12} aria-hidden />
                      </a>
                    )}
                    {e.username && <span>{e.username}</span>}
                  </span>
                  {e.description && <p className={styles.description}>{e.description}</p>}
                  {e.tagIds.length > 0 && (
                    <div className={styles.tags}>
                      {e.tagIds.map((id) => {
                        const t = tagById.get(id);
                        return t ? <TagChip key={id} tag={t} /> : null;
                      })}
                    </div>
                  )}
                </div>
                <Secret entry={e} />
                <div className={styles.actions}>
                  <IconButton icon={Pencil} size="sm" label={`Editar ${e.name}`} onClick={() => setForm({ open: true, editing: e })} />
                  <IconButton icon={Trash2} size="sm" label={`Excluir ${e.name}`} onClick={() => setDel(e)} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {form.open && <PasswordForm key={form.editing?.id ?? "new"} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />}
      {changing && <ChangeVaultPasswordModal onClose={() => setChanging(false)} />}
      <ConfirmModal
        open={!!del}
        onClose={() => {
          setDel(null);
          setDeleteError(false);
        }}
        onConfirm={confirmDelete}
        title="Excluir senha"
        text={
          deleteError
            ? "Não foi possível excluir. Verifique sua conexão e tente de novo."
            : `Excluir “${del?.name}”? Essa ação não pode ser desfeita.`
        }
      />
    </>
  );
}

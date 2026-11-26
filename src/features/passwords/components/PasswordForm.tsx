"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { Field, FieldGroup, Hint, ui } from "@/features/finance/components/kit";
import { RegistryForm } from "@/features/finance/registries/RegistryView";
import { useVault } from "../data/VaultProvider";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import type { PasswordEntry } from "../lib/types";
import { TagChip } from "./TagChip";
import styles from "./PasswordsView.module.scss";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+?";

function generatePassword(length = 20) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join("");
}

function normalizeUrl(v: string) {
  const t = v.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

export function PasswordForm({ editing, onClose }: { editing: PasswordEntry | null; onClose: () => void }) {
  const v = useVault();
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [tagIds, setTagIds] = useState<string[]>(editing?.tagIds ?? []);
  const [decrypting, setDecrypting] = useState(!!editing);
  const [decryptError, setDecryptError] = useState(false);

  /* Na edição, a senha é decifrada só aqui, na memória do formulário. */
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    decryptSecret(editing.passwordCipher)
      .then((p) => alive && setPassword(p))
      .catch(() => alive && setDecryptError(true))
      .finally(() => alive && setDecrypting(false));
    return () => {
      alive = false;
    };
  }, [editing]);

  const toggleTag = (id: string) => setTagIds((ids) => (ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id]));

  const submit = async () => {
    if (!name.trim()) return "Informe o nome.";
    if (decrypting) return "Aguarde a senha ser carregada.";
    if (!password) return "Informe a senha.";
    const now = Date.now();
    await v.save<PasswordEntry>("entries", {
      id: editing?.id ?? v.newId("entries"),
      name: name.trim(),
      url: normalizeUrl(url),
      username: username.trim() || undefined,
      passwordCipher: await encryptSecret(password),
      description: description.trim(),
      tagIds: tagIds.filter((id) => v.tags.some((t) => t.id === id)),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <RegistryForm title={editing ? "Editar senha" : "Nova senha"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Netflix" autoFocus />
      </Field>
      <Field label="URL">
        <input
          className={ui.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Ex.: netflix.com"
          inputMode="url"
          autoComplete="off"
        />
      </Field>
      <Field label="Usuário ou e-mail (opcional)">
        <input className={ui.input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
      </Field>
      <FieldGroup label="Senha" hint={decryptError ? "Não foi possível decifrar a senha salva. Digite uma nova." : undefined} warn>
        <div className={styles.secretInput}>
          <input
            className={ui.input}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={decrypting ? "Decifrando…" : ""}
            disabled={decrypting}
            autoComplete="new-password"
            aria-label="Senha"
          />
          <IconButton icon={show ? EyeOff : Eye} label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((s) => !s)} />
          <IconButton
            icon={Wand2}
            label="Gerar senha forte"
            onClick={() => {
              setPassword(generatePassword());
              setShow(true);
            }}
          />
        </div>
      </FieldGroup>
      <Field label="Descrição">
        <textarea className={ui.textarea} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <FieldGroup label="Tags">
        {v.tags.length === 0 ? (
          <Hint>Nenhuma tag cadastrada. Crie tags na página Tags.</Hint>
        ) : (
          <div className={styles.chips}>
            {[...v.tags]
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
              .map((t) => (
                <TagChip key={t.id} tag={t} selected={tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} />
              ))}
          </div>
        )}
      </FieldGroup>
      <span className={cn(ui.hint)}>A senha é criptografada no seu navegador antes de ser salva.</span>
    </RegistryForm>
  );
}

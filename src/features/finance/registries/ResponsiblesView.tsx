"use client";

import { useState } from "react";
import { collection, doc } from "firebase/firestore";
import { Check, ExternalLink, Link2, Users } from "lucide-react";
import { Badge, IconButton } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { useFinance } from "../data/FinanceDataProvider";
import type { Responsible, ShareMode } from "../lib/types";
import { byName } from "../lib/format";
import { SHARE_MODES, sharePath } from "../lib/share";
import { Field, FieldGroup, Person, Segmented, ui } from "../components/kit";
import { RegistryForm, RegistryView } from "./RegistryView";
import { Settlement } from "./Settlement";

type Tab = "settle" | "people";

const MODE_TONE = { PRIVATE: "neutral", EMAIL: "info", PUBLIC: "warning" } as const;
const newShareId = () => doc(collection(getDb(), "shares")).id;

/** Copiar e abrir o link da fatura pública do responsável. */
function ShareActions({ r }: { r: Responsible }) {
  const [copied, setCopied] = useState(false);
  if (!r.shareId) return null;
  const path = sharePath(r.shareId);
  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie o link:", url);
    }
  };
  return (
    <>
      <IconButton icon={copied ? Check : Link2} size="sm" label={copied ? "Link copiado" : `Copiar link da fatura de ${r.name}`} onClick={copy} />
      <IconButton icon={ExternalLink} size="sm" label={`Abrir fatura de ${r.name}`} onClick={() => window.open(path, "_blank", "noopener")} />
    </>
  );
}

function ResponsibleForm({ editing, onClose }: { editing: Responsible | null; onClose: () => void }) {
  const d = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.avatarUrl ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [mode, setMode] = useState<ShareMode>(editing?.shareMode ?? "PRIVATE");
  const [newLink, setNewLink] = useState(false);

  const submit = async () => {
    if (!name.trim()) return "Informe o nome.";
    const mail = email.trim().toLowerCase();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return "E-mail inválido.";
    if (mode === "EMAIL" && !mail) return "Informe o e-mail Google da pessoa para compartilhar por e-mail.";
    await d.save("responsibles", {
      ...(editing ?? {}),
      id: editing?.id ?? d.newId("responsibles"),
      name: name.trim(),
      avatarUrl: url.trim() || undefined,
      email: mail || undefined,
      shareMode: mode,
      // Um novo id invalida o link antigo; o espelho anterior é apagado na sincronização.
      shareId: newLink || !editing?.shareId ? newShareId() : editing.shareId,
    });
  };

  return (
    <RegistryForm title={editing ? "Editar responsável" : "Novo responsável"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Foto (URL, opcional)">
        <input className={ui.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </Field>
      <Field
        label="E-mail Google"
        hint={mode === "EMAIL" ? "Só esse e-mail poderá abrir a fatura." : "Opcional. Usado para compartilhar a fatura por e-mail."}
      >
        <input className={ui.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@gmail.com" />
      </Field>
      <FieldGroup label="Link da fatura" hint={SHARE_MODES.find((m) => m.value === mode)?.hint}>
        <Segmented<ShareMode> label="Quem pode abrir o link" value={mode} onChange={setMode} options={SHARE_MODES} />
      </FieldGroup>
      {editing?.shareId && (
        <label className={ui.check}>
          <input type="checkbox" checked={newLink} onChange={(e) => setNewLink(e.target.checked)} />
          Gerar um novo link (o atual deixa de funcionar)
        </label>
      )}
    </RegistryForm>
  );
}

export function ResponsiblesView() {
  const d = useFinance();
  const [tab, setTab] = useState<Tab>("settle");

  return (
    <RegistryView
      navId="finance-owners"
      description="Quem divide gastos com você e o acerto de contas."
      headerActions={
        <Segmented<Tab>
          label="Visualização"
          value={tab}
          onChange={setTab}
          options={[
            { value: "settle", label: "Acerto de contas" },
            { value: "people", label: "Pessoas" },
          ]}
        />
      }
      content={tab === "settle" ? <Settlement /> : undefined}
      newLabel="Novo responsável"
      emptyIcon={Users}
      emptyTitle="Nenhum responsável"
      emptyText="Cadastre as pessoas que dividem gastos com você para dividir os lançamentos."
      items={byName(d.responsibles)}
      toRow={(r) => ({
        id: r.id,
        name: r.name,
        visual: <Person name={r.name} url={r.avatarUrl} size="md" />,
        meta: r.email || "Sem e-mail",
        badge: (
          <Badge tone={MODE_TONE[r.shareMode ?? "PRIVATE"]}>{SHARE_MODES.find((m) => m.value === (r.shareMode ?? "PRIVATE"))?.label}</Badge>
        ),
        extraActions: <ShareActions r={r} />,
      })}
      blockDelete={(r) =>
        d.transactions.some(
          (t) =>
            t.splits.some((s) => s.responsibleId === r.id) ||
            Object.values(t.occurrenceSplits ?? {}).some((arr) => arr.some((s) => s.responsibleId === r.id)),
        )
          ? `${r.name} participa de lançamentos e não pode ser excluído.`
          : null
      }
      onDelete={(r) => d.remove("responsibles", r.id)}
      deleteTitle="Excluir responsável"
      renderForm={(editing, close) => <ResponsibleForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

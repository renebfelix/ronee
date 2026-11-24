"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useFinance } from "../data/FinanceDataProvider";
import type { Responsible } from "../lib/types";
import { byName } from "../lib/format";
import { Field, Person, ui } from "../components/kit";
import { RegistryForm, RegistryView } from "./RegistryView";

function ResponsibleForm({ editing, onClose }: { editing: Responsible | null; onClose: () => void }) {
  const d = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.avatarUrl ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");

  const submit = async () => {
    if (!name.trim()) return "Informe o nome.";
    const mail = email.trim().toLowerCase();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return "E-mail inválido.";
    await d.save("responsibles", {
      ...(editing ?? {}),
      id: editing?.id ?? d.newId("responsibles"),
      name: name.trim(),
      avatarUrl: url.trim() || undefined,
      email: mail || undefined,
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
      <Field label="E-mail (opcional)">
        <input className={ui.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" />
      </Field>
    </RegistryForm>
  );
}

export function ResponsiblesView() {
  const d = useFinance();

  return (
    <RegistryView
      navId="finance-owners"
      description="Pessoas que dividem despesas com você."
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

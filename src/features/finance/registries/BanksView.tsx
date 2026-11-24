"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { useFinance } from "../data/FinanceDataProvider";
import type { AccountKind, BankAccount } from "../lib/types";
import { brl, byName, parseMoney } from "../lib/format";
import { IconBadge } from "../components/icons";
import { AppearancePicker, Field, ui } from "../components/kit";
import { RegistryForm, RegistryView } from "./RegistryView";

const KINDS: Record<AccountKind, string> = { CHECKING: "Conta corrente", SAVINGS: "Poupança", INVESTMENT: "Investimento" };

function BankForm({ editing, onClose }: { editing: BankAccount | null; onClose: () => void }) {
  const d = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(editing?.kind ?? "CHECKING");
  const [initial, setInitial] = useState(editing ? String(editing.initialBalance).replace(".", ",") : "0");
  const [color, setColor] = useState(editing?.color ?? "#3A3DE8");
  const [icon, setIcon] = useState(editing?.icon ?? "landmark");

  const submit = async () => {
    const v = parseMoney(initial);
    if (!name.trim()) return "Informe o nome da conta.";
    if (!Number.isFinite(v)) return "Saldo inicial inválido.";
    await d.save("accounts", {
      id: editing?.id ?? d.newId("accounts"),
      name: name.trim(),
      kind,
      initialBalance: v,
      color,
      icon,
      isActive: editing?.isActive ?? true,
    });
  };

  return (
    <RegistryForm title={editing ? "Editar conta" : "Nova conta bancária"} onClose={onClose} onSubmit={submit}>
      <div className={ui.grid2}>
        <Field label="Nome da conta">
          <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank" autoFocus />
        </Field>
        <Field label="Tipo">
          <select className={ui.select} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {Object.entries(KINDS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Saldo inicial (R$)">
          <input className={ui.input} inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </Field>
      </div>
      <AppearancePicker color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
    </RegistryForm>
  );
}

export function BanksView() {
  const d = useFinance();

  return (
    <RegistryView
      navId="finance-banks"
      description="Contas bancárias e saldos."
      newLabel="Nova conta"
      emptyIcon={Landmark}
      emptyTitle="Nenhuma conta cadastrada"
      emptyText="Cadastre uma conta para usar em receitas, despesas e pagamentos de boleto."
      items={byName(d.accounts)}
      toRow={(a) => ({
        id: a.id,
        name: a.name,
        visual: <IconBadge name={a.icon} color={a.color} />,
        meta: KINDS[a.kind],
        aside: brl(d.balances[a.id] ?? 0),
        inactive: !a.isActive,
      })}
      blockDelete={(a) =>
        d.transactions.some(
          (t) =>
            (t.paymentMethodType === "BANK" && t.paymentMethodId === a.id) ||
            // Boletos pagos e cobranças recebidas nesta conta também a vinculam.
            t.paidFromAccountId === a.id ||
            Object.values(t.occurrencePaidFrom ?? {}).includes(a.id) ||
            t.splits.some((s) => s.destinationAccountId === a.id) ||
            Object.values(t.occurrenceSplits ?? {}).some((arr) => arr.some((s) => s.destinationAccountId === a.id)),
        ) || Object.values(d.overrides).some((o) => o.paidFromAccountId === a.id)
          ? `“${a.name}” possui lançamentos vinculados e não pode ser excluída.`
          : null
      }
      onDelete={(a) => d.remove("accounts", a.id)}
      deleteTitle="Excluir conta"
      renderForm={(editing, close) => <BankForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

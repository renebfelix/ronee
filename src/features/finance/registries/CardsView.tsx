"use client";

import { useState } from "react";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { useFinance } from "../data/FinanceDataProvider";
import type { CreditCard } from "../lib/types";
import { brl, byName, parseMoney } from "../lib/format";
import { IconBadge } from "../components/icons";
import { AppearancePicker, Field, ui } from "../components/kit";
import { Badge } from "@/components/ui";
import { useDefaultMethods } from "../data/useDefaultMethods";
import { DefaultToggle, RegistryForm, RegistryView } from "./RegistryView";

const BRANDS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];

function CardForm({ editing, onClose }: { editing: CreditCard | null; onClose: () => void }) {
  const d = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [brand, setBrand] = useState(editing?.brand ?? "Mastercard");
  const [limit, setLimit] = useState(editing ? String(editing.limit).replace(".", ",") : "");
  const [best, setBest] = useState(String(editing?.defaultBestDay ?? 5));
  const [due, setDue] = useState(String(editing?.dueDay ?? 15));
  const [color, setColor] = useState(editing?.color ?? "#8E44EC");
  const [icon, setIcon] = useState(editing?.icon ?? "credit-card");

  const submit = async () => {
    const l = parseMoney(limit);
    const b = parseInt(best, 10);
    const dd = parseInt(due, 10);
    if (!name.trim()) return "Informe o nome do cartão.";
    if (!Number.isFinite(l) || l < 0) return "Informe o limite total.";
    if (!(b >= 1 && b <= 31) || !(dd >= 1 && dd <= 31)) return "Dias devem estar entre 1 e 31.";
    await d.save("cards", {
      id: editing?.id ?? d.newId("cards"),
      name: name.trim(),
      brand,
      limit: l,
      defaultBestDay: b,
      dueDay: dd,
      color,
      icon,
      isActive: editing?.isActive ?? true,
    });
  };

  return (
    <RegistryForm title={editing ? "Editar cartão" : "Novo cartão de crédito"} onClose={onClose} onSubmit={submit}>
      <div className={ui.grid2}>
        <Field label="Nome do cartão">
          <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank Ultravioleta" autoFocus />
        </Field>
        <Field label="Bandeira">
          <select className={ui.select} value={brand} onChange={(e) => setBrand(e.target.value)}>
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Limite total (R$)">
          <input className={ui.input} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Melhor dia de compra" hint="Compras até esse dia entram na fatura do mês.">
          <input className={ui.input} type="number" min={1} max={31} value={best} onChange={(e) => setBest(e.target.value)} />
        </Field>
        <Field label="Dia de vencimento">
          <input className={ui.input} type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <AppearancePicker color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
    </RegistryForm>
  );
}

export function CardsView() {
  const d = useFinance();
  const defaults = useDefaultMethods();

  return (
    <RegistryView
      navId="finance-cards"
      description="Cartões de crédito usados nos lançamentos. A estrela define o cartão que já vem selecionado."
      newLabel="Novo cartão"
      emptyIcon={CreditCardIcon}
      emptyTitle="Nenhum cartão cadastrado"
      emptyText="Cadastre um cartão para lançar compras no crédito; elas entram no mês da fatura."
      items={byName(d.cards)}
      toRow={(c) => ({
        id: c.id,
        name: c.name,
        visual: <IconBadge name={c.icon} color={c.color} />,
        meta: `${c.brand} · Melhor dia ${c.defaultBestDay} · Vence dia ${c.dueDay}`,
        aside: c.limit > 0 ? brl(c.limit) : undefined,
        inactive: !c.isActive,
        badge: defaults.defaultCardId === c.id ? <Badge tone="warning">Padrão</Badge> : undefined,
        extraActions: (
          <DefaultToggle on={defaults.defaultCardId === c.id} name={c.name} onToggle={() => defaults.toggleDefault("card", c.id)} />
        ),
      })}
      blockDelete={(c) =>
        d.transactions.some((t) => t.paymentMethodType === "CARD" && t.paymentMethodId === c.id)
          ? `“${c.name}” possui lançamentos vinculados e não pode ser excluído.`
          : null
      }
      onDelete={(c) => d.remove("cards", c.id)}
      deleteTitle="Excluir cartão"
      renderForm={(editing, close) => <CardForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

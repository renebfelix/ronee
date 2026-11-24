"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { useFinance } from "../data/FinanceDataProvider";
import type { Category, CategoryType } from "../lib/types";
import { brl, byName, parseMoney } from "../lib/format";
import { IconBadge } from "../components/icons";
import { AppearancePicker, Field, Segmented, ui } from "../components/kit";
import { RegistryForm, RegistryView } from "./RegistryView";

function CategoryForm({ editing, type, onClose }: { editing: Category | null; type: CategoryType; onClose: () => void }) {
  const d = useFinance();
  const t = editing?.type ?? type;
  const [name, setName] = useState(editing?.name ?? "");
  const [limit, setLimit] = useState(editing?.monthlyLimit ? String(editing.monthlyLimit).replace(".", ",") : "");
  const [color, setColor] = useState(editing?.color ?? "#3A3DE8");
  const [icon, setIcon] = useState(editing?.icon ?? "tag");

  const submit = async () => {
    if (!name.trim()) return "Informe o nome da categoria.";
    let monthlyLimit: number | undefined;
    if (t === "EXPENSE" && limit.trim()) {
      const v = parseMoney(limit);
      if (!Number.isFinite(v) || v < 0) return "Teto mensal inválido.";
      monthlyLimit = v > 0 ? v : undefined;
    }
    await d.save("categories", {
      id: editing?.id ?? d.newId("categories"),
      name: name.trim(),
      type: t,
      monthlyLimit,
      color,
      icon,
      isActive: editing?.isActive ?? true,
    });
  };

  return (
    <RegistryForm
      title={editing ? "Editar categoria" : t === "EXPENSE" ? "Nova categoria de saída" : "Nova categoria de entrada"}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="Nome">
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      {t === "EXPENSE" && (
        <Field label="Teto de gastos mensal (opcional)">
          <input className={ui.input} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Ex.: 800,00" />
        </Field>
      )}
      <AppearancePicker color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
    </RegistryForm>
  );
}

export function CategoriesView() {
  const d = useFinance();
  const [tab, setTab] = useState<CategoryType>("EXPENSE");
  const items = byName(d.categories.filter((c) => c.type === tab));

  return (
    <RegistryView
      navId="finance-categories"
      description="Organize seus lançamentos de entrada e saída."
      newLabel="Nova categoria"
      emptyIcon={Tags}
      emptyTitle="Nenhuma categoria"
      emptyText={tab === "EXPENSE" ? "Crie categorias para classificar suas despesas." : "Crie categorias para classificar suas receitas."}
      toolbar={
        <Segmented
          label="Tipo de categoria"
          value={tab}
          onChange={setTab}
          options={[
            { value: "EXPENSE", label: "Saídas" },
            { value: "INCOME", label: "Entradas" },
          ]}
        />
      }
      items={items}
      toRow={(c) => ({
        id: c.id,
        name: c.name,
        visual: <IconBadge name={c.icon} color={c.color} />,
        meta: c.type === "EXPENSE" ? (c.monthlyLimit ? `Teto mensal de ${brl(c.monthlyLimit)}` : "Sem teto mensal") : "Entrada",
        inactive: !c.isActive,
      })}
      blockDelete={(c) =>
        d.transactions.some((t) => t.categoryId === c.id)
          ? `“${c.name}” tem lançamentos e não pode ser excluída. Altere a categoria desses lançamentos antes.`
          : null
      }
      onDelete={(c) => d.remove("categories", c.id)}
      deleteTitle="Excluir categoria"
      renderForm={(editing, close) => <CategoryForm key={editing?.id ?? "new"} editing={editing} type={tab} onClose={close} />}
    />
  );
}

"use client";

import { useState } from "react";
import { Tag, Tags } from "lucide-react";
import { hashColor } from "@/features/finance/lib/format";
import { Field, ui } from "@/features/finance/components/kit";
import { RegistryForm, RegistryView } from "@/features/finance/registries/RegistryView";
import { useShopping } from "./data/ShoppingDataProvider";
import type { ShoppingCategory } from "./lib/types";

function CategoryForm({ editing, onClose }: { editing: ShoppingCategory | null; onClose: () => void }) {
  const s = useShopping();
  const [name, setName] = useState(editing?.name ?? "");

  const submit = async () => {
    const n = name.trim();
    if (!n) return "Informe o nome da categoria.";
    if (s.categories.some((c) => c.id !== editing?.id && c.name.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"))) {
      return "Já existe uma categoria com esse nome.";
    }
    if (editing) await s.renameCategory(editing.id, n);
    else await s.addCategory(n);
  };

  return (
    <RegistryForm title={editing ? "Editar categoria" : "Nova categoria"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Mercearia" autoFocus />
      </Field>
    </RegistryForm>
  );
}

export function ShoppingCategoriesView() {
  const s = useShopping();
  const count = (id: string) => s.products.filter((p) => p.categoryId === id).length;

  return (
    <RegistryView
      navId="shopping-categories"
      description="Agrupe os produtos por seção do mercado."
      newLabel="Nova categoria"
      emptyIcon={Tags}
      emptyTitle="Nenhuma categoria"
      emptyText="Crie categorias (ex.: Mercearia, Limpeza, Hortifrúti) para organizar seus produtos e a lista do mês."
      items={s.categories}
      toRow={(c) => {
        const n = count(c.id);
        const color = hashColor(c.name);
        return {
          id: c.id,
          name: c.name,
          visual: (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 12,
                color,
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
              }}
              aria-hidden
            >
              <Tag size={18} />
            </span>
          ),
          meta: n === 0 ? "Nenhum produto" : n === 1 ? "1 produto" : `${n} produtos`,
        };
      }}
      blockDelete={(c) => (count(c.id) > 0 ? `“${c.name}” tem produtos. Mova ou exclua os produtos primeiro.` : null)}
      onDelete={(c) => s.removeCategory(c.id)}
      deleteTitle="Excluir categoria"
      renderForm={(editing, close) => <CategoryForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

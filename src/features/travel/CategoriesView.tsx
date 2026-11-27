"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { Field, FieldGroup, ui } from "@/features/finance/components/kit";
import { RegistryForm, RegistryView } from "@/features/finance/registries/RegistryView";
import { cn } from "@/lib/utils/cn";
import { PlaceBadge } from "./components/PlaceBadge";
import { useTravel } from "./data/TravelDataProvider";
import { CATEGORY_COLORS, PLACE_ICONS } from "./lib/travel";
import type { PlaceCategory } from "./lib/types";

function CategoryForm({ editing, onClose }: { editing: PlaceCategory | null; onClose: () => void }) {
  const s = useTravel();
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "pin");
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]);

  const submit = async () => {
    const n = name.trim();
    if (!n) return "Informe o nome da categoria.";
    if (s.categories.some((c) => c.id !== editing?.id && c.name.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"))) {
      return "Já existe uma categoria com esse nome.";
    }
    if (editing) await s.updateCategory(editing.id, { name: n, icon, color });
    else await s.addCategory({ name: n, icon, color });
  };

  return (
    <RegistryForm title={editing ? "Editar categoria" : "Nova categoria"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PlaceBadge icon={icon} color={color} />
          <input
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Museus"
            maxLength={30}
            autoFocus
          />
        </div>
      </Field>
      <FieldGroup label="Cor">
        <div className={ui.swatches}>
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(ui.swatch, c === color && ui.swatchOn)}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
              aria-pressed={c === color}
            />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Ícone (aparece no marcador do mapa)">
        <div className={ui.iconpick}>
          {Object.entries(PLACE_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              className={cn(ui.iconpickBtn, key === icon && ui.iconpickOn)}
              style={key === icon ? { color, borderColor: color } : undefined}
              onClick={() => setIcon(key)}
              aria-label={key}
              aria-pressed={key === icon}
            >
              <Icon size={18} aria-hidden />
            </button>
          ))}
        </div>
      </FieldGroup>
    </RegistryForm>
  );
}

export function TravelCategoriesView() {
  const s = useTravel();

  return (
    <RegistryView
      navId="travel-categories"
      description="Tipos de lugar para visitar, com ícone e cor no mapa."
      newLabel="Nova categoria"
      emptyIcon={Tags}
      emptyTitle="Nenhuma categoria"
      emptyText="Crie categorias (ex.: Restaurantes, Pontos turísticos, Hospedagem) para organizar os lugares."
      items={s.categories}
      toRow={(c) => {
        const n = s.placeCounts[c.id] ?? 0;
        return {
          id: c.id,
          name: c.name,
          visual: <PlaceBadge icon={c.icon} color={c.color} />,
          meta: n === 0 ? "Nenhum lugar" : n === 1 ? "1 lugar" : `${n} lugares`,
        };
      }}
      blockDelete={(c) =>
        s.categories.length <= 1
          ? "Mantenha ao menos uma categoria."
          : s.placeCounts[c.id]
            ? `“${c.name}” tem lugares. Mova-os para outra categoria antes de excluir.`
            : null
      }
      onDelete={(c) => s.removeCategory(c.id)}
      deleteTitle="Excluir categoria"
      renderForm={(editing, close) => <CategoryForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

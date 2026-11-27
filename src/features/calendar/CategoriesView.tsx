"use client";

import { useState } from "react";
import { Tags } from "lucide-react";
import { Field, FieldGroup, ui } from "@/features/finance/components/kit";
import { RegistryForm, RegistryView } from "@/features/finance/registries/RegistryView";
import { CategoryGlyph } from "@/features/tasks/components/CategoryGlyph";
import { cn } from "@/lib/utils/cn";
import { useCalendar } from "./data/CalendarDataProvider";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "./lib/calendar";
import { HOLIDAY_CATEGORY } from "./lib/holidays";
import type { EventCategory } from "./lib/types";

function CategoryBadge({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 12,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
      aria-hidden
    >
      <CategoryGlyph icon={icon} size={Math.round(size * 0.45)} />
    </span>
  );
}

function CategoryForm({ editing, onClose }: { editing: EventCategory | null; onClose: () => void }) {
  const s = useCalendar();
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "tag");
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
          <CategoryBadge icon={icon} color={color} />
          <input
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Trabalho"
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
      <FieldGroup label="Ícone">
        <div className={ui.iconpick}>
          {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
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

export function CalendarCategoriesView() {
  const s = useCalendar();

  return (
    <RegistryView
      navId="calendar-categories"
      description="Separe seus compromissos por tipo, com ícone e cor no calendário."
      newLabel="Nova categoria"
      emptyIcon={Tags}
      emptyTitle="Nenhuma categoria"
      emptyText="Crie categorias (ex.: Trabalho, Família, Saúde) para organizar seus eventos."
      items={s.categories}
      toRow={(c) => {
        const n = s.eventCounts[c.id] ?? 0;
        return {
          id: c.id,
          name: c.name,
          visual: <CategoryBadge icon={c.icon} color={c.color} />,
          meta:
            c.id === HOLIDAY_CATEGORY.id
              ? "Automática — feriados nacionais, de SP e da cidade de São Paulo"
              : n === 0
                ? "Nenhum evento"
                : n === 1
                  ? "1 evento"
                  : `${n} eventos`,
        };
      }}
      blockDelete={(c) =>
        c.id === HOLIDAY_CATEGORY.id
          ? "A categoria Feriados é usada pelos feriados automáticos e não pode ser excluída."
          : s.categories.length <= 1
          ? "Mantenha ao menos uma categoria."
          : s.eventCounts[c.id]
            ? `“${c.name}” tem eventos. Mova-os para outra categoria antes de excluir.`
            : null
      }
      onDelete={(c) => s.removeCategory(c.id)}
      deleteTitle="Excluir categoria"
      renderForm={(editing, close) => <CategoryForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

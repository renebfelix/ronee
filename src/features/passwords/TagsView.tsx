"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { COLORS } from "@/features/finance/lib/format";
import { Field, FieldGroup, ui } from "@/features/finance/components/kit";
import { RegistryForm, RegistryView } from "@/features/finance/registries/RegistryView";
import { useVault } from "./data/VaultProvider";
import type { PasswordTag } from "./lib/types";
import { VaultTimer } from "./components/VaultTimer";
import { TagChip } from "./components/TagChip";
import styles from "./components/PasswordsView.module.scss";

function TagForm({ editing, onClose }: { editing: PasswordTag | null; onClose: () => void }) {
  const v = useVault();
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? COLORS[0]);

  const submit = async () => {
    const n = name.trim();
    if (!n) return "Informe o nome da tag.";
    if (v.tags.some((t) => t.id !== editing?.id && t.name.toLocaleLowerCase("pt-BR") === n.toLocaleLowerCase("pt-BR"))) {
      return "Já existe uma tag com esse nome.";
    }
    await v.save<PasswordTag>("tags", { id: editing?.id ?? v.newId("tags"), name: n, color });
  };

  return (
    <RegistryForm title={editing ? "Editar tag" : "Nova tag"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Trabalho" autoFocus />
      </Field>
      <FieldGroup label="Cor">
        <div className={ui.swatches}>
          {COLORS.map((c) => (
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
      <FieldGroup label="Prévia">
        <div>
          <TagChip tag={{ id: "preview", name: name.trim() || "Tag", color }} />
        </div>
      </FieldGroup>
    </RegistryForm>
  );
}

export function TagsView() {
  const v = useVault();
  const items = [...v.tags].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const count = (id: string) => v.entries.filter((e) => e.tagIds.includes(id)).length;

  return (
    <RegistryView
      navId="passwords-tags"
      description="Organize suas senhas com tags e use-as como filtro."
      newLabel="Nova tag"
      headerActions={<VaultTimer />}
      emptyIcon={Tag}
      emptyTitle="Nenhuma tag"
      emptyText="Crie tags (ex.: Trabalho, Bancos, Streaming) para agrupar e filtrar suas senhas."
      items={items}
      toRow={(t) => {
        const n = count(t.id);
        return {
          id: t.id,
          name: t.name,
          visual: <span className={styles.dot} style={{ ["--tag" as string]: t.color, width: 14, height: 14 }} aria-hidden />,
          meta: n === 0 ? "Nenhuma senha" : n === 1 ? "1 senha" : `${n} senhas`,
        };
      }}
      blockDelete={() => null}
      onDelete={(t) => v.removeTag(t.id)}
      deleteTitle="Excluir tag"
      renderForm={(editing, close) => <TagForm key={editing?.id ?? "new"} editing={editing} onClose={close} />}
    />
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useFinance } from "@/features/finance/data/FinanceDataProvider";
import { Field, FieldGroup, Hint, Person, ui } from "@/features/finance/components/kit";
import { byName } from "@/features/finance/lib/format";
import { todayStr } from "@/features/finance/lib/finance";
import { RegistryForm } from "@/features/finance/registries/RegistryView";
import { cn } from "@/lib/utils/cn";
import { useTravel } from "../data/TravelDataProvider";
import { financeCategoryName } from "../lib/travel";
import type { Trip } from "../lib/types";

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Criação/edição de viagem. Ao criar, também cria a categoria de despesa em Finanças. */
export function TripForm({
  editing,
  onClose,
  onCreated,
}: {
  editing: Trip | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const t = useTravel();
  const fin = useFinance();
  const [name, setName] = useState(editing?.name ?? "");
  const [destination, setDestination] = useState(editing?.destination ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayStr());
  const [endDate, setEndDate] = useState(editing?.endDate ?? todayStr());
  const [companions, setCompanions] = useState<string[]>(editing?.companions ?? []);
  const responsibles = byName(fin.responsibles);

  const toggle = (id: string) => setCompanions((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const submit = async () => {
    const n = name.trim();
    if (!n) return "Informe o nome da viagem.";
    if (!isDate(startDate) || !isDate(endDate)) return "Informe as datas de início e fim.";
    if (endDate < startDate) return "A data de fim precisa ser igual ou posterior ao início.";
    // Companhias removidas de Finanças não ficam presas na viagem.
    const data = {
      name: n,
      destination: destination.trim(),
      startDate,
      endDate,
      companions: companions.filter((id) => fin.respById(id)),
    };
    if (editing) await t.updateTrip(editing, data);
    else onCreated?.(await t.addTrip(data));
  };

  return (
    <RegistryForm title={editing ? "Editar viagem" : "Nova viagem"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <input
          className={ui.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Férias em Lisboa"
          maxLength={50}
          autoFocus
        />
      </Field>
      <Field label="Destino (opcional)">
        <input
          className={ui.input}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Ex.: Lisboa, Portugal"
          maxLength={80}
        />
      </Field>
      <div className={ui.grid2}>
        <Field label="Início">
          <input
            className={ui.input}
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (isDate(e.target.value) && endDate < e.target.value) setEndDate(e.target.value);
            }}
          />
        </Field>
        <Field label="Fim">
          <input className={ui.input} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <FieldGroup
        label="Companhias de viagem"
        hint={
          responsibles.length === 0 ? (
            <>
              As companhias vêm dos <Link href="/financas/responsaveis">Responsáveis em Finanças</Link>. Cadastre quem viaja com
              você por lá.
            </>
          ) : (
            "Pessoas cadastradas como Responsáveis em Finanças."
          )
        }
      >
        {responsibles.length > 0 && (
          <div className={ui.chips}>
            {responsibles.map((r) => {
              const on = companions.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={cn(ui.chip, on && ui.chipOn)}
                  onClick={() => toggle(r.id)}
                  aria-pressed={on}
                >
                  <Person name={r.name} url={r.avatarUrl} />
                  {r.name}
                </button>
              );
            })}
          </div>
        )}
      </FieldGroup>
      {!editing && (
        <Hint>
          Uma categoria de despesa “{financeCategoryName(name.trim() || "…")}” será criada em Finanças para os gastos da viagem.
        </Hint>
      )}
    </RegistryForm>
  );
}

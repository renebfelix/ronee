"use client";

import { SETTINGS_ID } from "../lib/types";
import { useFinance } from "./FinanceDataProvider";

type Kind = "card" | "account";
const FIELD = { card: "defaultCardId", account: "defaultAccountId" } as const;

/** Cartão e conta padrão dos novos lançamentos (guardados em `settings/general`). */
export function useDefaultMethods() {
  const d = useFinance();
  const current = d.settings[SETTINGS_ID];

  /** Marca o item como padrão; se ele já for o padrão, remove a marcação. */
  const toggleDefault = (kind: Kind, id: string) => {
    const field = FIELD[kind];
    const next = current?.[field] === id ? undefined : id;
    return d.save("settings", { ...(current ?? {}), id: SETTINGS_ID, [field]: next, updatedAt: Date.now() });
  };

  return {
    defaultCardId: current?.defaultCardId,
    defaultAccountId: current?.defaultAccountId,
    toggleDefault,
  };
}

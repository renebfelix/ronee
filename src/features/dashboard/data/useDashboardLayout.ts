"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { getDb } from "@/lib/firebase";

/**
 * Layout salvo em `users/{uid}/modules/dashboard` → { layout: { order, hidden } }.
 * `order` guarda todos os cards (inclusive os ocultos), então um card volta para o mesmo lugar
 * quando é adicionado de novo.
 */
export interface DashboardLayout {
  order: string[];
  hidden: string[];
}

/** Junta o salvo com os cards existentes: ignora ids que não existem mais e acrescenta os novos no fim. */
function normalize(saved: Partial<DashboardLayout> | undefined, ids: string[]): DashboardLayout {
  const known = new Set(ids);
  const order = (saved?.order ?? []).filter((id) => known.has(id));
  ids.forEach((id) => !order.includes(id) && order.push(id));
  return { order, hidden: (saved?.hidden ?? []).filter((id) => known.has(id)) };
}

export function useDashboardLayout(ids: string[]) {
  const { user } = useAuth();
  const uid = user!.uid;
  const idsKey = ids.join(",");
  const [saved, setSaved] = useState<Partial<DashboardLayout> | undefined | null>(null);
  /** Rascunho local enquanto um card é arrastado (só grava ao soltar). */
  const [draft, setDraft] = useState<DashboardLayout | null>(null);

  const ref = useMemo(() => doc(getDb(), "users", uid, "modules", "dashboard"), [uid]);

  useEffect(
    () =>
      onSnapshot(
        ref,
        (snap) => setSaved((snap.data()?.layout as Partial<DashboardLayout> | undefined) ?? undefined),
        // Sem acesso ao layout salvo: usa o padrão em vez de travar o dashboard.
        () => setSaved(undefined),
      ),
    [ref],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey representa `ids`
  const layout = useMemo(() => (saved === null ? null : normalize(saved, ids)), [saved, idsKey]);

  const save = useCallback(
    (next: DashboardLayout) => {
      setSaved(next); // otimista: o snapshot confirma em seguida
      setDraft(null);
      return setDoc(ref, { layout: next }, { merge: true });
    },
    [ref],
  );

  return {
    /** null enquanto carrega. */
    layout: draft ?? layout,
    save,
    setDraft,
    reset: () => save({ order: ids, hidden: [] }),
  };
}

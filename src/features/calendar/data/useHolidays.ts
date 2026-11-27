"use client";

import { useEffect, useMemo, useState } from "react";
import { holidayToEvent, type Holiday } from "../lib/holidays";
import type { CalendarEvent } from "../lib/types";

const STORAGE_KEY = (year: number) => `ronee:calendar:holidays:${year}`;
/** Feriados mudam pouco: guarda cada ano no aparelho por 7 dias. */
const TTL = 7 * 24 * 60 * 60 * 1000;

type Status = "ok" | "unavailable";

function readCache(year: number): Holiday[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY(year)) ?? "null") as { at: number; holidays: Holiday[] } | null;
    return saved && Date.now() - saved.at < TTL ? saved.holidays : null;
  } catch {
    return null;
  }
}

/** Do cache do aparelho ou da rota /api/feriados (que guarda a chave da APIBrasil). */
async function loadYear(year: number): Promise<Holiday[]> {
  const cached = readCache(year);
  if (cached) return cached;
  const res = await fetch(`/api/feriados?ano=${year}`);
  if (!res.ok) throw new Error(String(res.status));
  const { holidays } = (await res.json()) as { holidays: Holiday[] };
  if (holidays.length) localStorage.setItem(STORAGE_KEY(year), JSON.stringify({ at: Date.now(), holidays }));
  return holidays;
}

/** Feriados (nacionais, SP e cidade de São Paulo) dos anos pedidos, como eventos somente leitura. */
export function useHolidays(years: number[]) {
  const [byYear, setByYear] = useState<Record<number, Holiday[]>>({});
  const [status, setStatus] = useState<Status>("ok");
  const yearsKey = [...new Set(years)].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    for (const year of yearsKey.split(",").map(Number)) {
      if (byYear[year]) continue;
      loadYear(year)
        .then((holidays) => !cancelled && setByYear((prev) => ({ ...prev, [year]: holidays })))
        .catch(() => !cancelled && setStatus("unavailable"));
    }
    return () => {
      cancelled = true;
    };
    // `byYear` fica de fora de propósito: só busca de novo quando os anos mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsKey]);

  const events = useMemo<CalendarEvent[]>(() => Object.values(byYear).flat().map(holidayToEvent), [byYear]);
  return { events, status };
}

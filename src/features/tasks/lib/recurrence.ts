import type { Recurrence } from "./types";

export const RECURRENCES: Record<Recurrence, string> = {
  daily: "Todo dia",
  weekdays: "Dias úteis",
  weekly: "Toda semana",
  monthly: "Todo mês",
  yearly: "Todo ano",
};

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === "string" && value in RECURRENCES;
}

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Soma meses sem "pular" o mês quando o dia não existe (31/01 → 28/02). */
function addMonths(date: Date, months: number) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function step(date: Date, recurrence: Recurrence) {
  const next = new Date(date);
  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekdays":
      do next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6);
      return next;
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly":
      return addMonths(date, 1);
    case "yearly":
      return addMonths(date, 12);
  }
}

/** Próxima ocorrência depois de `dueDate`; se ainda ficar no passado, avança até hoje. */
export function nextOccurrence(dueDate: string, recurrence: Recurrence, today = toDateString(new Date())) {
  let next = step(parse(dueDate), recurrence);
  while (toDateString(next) < today) next = step(next, recurrence);
  return toDateString(next);
}

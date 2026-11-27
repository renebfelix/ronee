import { addDays, addMonthsClamped, diffDays, parseDate, shortDateLabel, weekday, WEEKDAYS_LONG } from "./dates";
import type { CalendarEvent, Frequency, Occurrence, RecurrenceRule } from "./types";

export const FREQUENCIES: Record<Frequency, { label: string; unit: [string, string] }> = {
  daily: { label: "Diariamente", unit: ["dia", "dias"] },
  weekly: { label: "Semanalmente", unit: ["semana", "semanas"] },
  monthly: { label: "Mensalmente", unit: ["mês", "meses"] },
  yearly: { label: "Anualmente", unit: ["ano", "anos"] },
};

const MAX_STEPS = 20_000;

/**
 * Datas de início das ocorrências, em ordem, a partir de `start`.
 * `minIndex` permite pular direto para perto do intervalo pedido (séries diárias/semanais longas).
 */
function* starts(start: string, rule: RecurrenceRule, minStart: string): Generator<{ date: string; index: number }> {
  const interval = Math.max(1, rule.interval || 1);

  if (rule.freq === "weekly") {
    const days = (rule.weekdays?.length ? [...rule.weekdays] : [weekday(start)]).sort((a, b) => a - b);
    const weekStart = addDays(start, -weekday(start));
    let index = 0;
    let w = 0;
    // Sem limite de quantidade dá para pular as semanas anteriores ao intervalo.
    if (rule.count == null) {
      const weeks = Math.floor(diffDays(weekStart, minStart) / 7);
      if (weeks > interval) w = Math.floor((weeks - 1) / interval) * interval;
    }
    for (let i = 0; i < MAX_STEPS; i++, w += interval) {
      for (const d of days) {
        const date = addDays(weekStart, w * 7 + d);
        if (date < start) continue;
        yield { date, index: index++ };
      }
    }
    return;
  }

  let n = 0;
  if (rule.freq === "daily" && rule.count == null) {
    const gap = diffDays(start, minStart);
    if (gap > interval) n = Math.floor((gap - 1) / interval);
  }
  for (let i = 0; i < MAX_STEPS; i++, n++) {
    const k = n * interval;
    const date =
      rule.freq === "daily" ? addDays(start, k) : rule.freq === "monthly" ? addMonthsClamped(start, k) : addMonthsClamped(start, k * 12);
    yield { date, index: n };
  }
}

/** Ocorrências do evento que tocam o intervalo [from, to] (inclusive). */
export function expandEvent(event: CalendarEvent, from: string, to: string): Occurrence[] {
  const duration = Math.max(0, diffDays(event.startDate, event.endDate));
  const make = (startDate: string): Occurrence => ({
    key: `${event.id}:${startDate}`,
    event,
    startDate,
    endDate: addDays(startDate, duration),
  });

  const rule = event.recurrence;
  if (!rule) {
    return event.startDate <= to && event.endDate >= from ? [make(event.startDate)] : [];
  }

  const out: Occurrence[] = [];
  const exceptions = new Set(event.exceptions ?? []);
  const minStart = addDays(from, -duration);
  for (const { date, index } of starts(event.startDate, rule, minStart)) {
    if (date > to) break;
    if (rule.until && date > rule.until) break;
    if (rule.count != null && index >= rule.count) break;
    if (date < minStart || exceptions.has(date)) continue;
    out.push(make(date));
  }
  return out;
}

export function expandAll(events: CalendarEvent[], from: string, to: string) {
  return events.flatMap((e) => expandEvent(e, from, to));
}

/** Texto legível da regra, ex.: "A cada 2 semanas às segundas e quartas, até 10 de dez." */
export function describeRecurrence(rule: RecurrenceRule) {
  const { unit } = FREQUENCIES[rule.freq];
  const interval = Math.max(1, rule.interval || 1);
  let text =
    interval === 1
      ? { daily: "Todo dia", weekly: "Toda semana", monthly: "Todo mês", yearly: "Todo ano" }[rule.freq]
      : `A cada ${interval} ${unit[1]}`;

  if (rule.freq === "weekly" && rule.weekdays?.length) {
    const days = [...rule.weekdays].sort((a, b) => a - b);
    const isWorkweek = days.join() === "1,2,3,4,5";
    if (isWorkweek && interval === 1) text = "Dias úteis (seg. a sex.)";
    else {
      const names = days.map((d) => WEEKDAYS_LONG[d]);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
      text += ` (${list})`;
    }
  }
  if (rule.until) text += `, até ${shortDateLabel(rule.until)}`;
  else if (rule.count) text += `, ${rule.count} ${rule.count === 1 ? "vez" : "vezes"}`;
  return text;
}

/** Data anterior a `date` — usada para encerrar uma série antes de uma ocorrência. */
export function dayBefore(date: string) {
  return addDays(date, -1);
}

export function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parseDate(date).getTime());
}

import type { Occurrence } from "./types";

// Usado no navegador (formulário) e no servidor (/api/cron/agenda): sem dependências de cliente.

/** Horário de referência dos lembretes de eventos de dia inteiro. */
export const ALL_DAY_REMINDER_TIME = "09:00";

export const TIMED_REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
export const ALL_DAY_REMINDERS = [0, 1440, 2880, 10080];

/** Lembrete sugerido para eventos novos. */
export const DEFAULT_TIMED_REMINDERS = [10];
export const DEFAULT_ALL_DAY_REMINDERS = [1440];

export const MAX_REMINDERS = 5;

function durationText(min: number) {
  if (min % 10080 === 0) return min === 10080 ? "1 semana" : `${min / 10080} semanas`;
  if (min % 1440 === 0) return min === 1440 ? "1 dia" : `${min / 1440} dias`;
  if (min % 60 === 0) return min === 60 ? "1 hora" : `${min / 60} horas`;
  return `${min} min`;
}

export function reminderLabel(min: number, allDay: boolean) {
  if (allDay) {
    if (min === 0) return "No dia, às 9h";
    if (min === 1440) return "Na véspera, às 9h";
    return `${durationText(min)} antes, às 9h`;
  }
  return min === 0 ? "Na hora do evento" : `${durationText(min)} antes`;
}

/** Data/hora local "ingênua" (sem fuso) em milissegundos, para fazer contas de minutos. */
export function naiveMs(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, min);
}

/** Momentos (hora local ingênua) em que os lembretes da ocorrência disparam. */
export function reminderTimes(o: Occurrence) {
  const time = o.event.allDay ? ALL_DAY_REMINDER_TIME : (o.event.startTime ?? ALL_DAY_REMINDER_TIME);
  const start = naiveMs(o.startDate, time);
  return [...new Set(o.event.reminders ?? [])].map((offset) => ({ offset, at: start - offset * 60_000 }));
}

/** Texto da notificação, ex.: "Em 10 min · 14:00 – 15:00 · Sala 3". */
export function reminderBody(o: Occurrence, offset: number) {
  const { allDay, startTime, endTime, location } = o.event;
  const when = allDay
    ? offset === 0
      ? "Hoje, dia inteiro"
      : offset === 1440
        ? "Amanhã, dia inteiro"
        : `Em ${durationText(offset)}, dia inteiro`
    : offset === 0
      ? `Agora · ${startTime}${endTime && endTime !== startTime ? ` – ${endTime}` : ""}`
      : offset === 1440
        ? `Amanhã às ${startTime}`
        : `Em ${durationText(offset)} · ${startTime}${endTime && endTime !== startTime ? ` – ${endTime}` : ""}`;
  return location ? `${when}\n${location}` : when;
}

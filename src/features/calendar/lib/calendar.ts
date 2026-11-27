import { addDays, diffDays, minutesBetween } from "./dates";
import type { EventCategory, Occurrence } from "./types";

// Mesmo catálogo de ícones e cores das Tarefas (a chave fica salva no Firestore).
export { CATEGORY_COLORS, CATEGORY_ICONS, normalize } from "@/features/tasks/lib/tasks";

/** Categorias criadas na primeira vez que o usuário abre a Agenda. */
export const DEFAULT_CATEGORIES: EventCategory[] = [
  { id: "personal", name: "Pessoal", icon: "user", color: "#2563eb", order: 0 },
  { id: "work", name: "Trabalho", icon: "briefcase", color: "#6366f1", order: 1 },
  { id: "family", name: "Família", icon: "home", color: "#16a34a", order: 2 },
  { id: "health", name: "Saúde", icon: "heart", color: "#ec4899", order: 3 },
  { id: "birthdays", name: "Aniversários", icon: "gift", color: "#f97316", order: 4 },
  { id: "leisure", name: "Lazer", icon: "smile", color: "#14b8a6", order: 5 },
];

/** Dia inteiro primeiro, depois por horário de início e título. */
export function compareOccurrences(a: Occurrence, b: Occurrence) {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  const ta = a.event.startTime ?? "";
  const tb = b.event.startTime ?? "";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.event.title.localeCompare(b.event.title, "pt-BR");
}

/** Ocorrências que aparecem em cada dia (eventos de vários dias aparecem em todos). */
export function groupByDay(occurrences: Occurrence[], from: string, to: string) {
  const map: Record<string, Occurrence[]> = {};
  for (const o of [...occurrences].sort(compareOccurrences)) {
    const first = o.startDate < from ? from : o.startDate;
    const last = o.endDate > to ? to : o.endDate;
    for (let d = first; d <= last; d = addDays(d, 1)) (map[d] ??= []).push(o);
  }
  return map;
}

/** Texto do horário de uma ocorrência vista em `day`. */
export function timeLabel(o: Occurrence, day = o.startDate) {
  const { allDay, startTime, endTime } = o.event;
  const multi = o.startDate !== o.endDate;
  if (allDay) {
    if (!multi) return "Dia inteiro";
    return `Dia ${diffDays(o.startDate, day) + 1} de ${diffDays(o.startDate, o.endDate) + 1}`;
  }
  if (multi) {
    if (day === o.startDate) return `A partir das ${startTime}`;
    if (day === o.endDate) return `Até ${endTime}`;
    return "Dia inteiro";
  }
  return endTime && endTime !== startTime ? `${startTime} – ${endTime}` : (startTime ?? "");
}

export function durationLabel(start: string, end: string) {
  const m = minutesBetween(start, end);
  if (m <= 0) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h}h${String(r).padStart(2, "0")}` : h ? `${h}h` : `${r} min`;
}

export function mapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function categoryOf(categoriesById: Record<string, EventCategory>, id: string): EventCategory {
  return categoriesById[id] ?? { id, name: "Sem categoria", icon: "tag", color: "#64748b", order: 999 };
}

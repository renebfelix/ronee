export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: Frequency;
  /** A cada N dias/semanas/meses/anos (≥ 1). */
  interval: number;
  /** Só para "weekly": dias da semana (0 = domingo … 6 = sábado). */
  weekdays: number[];
  /** Última data possível ("YYYY-MM-DD"), ou null. */
  until: string | null;
  /** Total de ocorrências, ou null. */
  count: number | null;
}

export interface EventCategory {
  id: string;
  name: string;
  /** Chave em `CATEGORY_ICONS` (mesmo catálogo das Tarefas). */
  icon: string;
  color: string;
  order: number;
}

export type EventCategoryInput = Pick<EventCategory, "name" | "icon" | "color">;

export interface CalendarEvent {
  id: string;
  title: string;
  /** HTML do editor; opcional. */
  description: string | null;
  location: string | null;
  category: string;
  allDay: boolean;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "HH:MM" (null quando dia inteiro). */
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  recurrence: RecurrenceRule | null;
  /**
   * Lembretes por push, em minutos antes do início. Em eventos de dia inteiro contam a partir
   * das 09:00 do dia (0 = no dia às 9h, 1440 = na véspera às 9h).
   */
  reminders: number[];
  /** Ocorrências removidas da série (datas de início). */
  exceptions: string[];
  createdAt: number;
  /** Eventos externos (ex.: feriados): só leitura, não ficam no Firestore. */
  readOnly?: boolean;
}

export type EventInput = Omit<CalendarEvent, "id" | "createdAt" | "exceptions">;

/** Uma ocorrência concreta de um evento (eventos recorrentes geram várias). */
export interface Occurrence {
  key: string;
  event: CalendarEvent;
  startDate: string;
  endDate: string;
}

/** Ao editar/excluir um evento recorrente. */
export type EditScope = "this" | "following" | "all";

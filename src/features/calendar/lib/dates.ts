// Datas locais como texto "YYYY-MM-DD" (comparam bem como string e não sofrem com fuso).

export function parseDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today() {
  return toDateString(new Date());
}

export function addDays(date: string, days: number) {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Soma meses sem "pular" o mês quando o dia não existe (31/01 → 28/02). */
export function addMonthsClamped(date: string, months: number) {
  const base = parseDate(date);
  const day = base.getDate();
  const next = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return toDateString(next);
}

/** Dias inteiros de `a` até `b` (b − a). */
export function diffDays(a: string, b: string) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

export function weekday(date: string) {
  return parseDate(date).getDay();
}

/** "YYYY-MM" do mês da data. */
export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function addMonthsYm(ym: string, months: number) {
  return addMonthsClamped(`${ym}-01`, months).slice(0, 7);
}

/** As 6 semanas (domingo a sábado) que cobrem o mês. */
export function monthGrid(ym: string) {
  const first = `${ym}-01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_MIN = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function monthLabel(ym: string) {
  const label = parseDate(`${ym}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function longDateLabel(date: string) {
  const label = parseDate(date).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.slice(0, 4) !== today().slice(0, 4) && { year: "numeric" }),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shortDateLabel(date: string) {
  return parseDate(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(date.slice(0, 4) !== today().slice(0, 4) && { year: "numeric" }),
  });
}

/** Próxima hora cheia ("HH:00") e uma hora depois. */
export function defaultTimes() {
  const h = Math.min(new Date().getHours() + 1, 22);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${pad(h)}:00`, end: `${pad(h + 1)}:00` };
}

export function addMinutesToTime(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function minutesBetween(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

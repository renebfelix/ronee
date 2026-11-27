import type { CalendarEvent, EventCategory } from "./types";

/** Categoria fixa dos feriados (criada automaticamente; não pode ser excluída). */
export const HOLIDAY_CATEGORY: EventCategory = { id: "holidays", name: "Feriados", icon: "flag", color: "#dc2626", order: -1 };

export type HolidayType = "nacional" | "estadual" | "municipal" | "outro";

export interface Holiday {
  date: string;
  name: string;
  type: HolidayType;
}

const TYPE_LABELS: Record<HolidayType, string> = {
  nacional: "Feriado nacional",
  estadual: "Feriado estadual (SP)",
  municipal: "Feriado municipal (São Paulo)",
  outro: "Feriado",
};

type Obj = Record<string, unknown>;

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function toType(value: unknown): HolidayType {
  const t = typeof value === "string" ? value.toLowerCase() : "";
  if (t.startsWith("nac") || t.startsWith("nat")) return "nacional";
  if (t.startsWith("est") || t.startsWith("state")) return "estadual";
  if (t.startsWith("mun") || t.startsWith("city")) return "municipal";
  return "outro";
}

/** Acha a primeira lista de objetos com data dentro da resposta (o formato exato da API pode variar). */
function findList(node: unknown, depth = 0): Obj[] {
  if (depth > 4 || !node) return [];
  if (Array.isArray(node)) {
    if (node.some((x) => x && typeof x === "object" && ("data" in x || "date" in x))) return node as Obj[];
    return node.flatMap((x) => findList(x, depth + 1));
  }
  if (typeof node === "object") {
    const obj = node as Obj;
    for (const key of ["feriados", "holidays", "data", "items", "resultado"]) {
      const found = findList(obj[key], depth + 1);
      if (found.length) return found;
    }
    // Ex.: { nacionais: [...], estaduais: [...], municipais: [...] }
    return Object.values(obj).flatMap((v) => (Array.isArray(v) ? findList(v, depth + 1) : []));
  }
  return [];
}

/** Converte a resposta da APIBrasil em feriados (sem duplicar a mesma data + nome). */
export function parseHolidays(json: unknown): Holiday[] {
  const seen = new Set<string>();
  const out: Holiday[] = [];
  for (const item of findList(json)) {
    const date = toIsoDate(item.data ?? item.date);
    const name = String(item.nome ?? item.name ?? item.feriado ?? item.descricao ?? "").trim();
    if (!date || !name) continue;
    const key = `${date}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Móveis (Carnaval, Páscoa...) vêm com tipo "movel"; a abrangência diz se é nacional, estadual etc.
    const type = toType(item.tipo ?? item.type);
    out.push({ date, name, type: type === "outro" ? toType(item.abrangencia) : type });
  }
  return out.sort(byDate);
}

function byDate(a: Holiday, b: Holiday) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

/**
 * Datas fixas que a APIBrasil não traz (ela não tem feriados municipais): cidade de São Paulo
 * e o Dia da Consciência Negra (nacional desde 2024, Lei 14.759/2023; municipal em SP antes disso).
 * Só entram se a API não trouxer nada na mesma data.
 */
const SAO_PAULO_FIXED: { md: string; name: string; type: HolidayType }[] = [
  { md: "01-25", name: "Aniversário de São Paulo", type: "municipal" },
  { md: "11-20", name: "Dia da Consciência Negra", type: "nacional" },
];

export function withSaoPauloHolidays(year: number, list: Holiday[]): Holiday[] {
  const taken = new Set(list.map((h) => h.date));
  const extra = SAO_PAULO_FIXED.map((h) => ({
    date: `${year}-${h.md}`,
    name: h.name,
    type: h.md === "11-20" && year < 2024 ? ("municipal" as const) : h.type,
  })).filter((h) => !taken.has(h.date));
  return [...list, ...extra].sort(byDate);
}

/** Feriados viram eventos somente leitura de dia inteiro (não ficam salvos no Firestore). */
export function holidayToEvent(h: Holiday): CalendarEvent {
  return {
    id: `holiday-${h.date}-${h.name}`,
    title: h.name,
    description: `<p>${TYPE_LABELS[h.type]}</p>`,
    location: null,
    category: HOLIDAY_CATEGORY.id,
    allDay: true,
    startDate: h.date,
    startTime: null,
    endDate: h.date,
    endTime: null,
    recurrence: null,
    reminders: [],
    exceptions: [],
    createdAt: 0,
    readOnly: true,
  };
}

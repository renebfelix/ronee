import type { PriceType, Product, Variant } from "./types";

export const UNITS = ["unidade", "kg", "pacote", "caixa", "dúzia"];

export const PRICE_TYPES: Record<PriceType, string> = {
  unit: "Unidade",
  wholesale: "Atacado",
};

export const SIZE_UNITS = ["g", "kg", "ml", "L", "un", "m", "cm"];

/** Agrupa os itens avulsos na lista (não é uma categoria real). */
export const TEMP_GROUP = "__temp__";

/** "Marca - tamanho com unidade" (ex.: "Camil - 5 kg"); sem um dos dois, mostra só o que foi informado. */
export const variantLabel = (v: Variant): string => {
  const size = v.size == null ? "" : `${v.size.toLocaleString("pt-BR")} ${v.sizeUnit}`;
  return [v.brand, size].filter(Boolean).join(" - ");
};

export const findVariant = (p: Product, id?: string | null) => (id ? p.variants?.find((v) => v.id === id) : undefined);

/* ---- meses ("YYYY-MM") e datas ("YYYY-MM-DD") ---- */
export const monthKey = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const shiftMonth = (key: string, delta: number): string => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

/** "nov/26" — usado no eixo do gráfico. */
export const monthShortLabel = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

export const todayKey = (d: Date = new Date()): string => `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;

/* ---- busca ---- */

/** Compara sem diferenciar maiúsculas nem acentos ("acucar" acha "Açúcar"). */
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const matches = (query: string, ...fields: (string | undefined)[]) => {
  const q = normalize(query);
  return !q || fields.some((f) => f && normalize(f).includes(q));
};

/** Ordena como um dicionário em português (o Firestore ordena por código do caractere). */
export const sortByName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

export const newVariantId = () => Math.random().toString(36).slice(2, 10);

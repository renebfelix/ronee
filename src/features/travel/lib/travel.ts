import {
  Bed,
  Beer,
  Bus,
  Camera,
  Car,
  Castle,
  Coffee,
  Landmark,
  Mountain,
  Palette,
  Plane,
  ShoppingBag,
  Ticket,
  TrainFront,
  TreePine,
  Utensils,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/features/tasks/lib/tasks";
import { todayStr } from "@/features/finance/lib/finance";
import type { PlaceCategory, Trip } from "./types";

export { CATEGORY_COLORS };

/**
 * Ícones das categorias de lugares: o catálogo das Tarefas mais alguns próprios de viagem.
 * A chave fica salva no Firestore.
 */
export const PLACE_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  beer: Beer,
  landmark: Landmark,
  castle: Castle,
  camera: Camera,
  bed: Bed,
  plane: Plane,
  train: TrainFront,
  bus: Bus,
  car: Car,
  mountain: Mountain,
  beach: Waves,
  park: TreePine,
  museum: Palette,
  ticket: Ticket,
  shopping: ShoppingBag,
  ...CATEGORY_ICONS,
};

/** Categorias criadas na primeira vez que o usuário abre Viagens. */
export const DEFAULT_PLACE_CATEGORIES: PlaceCategory[] = [
  { id: "food", name: "Restaurantes", icon: "utensils", color: "#f97316", order: 0 },
  { id: "sights", name: "Pontos turísticos", icon: "landmark", color: "#2563eb", order: 1 },
  { id: "lodging", name: "Hospedagem", icon: "bed", color: "#8b5cf6", order: 2 },
  { id: "transport", name: "Transporte", icon: "train", color: "#64748b", order: 3 },
  { id: "nature", name: "Natureza", icon: "mountain", color: "#16a34a", order: 4 },
  { id: "shopping", name: "Compras", icon: "shopping", color: "#ec4899", order: 5 },
];

export function placeCategoryOf(byId: Record<string, PlaceCategory>, id: string): PlaceCategory {
  return byId[id] ?? { id, name: "Sem categoria", icon: "pin", color: "#64748b", order: 999 };
}

export type TripPhase = "upcoming" | "ongoing" | "past" | "closed";

/** Situação da viagem hoje. "Aberta" = qualquer uma não encerrada manualmente. */
export function tripPhase(t: Pick<Trip, "startDate" | "endDate" | "closed">, today = todayStr()): TripPhase {
  if (t.closed) return "closed";
  if (today < t.startDate) return "upcoming";
  if (today > t.endDate) return "past";
  return "ongoing";
}

export const PHASE_LABEL: Record<TripPhase, string> = {
  upcoming: "Planejada",
  ongoing: "Em andamento",
  past: "Aguardando encerrar",
  closed: "Encerrada",
};

const fmtDay = (d: string, withYear: boolean) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) });

/** "12 de mar. – 20 de mar. de 2027" (curto, sem repetir o ano). */
export function tripRangeLabel(start: string, end: string) {
  if (start === end) return fmtDay(start, true);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmtDay(start, !sameYear)} – ${fmtDay(end, true)}`;
}

export function tripDays(start: string, end: string) {
  const ms = new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Nome da categoria de despesa criada em Finanças para a viagem. */
export const financeCategoryName = (tripName: string) => `Viagem: ${tripName}`.slice(0, 60);

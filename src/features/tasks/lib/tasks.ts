import {
  Activity,
  ArrowDown,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  Clock,
  Code,
  Coffee,
  DollarSign,
  Film,
  Flag,
  Gift,
  Globe,
  Heart,
  History,
  Home,
  MapPin,
  Minus,
  Music,
  Phone,
  ShoppingCart,
  Smile,
  SortAsc,
  Star,
  Sun,
  Tag,
  TriangleAlert,
  Truck,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Priority, SortKey, Task, TaskCategory } from "./types";

/** Ícones disponíveis para categorias de tarefas (a chave fica salva no Firestore). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  user: User,
  briefcase: Briefcase,
  cart: ShoppingCart,
  heart: Heart,
  book: BookOpen,
  home: Home,
  code: Code,
  coffee: Coffee,
  money: DollarSign,
  gift: Gift,
  music: Music,
  camera: Camera,
  film: Film,
  globe: Globe,
  pin: MapPin,
  phone: Phone,
  star: Star,
  sun: Sun,
  truck: Truck,
  tool: Wrench,
  activity: Activity,
  award: Award,
  smile: Smile,
  tag: Tag,
  flag: Flag,
};

export const CATEGORY_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#dc2626",
  "#f97316",
  "#f59e0b",
  "#16a34a",
  "#14b8a6",
  "#64748b",
];

/** Categorias criadas na primeira vez que o usuário abre o módulo. */
export const DEFAULT_CATEGORIES: TaskCategory[] = [
  { id: "personal", name: "Pessoal", icon: "user", color: "#2563eb", order: 0 },
  { id: "work", name: "Trabalho", icon: "briefcase", color: "#6366f1", order: 1 },
  { id: "shopping", name: "Compras", icon: "cart", color: "#f97316", order: 2 },
  { id: "health", name: "Saúde", icon: "heart", color: "#ec4899", order: 3 },
  { id: "study", name: "Estudos", icon: "book", color: "#14b8a6", order: 4 },
];

export const PRIORITIES: Record<Priority, { label: string; icon: LucideIcon }> = {
  low: { label: "Baixa", icon: ArrowDown },
  medium: { label: "Média", icon: Minus },
  high: { label: "Alta", icon: TriangleAlert },
};

// ───────── Ordenação ─────────

export const SORT_OPTIONS: { key: SortKey; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "due", label: "Prazo", hint: "Data mais próxima, depois prioridade", icon: CalendarDays },
  { key: "priority", label: "Prioridade", hint: "Mais urgente, depois data", icon: Flag },
  { key: "newest", label: "Mais recentes", hint: "Criadas por último primeiro", icon: Clock },
  { key: "oldest", label: "Mais antigas", hint: "Criadas primeiro", icon: History },
  { key: "title", label: "Alfabética", hint: "Título de A a Z", icon: SortAsc },
];

export const DEFAULT_SORT: SortKey = "due";

export function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((o) => o.key === value);
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// Datas no formato AAAA-MM-DD comparam bem como texto; sem prazo vai para o fim.
function byDue(a: Task, b: Task) {
  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

function byPriority(a: Task, b: Task) {
  return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
}

function byNewest(a: Task, b: Task) {
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

const COMPARATORS: Record<SortKey, (a: Task, b: Task) => number> = {
  due: (a, b) => byDue(a, b) || byPriority(a, b) || byNewest(a, b),
  priority: (a, b) => byPriority(a, b) || byDue(a, b) || byNewest(a, b),
  newest: byNewest,
  oldest: (a, b) => -byNewest(a, b),
  title: (a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }) || byNewest(a, b),
};

export function sortTasks(tasks: Task[], key: SortKey) {
  return [...tasks].sort(COMPARATORS[key]);
}

// ───────── Formatação ─────────

export function formatDue(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const label =
    diff === 0
      ? "Hoje"
      : diff === 1
        ? "Amanhã"
        : due.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            ...(due.getFullYear() !== today.getFullYear() && { year: "numeric" }),
          });
  return { label, overdue: diff < 0 };
}

export function normalize(s: string) {
  return s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

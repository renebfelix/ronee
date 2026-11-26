import {
  Apple,
  ArrowLeftRight,
  Bell,
  BellRing,
  Boxes,
  CalendarDays,
  CreditCard,
  Dumbbell,
  HeartPulse,
  History,
  House,
  KeyRound,
  Landmark,
  LayoutDashboard,
  NotebookPen,
  Package,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  Tag,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AccentColor = "primary" | "success" | "warning" | "danger" | "info";

export interface NavSubItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  accent: AccentColor;
  /** Módulo ainda não implementado: aparece desabilitado com selo "Em breve". */
  comingSoon?: boolean;
  /**
   * Páginas internas do módulo. A primeira é a página principal (aberta ao clicar no módulo).
   * O submenu fica expandido enquanto a rota atual estiver dentro de `href`.
   */
  children?: NavSubItem[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Todos os módulos da plataforma, na ordem em que aparecem.
 * Para ativar um módulo: crie a rota em src/app/(app)/<rota> e remova `comingSoon` — ele sobe sozinho
 * da seção "Em breve" para a lista principal.
 */
const MODULES: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, accent: "primary" },
  {
    id: "finance",
    label: "Finanças",
    href: "/financas",
    icon: Wallet,
    accent: "success",
    children: [
      { id: "finance-transactions", label: "Lançamentos", href: "/financas/lancamentos", icon: ArrowLeftRight },
      { id: "finance-categories", label: "Categorias", href: "/financas/categorias", icon: Tags },
      { id: "finance-owners", label: "Responsáveis", href: "/financas/responsaveis", icon: Users },
      { id: "finance-cards", label: "Cartões", href: "/financas/cartoes", icon: CreditCard },
      { id: "finance-banks", label: "Bancos", href: "/financas/bancos", icon: Landmark },
    ],
  },
  { id: "chores", label: "Tarefas de casa", href: "/tarefas", icon: House, accent: "warning", comingSoon: true },
  { id: "calendar", label: "Agenda", href: "/agenda", icon: CalendarDays, accent: "info", comingSoon: true },
  { id: "notes", label: "Notas", href: "/notas", icon: NotebookPen, accent: "warning" },
  { id: "reminders", label: "Lembretes", href: "/lembretes", icon: BellRing, accent: "danger", comingSoon: true },
  {
    id: "passwords",
    label: "Senhas",
    href: "/senhas",
    icon: KeyRound,
    accent: "primary",
    children: [
      { id: "passwords-list", label: "Senhas", href: "/senhas/lista", icon: KeyRound },
      { id: "passwords-tags", label: "Tags", href: "/senhas/tags", icon: Tag },
    ],
  },
  { id: "inventory", label: "Estoque", href: "/estoque", icon: Package, accent: "warning", comingSoon: true },
  {
    id: "shopping",
    label: "Listas de compras",
    href: "/compras",
    icon: ShoppingCart,
    accent: "info",
    children: [
      { id: "shopping-list", label: "Lista do mês", href: "/compras/lista", icon: ShoppingBasket },
      { id: "shopping-products", label: "Produtos", href: "/compras/produtos", icon: Boxes },
      { id: "shopping-categories", label: "Categorias", href: "/compras/categorias", icon: Tags },
      { id: "shopping-history", label: "Histórico", href: "/compras/historico", icon: History },
    ],
  },
  { id: "workouts", label: "Treinos", href: "/treinos", icon: Dumbbell, accent: "primary", comingSoon: true },
  { id: "nutrition", label: "Alimentação", href: "/alimentacao", icon: Apple, accent: "success", comingSoon: true },
  { id: "health", label: "Sono e saúde", href: "/saude", icon: HeartPulse, accent: "danger", comingSoon: true },
  { id: "notifications", label: "Alertas", href: "/alertas", icon: Bell, accent: "warning", comingSoon: true },
  { id: "settings", label: "Configurações", href: "/configuracoes", icon: Settings, accent: "primary", comingSoon: true },
];

/** Fonte única da navegação: módulos disponíveis primeiro, depois os que ainda estão por vir. */
export const NAVIGATION: NavSection[] = [
  { items: MODULES.filter((m) => !m.comingSoon) },
  { title: "Em breve", items: MODULES.filter((m) => m.comingSoon) },
];

/** A rota atual é `href` ou uma subpágina dele. */
export function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Destino ao clicar no item: a página principal do submenu, se houver. */
export function getNavItemTarget(item: NavItem) {
  return item.children?.[0]?.href ?? item.href;
}

/** Localiza um subitem pelo id (para reaproveitar rótulo e ícone nas páginas). */
export function getNavSubItem(id: string): NavSubItem {
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      const found = item.children?.find((child) => child.id === id);
      if (found) return found;
    }
  }
  throw new Error(`Subitem de navegação não encontrado: ${id}`);
}

export const ROUTES = {
  login: "/login",
  home: "/dashboard",
} as const;

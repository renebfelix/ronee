import {
  Apple,
  Bell,
  BellRing,
  CalendarDays,
  Dumbbell,
  HeartPulse,
  House,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AccentColor = "primary" | "success" | "warning" | "danger" | "info";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  accent: AccentColor;
  /** Módulo ainda não implementado: aparece desabilitado com selo "Em breve". */
  comingSoon?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Fonte única da navegação da plataforma.
 * Para ativar um módulo: crie a rota em src/app/(app)/<rota> e remova `comingSoon`.
 */
export const NAVIGATION: NavSection[] = [
  {
    items: [{ id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, accent: "primary" }],
  },
  {
    title: "Organização",
    items: [
      { id: "finance", label: "Finanças", href: "/financas", icon: Wallet, accent: "success", comingSoon: true },
      { id: "chores", label: "Tarefas de casa", href: "/tarefas", icon: House, accent: "warning", comingSoon: true },
      { id: "calendar", label: "Agenda", href: "/agenda", icon: CalendarDays, accent: "info", comingSoon: true },
      { id: "reminders", label: "Lembretes", href: "/lembretes", icon: BellRing, accent: "danger", comingSoon: true },
    ],
  },
  {
    title: "Casa",
    items: [
      { id: "inventory", label: "Estoque", href: "/estoque", icon: Package, accent: "warning", comingSoon: true },
      { id: "shopping", label: "Listas de compras", href: "/compras", icon: ShoppingCart, accent: "info", comingSoon: true },
    ],
  },
  {
    title: "Saúde",
    items: [
      { id: "workouts", label: "Treinos", href: "/treinos", icon: Dumbbell, accent: "primary", comingSoon: true },
      { id: "nutrition", label: "Alimentação", href: "/alimentacao", icon: Apple, accent: "success", comingSoon: true },
      { id: "health", label: "Sono e saúde", href: "/saude", icon: HeartPulse, accent: "danger", comingSoon: true },
    ],
  },
  {
    title: "Sistema",
    items: [
      { id: "notifications", label: "Alertas", href: "/alertas", icon: Bell, accent: "warning", comingSoon: true },
      { id: "settings", label: "Configurações", href: "/configuracoes", icon: Settings, accent: "primary", comingSoon: true },
    ],
  },
];

export const ROUTES = {
  login: "/login",
  home: "/dashboard",
} as const;

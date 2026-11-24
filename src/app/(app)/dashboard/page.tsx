import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

// Conteúdo protegido só renderiza no cliente, após o Firebase confirmar a sessão.
// Toda página dentro de (app) precisa desta linha (ver README → Novo módulo).
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}

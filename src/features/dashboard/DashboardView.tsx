"use client";

import { LayoutDashboard, Rocket } from "lucide-react";
import { useAuth } from "@/components/providers";
import { PageHeader } from "@/components/layout";
import { EmptyState } from "@/components/ui";
import { useGreeting } from "@/hooks/useGreeting";

export function DashboardView() {
  const { user } = useAuth();
  const greeting = useGreeting();
  const firstName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0];

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={firstName ? `${greeting}, ${firstName}!` : `${greeting}!`}
        description="Aqui você terá uma visão geral de toda a sua vida em um só lugar."
      />
      <EmptyState
        icon={Rocket}
        title="Seu dashboard está pronto para crescer"
        description="Os módulos de finanças, casa, agenda, treinos, alimentação e saúde aparecerão aqui conforme forem sendo ativados."
      />
    </>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/config/navigation";
import { useAuth } from "@/components/providers";
import { FullScreenLoader } from "@/components/layout";

interface AuthGuardProps {
  children: ReactNode;
  /**
   * "private": exige usuário logado (senão vai para o login).
   * "guest": só para visitantes (logado vai para o dashboard).
   */
  mode: "private" | "guest";
}

export function AuthGuard({ children, mode }: AuthGuardProps) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();
  const allowed = mode === "private" ? Boolean(user) : !user;

  useEffect(() => {
    if (loading || allowed) return;
    router.replace(mode === "private" ? ROUTES.login : ROUTES.home);
  }, [loading, allowed, mode, router]);

  if (mode === "guest") {
    // Páginas públicas renderizam já no servidor (shell estático para navegação instantânea).
    // Só trocamos pelo loader quando há sessão ativa e o redirecionamento está a caminho.
    if (configured && user) return <FullScreenLoader />;
    return <>{children}</>;
  }

  if (loading || !allowed) return <FullScreenLoader />;
  return <>{children}</>;
}

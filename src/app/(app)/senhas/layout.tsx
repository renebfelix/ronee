import type { ReactNode } from "react";
import { VaultProvider } from "@/features/passwords";

export const instant = false;

/** Todas as páginas de Senhas ficam atrás da senha de segurança do cofre (sessão de 5 minutos). */
export default function PasswordsLayout({ children }: { children: ReactNode }) {
  return <VaultProvider>{children}</VaultProvider>;
}

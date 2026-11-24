import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth";

/** Layout das rotas públicas (login). Usuários logados são enviados ao dashboard. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return <AuthGuard mode="guest">{children}</AuthGuard>;
}

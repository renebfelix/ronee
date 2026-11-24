import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth";
import { AppShell } from "@/components/layout";

// A sessão do Firebase só existe no cliente, então estas rotas não têm shell estático
// para navegação instantânea. Desliga a validação de "instant navigation" do Next.
export const instant = false;

/** Layout de todas as rotas autenticadas. Novos módulos entram em src/app/(app)/<rota>. */
export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard mode="private">
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

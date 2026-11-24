import type { ReactNode } from "react";
import { FinanceDataProvider } from "@/features/finance";

export const instant = false;

/** Todas as páginas de Finanças compartilham os mesmos dados em tempo real do Firestore. */
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <FinanceDataProvider>{children}</FinanceDataProvider>;
}

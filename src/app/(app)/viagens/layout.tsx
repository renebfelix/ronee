import type { ReactNode } from "react";
import { FinanceDataProvider } from "@/features/finance";
import { TravelDataProvider } from "@/features/travel";

export const instant = false;

/**
 * Viagens usa os dados de Finanças (responsáveis como companhias, categoria e lançamentos de cada
 * viagem), então as páginas ficam dentro dos dois providers, com Finanças por fora.
 */
export default function TravelLayout({ children }: { children: ReactNode }) {
  return (
    <FinanceDataProvider>
      <TravelDataProvider>{children}</TravelDataProvider>
    </FinanceDataProvider>
  );
}

import type { ReactNode } from "react";
import { ShoppingDataProvider } from "@/features/shopping";

export const instant = false;

/** Todas as páginas da Lista de compras compartilham os mesmos dados em tempo real do Firestore. */
export default function ShoppingLayout({ children }: { children: ReactNode }) {
  return <ShoppingDataProvider>{children}</ShoppingDataProvider>;
}

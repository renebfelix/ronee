import type { Metadata } from "next";
import { HistoryView } from "@/features/shopping";

export const metadata: Metadata = { title: "Histórico de compras" };

export const instant = false;

export default function ShoppingHistoryPage() {
  return <HistoryView />;
}

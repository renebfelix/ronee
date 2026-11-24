import type { Metadata } from "next";
import { TransactionsView } from "@/features/finance";

export const metadata: Metadata = { title: "Lançamentos" };

export const instant = false;

export default function TransactionsPage() {
  return <TransactionsView />;
}

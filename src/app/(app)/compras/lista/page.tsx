import type { Metadata } from "next";
import { ShoppingListView } from "@/features/shopping";

export const metadata: Metadata = { title: "Lista de compras" };

export const instant = false;

export default function ShoppingListPage() {
  return <ShoppingListView />;
}

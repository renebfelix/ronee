import type { Metadata } from "next";
import { ShoppingCategoriesView } from "@/features/shopping";

export const metadata: Metadata = { title: "Categorias de compras" };

export const instant = false;

export default function ShoppingCategoriesPage() {
  return <ShoppingCategoriesView />;
}

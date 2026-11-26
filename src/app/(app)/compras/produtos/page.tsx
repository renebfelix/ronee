import type { Metadata } from "next";
import { ProductsView } from "@/features/shopping";

export const metadata: Metadata = { title: "Produtos" };

export const instant = false;

export default function ShoppingProductsPage() {
  return <ProductsView />;
}

import type { Metadata } from "next";
import { ProductDetailView } from "@/features/shopping";

export const metadata: Metadata = { title: "Produto" };

export const instant = false;

/** O id vem da URL dentro do próprio componente (dados só existem no cliente). */
export default function ShoppingProductPage() {
  return <ProductDetailView />;
}

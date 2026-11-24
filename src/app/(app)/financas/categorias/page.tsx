import type { Metadata } from "next";
import { CategoriesView } from "@/features/finance";

export const metadata: Metadata = { title: "Categorias" };

export const instant = false;

export default function CategoriesPage() {
  return <CategoriesView />;
}

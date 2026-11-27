import type { Metadata } from "next";
import { TravelCategoriesView } from "@/features/travel";

export const metadata: Metadata = { title: "Categorias de lugares" };

export const instant = false;

export default function TravelCategoriesPage() {
  return <TravelCategoriesView />;
}

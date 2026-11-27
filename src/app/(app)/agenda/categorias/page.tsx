import type { Metadata } from "next";
import { CalendarCategoriesView } from "@/features/calendar";

export const metadata: Metadata = { title: "Categorias da agenda" };

export const instant = false;

export default function CalendarCategoriesPage() {
  return <CalendarCategoriesView />;
}

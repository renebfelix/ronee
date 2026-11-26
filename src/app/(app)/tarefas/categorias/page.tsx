import type { Metadata } from "next";
import { TaskCategoriesView } from "@/features/tasks";

export const metadata: Metadata = { title: "Categorias de tarefas" };

export const instant = false;

export default function TaskCategoriesPage() {
  return <TaskCategoriesView />;
}

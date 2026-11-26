import type { Metadata } from "next";
import { TasksView } from "@/features/tasks";

export const metadata: Metadata = { title: "Tarefas" };

export const instant = false;

export default function TasksListPage() {
  return <TasksView />;
}

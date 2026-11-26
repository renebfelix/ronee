import type { ReactNode } from "react";
import { TasksDataProvider } from "@/features/tasks";

export const instant = false;

/** Todas as páginas de Tarefas compartilham os mesmos dados em tempo real do Firestore. */
export default function TasksLayout({ children }: { children: ReactNode }) {
  return <TasksDataProvider>{children}</TasksDataProvider>;
}

import { redirect } from "next/navigation";

// "/tarefas" abre a página principal do módulo.
export default function TasksPage() {
  redirect("/tarefas/lista");
}

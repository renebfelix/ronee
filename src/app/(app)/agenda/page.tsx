import { redirect } from "next/navigation";

// "/agenda" abre a página principal do módulo.
export default function CalendarPage() {
  redirect("/agenda/calendario");
}

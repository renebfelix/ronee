import { redirect } from "next/navigation";

// "/financas" abre a página principal do módulo.
export default function FinancePage() {
  redirect("/financas/lancamentos");
}

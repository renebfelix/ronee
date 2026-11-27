import { redirect } from "next/navigation";

// "/viagens" abre a página principal do módulo.
export default function TravelPage() {
  redirect("/viagens/lista");
}

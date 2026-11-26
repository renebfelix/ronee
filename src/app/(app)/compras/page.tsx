import { redirect } from "next/navigation";

// "/compras" abre a página principal do módulo.
export default function ShoppingPage() {
  redirect("/compras/lista");
}

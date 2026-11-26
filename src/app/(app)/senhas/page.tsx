import { redirect } from "next/navigation";

// "/senhas" abre a página principal do módulo.
export default function PasswordsPage() {
  redirect("/senhas/lista");
}

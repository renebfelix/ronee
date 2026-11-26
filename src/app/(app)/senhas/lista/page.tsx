import type { Metadata } from "next";
import { PasswordsView } from "@/features/passwords";

export const metadata: Metadata = { title: "Senhas" };

export const instant = false;

export default function PasswordsListPage() {
  return <PasswordsView />;
}

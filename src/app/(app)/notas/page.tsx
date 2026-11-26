import type { Metadata } from "next";
import { NotesView } from "@/features/notes";

export const metadata: Metadata = { title: "Notas" };

export const instant = false;

export default function NotesPage() {
  return <NotesView />;
}

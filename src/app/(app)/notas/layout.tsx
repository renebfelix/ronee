import type { ReactNode } from "react";
import { NotesDataProvider } from "@/features/notes";

export const instant = false;

/** Pastas e notas em tempo real do Firestore. */
export default function NotesLayout({ children }: { children: ReactNode }) {
  return <NotesDataProvider>{children}</NotesDataProvider>;
}

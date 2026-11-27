import type { ReactNode } from "react";
import { CalendarDataProvider } from "@/features/calendar";

export const instant = false;

/** Todas as páginas da Agenda compartilham os mesmos dados em tempo real do Firestore. */
export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <CalendarDataProvider>{children}</CalendarDataProvider>;
}

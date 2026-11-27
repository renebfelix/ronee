import type { Metadata } from "next";
import { CalendarView } from "@/features/calendar";

export const metadata: Metadata = { title: "Agenda" };

export const instant = false;

export default function CalendarMonthPage() {
  return <CalendarView />;
}

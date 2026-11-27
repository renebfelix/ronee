import type { Metadata } from "next";
import { TripDetailView } from "@/features/travel";

export const metadata: Metadata = { title: "Viagem" };

export const instant = false;

/** O id vem da URL dentro do próprio componente (dados só existem no cliente). */
export default function TripPage() {
  return <TripDetailView />;
}

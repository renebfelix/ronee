import type { Metadata } from "next";
import { TripsView } from "@/features/travel";

export const metadata: Metadata = { title: "Viagens" };

export const instant = false;

export default function TripsPage() {
  return <TripsView />;
}

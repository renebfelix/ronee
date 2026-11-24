import type { Metadata } from "next";
import { CardsView } from "@/features/finance";

export const metadata: Metadata = { title: "Cartões" };

export const instant = false;

export default function CardsPage() {
  return <CardsView />;
}

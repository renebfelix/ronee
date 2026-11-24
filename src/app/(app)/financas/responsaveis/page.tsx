import type { Metadata } from "next";
import { ResponsiblesView } from "@/features/finance";

export const metadata: Metadata = { title: "Responsáveis" };

export const instant = false;

export default function OwnersPage() {
  return <ResponsiblesView />;
}

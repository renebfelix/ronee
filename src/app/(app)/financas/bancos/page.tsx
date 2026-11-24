import type { Metadata } from "next";
import { BanksView } from "@/features/finance";

export const metadata: Metadata = { title: "Bancos" };

export const instant = false;

export default function BanksPage() {
  return <BanksView />;
}

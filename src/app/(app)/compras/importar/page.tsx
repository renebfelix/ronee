import type { Metadata } from "next";
import { ImportView } from "@/features/shopping";

export const metadata: Metadata = { title: "Importar do Store Leest" };

export const instant = false;

export default function ShoppingImportPage() {
  return <ImportView />;
}

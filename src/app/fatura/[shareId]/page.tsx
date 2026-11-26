import type { Metadata } from "next";
import { Suspense } from "react";
import { FullScreenLoader } from "@/components/layout";
import { Statement } from "@/features/finance/share/Statement";

export const metadata: Metadata = {
  title: "Fatura",
  robots: { index: false, follow: false },
};

// Página pública: a sessão (opcional) e os dados só existem no cliente.
export const instant = false;

export default function FaturaPage() {
  return (
    <Suspense fallback={<FullScreenLoader label="Carregando fatura" />}>
      <Statement />
    </Suspense>
  );
}

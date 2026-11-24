"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "../Sidebar";
import { Topbar } from "../Topbar";
import styles from "./AppShell.module.scss";

/** Estrutura padrão das telas autenticadas: sidebar + topbar + conteúdo. */
export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer ao trocar de rota e com a tecla Esc.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={styles.main}>
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

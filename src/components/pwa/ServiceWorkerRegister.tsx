"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (public/sw.js) apenas em produção.
 * Em desenvolvimento remove registros antigos para não servir arquivos em cache
 * (menos o "/sw.js?dev", que só cuida das notificações de Tarefas).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.filter((r) => !r.active?.scriptURL.includes("?dev")).forEach((r) => r.unregister()));
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        console.error("Falha ao registrar o service worker:", err);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

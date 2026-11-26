"use client";

import { useEffect, useState } from "react";
import { Lock, Timer } from "lucide-react";
import { Button } from "@/components/ui";
import { useVault } from "../data/VaultProvider";
import styles from "./PasswordsView.module.scss";

/** Tempo restante da sessão do cofre e botão para bloquear na hora. */
export function VaultTimer() {
  const { expiresAt, lock } = useVault();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <>
      <span className={styles.timer} title="O cofre bloqueia automaticamente ao fim da sessão">
        <Timer size={16} aria-hidden />
        <span>
          Bloqueia em <strong>{`${mm}:${ss}`}</strong>
        </span>
      </span>
      <Button variant="outline" icon={Lock} onClick={lock}>
        Bloquear
      </Button>
    </>
  );
}

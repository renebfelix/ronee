"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Clock, Send } from "lucide-react";
import { Alert, Button, Modal, Spinner } from "@/components/ui";
import { ui } from "@/features/finance/components/kit";
import { cn } from "@/lib/utils/cn";
import { DEFAULT_HOUR, disablePush, enablePush, isPushSupported, showTestNotification, type PushSettings } from "../lib/notifications";
import styles from "./Tasks.module.scss";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface Props {
  uid: string;
  settings: PushSettings | null;
  onChange: (settings: PushSettings | null) => void;
  onClose: () => void;
}

/** Ativa/desativa o resumo diário por push (tarefas de hoje e atrasadas) neste aparelho. */
export function NotificationSettings({ uid, settings, onChange, onClose }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );
  const [hour, setHour] = useState(settings?.hour ?? DEFAULT_HOUR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isPushSupported().then(setSupported);
  }, []);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if ("Notification" in window) setPermission(Notification.permission);
      setError((e as Error).message === "permission-denied" ? null : message);
    } finally {
      if ("Notification" in window) setPermission(Notification.permission);
      setBusy(false);
    }
  }

  const enable = (h = hour) => run(async () => onChange(await enablePush(uid, h)), "Não foi possível ativar as notificações.");

  const disable = () =>
    run(async () => {
      if (settings) await disablePush(uid, settings);
      onChange(null);
    }, "Não foi possível desativar as notificações.");

  function changeHour(h: number) {
    setHour(h);
    // Com o push ativo, já salva o novo horário no aparelho.
    if (settings) enable(h);
  }

  const active = Boolean(settings) && permission === "granted";
  const ready = supported && permission !== "denied";

  return (
    <Modal
      open
      onClose={onClose}
      title="Resumo diário"
      footer={
        ready ? (
          active ? (
            <>
              <Button variant="ghost" icon={Send} onClick={() => void showTestNotification()} disabled={busy}>
                Testar
              </Button>
              <Button variant="outline" icon={BellOff} onClick={disable} loading={busy}>
                Desativar
              </Button>
            </>
          ) : (
            <Button icon={Bell} onClick={() => enable()} loading={busy}>
              Ativar notificações
            </Button>
          )
        ) : undefined
      }
    >
      <div className={ui.stack}>
        <p className={styles.muted}>
          Receba no celular, uma vez por dia, um resumo das tarefas com prazo para hoje e das atrasadas.
        </p>

        {supported === null ? (
          <div className={styles.pushStatus}>
            <Spinner size="sm" /> Verificando o aparelho...
          </div>
        ) : !supported ? (
          <Alert tone="warning">
            Este navegador não recebe notificações push (ou a chave VAPID não está configurada). No iPhone, adicione o
            Ronee à tela de início e abra por lá.
          </Alert>
        ) : permission === "denied" ? (
          <Alert tone="warning">As notificações estão bloqueadas. Libere nas configurações do site (ou do app) e tente de novo.</Alert>
        ) : (
          <>
            <div className={cn(styles.pushStatus, active && styles.pushStatusOn)}>
              {active ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
              <span>{active ? "Ativadas neste aparelho" : "Desativadas neste aparelho"}</span>
            </div>

            <label className={styles.pushHour}>
              <Clock size={18} aria-hidden />
              <span>Horário do resumo</span>
              <select
                className={ui.select}
                value={hour}
                disabled={busy}
                onChange={(e) => changeHour(Number(e.target.value))}
                aria-label="Horário do resumo"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>

            {error && <Alert tone="danger">{error}</Alert>}
          </>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Alert, Button, Modal, Spinner } from "@/components/ui";
import { ui } from "@/features/finance/components/kit";
import { isPushSupported, showTestNotification } from "@/features/tasks/lib/notifications";
import { cn } from "@/lib/utils/cn";
import { disableCalendarPush, enableCalendarPush, type CalendarPush } from "../lib/notifications";
import styles from "./Calendar.module.scss";

interface Props {
  uid: string;
  settings: CalendarPush | null;
  onChange: (settings: CalendarPush | null) => void;
  onClose: () => void;
}

/** Liga/desliga neste aparelho os lembretes dos eventos (cada evento define quando avisar). */
export function CalendarNotifications({ uid, settings, onChange, onClose }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  );
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
      setError((e as Error).message === "permission-denied" ? null : message);
    } finally {
      if ("Notification" in window) setPermission(Notification.permission);
      setBusy(false);
    }
  }

  const enable = () => run(async () => onChange(await enableCalendarPush(uid)), "Não foi possível ativar as notificações.");
  const disable = () =>
    run(async () => {
      if (settings) await disableCalendarPush(uid, settings);
      onChange(null);
    }, "Não foi possível desativar as notificações.");
  const test = () =>
    void showTestNotification("Ronee — Agenda", "Tudo certo! Os lembretes dos seus eventos vão chegar aqui.");

  const active = Boolean(settings) && permission === "granted";
  const ready = supported && permission !== "denied";

  return (
    <Modal
      open
      onClose={onClose}
      title="Notificações da agenda"
      footer={
        ready ? (
          active ? (
            <>
              <Button variant="ghost" icon={Send} onClick={test} disabled={busy}>
                Testar
              </Button>
              <Button variant="outline" icon={BellOff} onClick={disable} loading={busy}>
                Desativar
              </Button>
            </>
          ) : (
            <Button icon={Bell} onClick={enable} loading={busy}>
              Ativar notificações
            </Button>
          )
        ) : undefined
      }
    >
      <div className={ui.stack}>
        <p className={styles.muted}>
          Receba um aviso no aparelho antes de cada evento. Os horários são escolhidos em cada evento, no campo{" "}
          <strong>Lembretes</strong> (ex.: 10 minutos antes, na véspera às 9h).
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
            {error && <Alert tone="danger">{error}</Alert>}
          </>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Alert, Button, Card, Input } from "@/components/ui";
import styles from "./LockScreen.module.scss";

const MIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

type Props =
  | { mode: "unlock"; onUnlock: (password: string) => Promise<boolean> }
  | { mode: "create"; onCreate: (password: string) => Promise<void> };

/** Tela de bloqueio do cofre: cria a senha de segurança no primeiro acesso ou pede para desbloquear. */
export function LockScreen(props: Props) {
  const creating = props.mode === "create";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (blockedUntil <= now) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [blockedUntil, now]);

  const waitSec = Math.ceil(Math.max(0, blockedUntil - now) / 1000);

  const submit = async () => {
    setError("");
    if (waitSec > 0) return;
    if (creating) {
      if (password.length < MIN_LENGTH) return setError(`Use pelo menos ${MIN_LENGTH} caracteres.`);
      if (password !== confirm) return setError("As senhas não conferem.");
    } else if (!password) {
      return setError("Digite a senha de segurança.");
    }
    setBusy(true);
    try {
      if (props.mode === "create") {
        await props.onCreate(password);
      } else if (!(await props.onUnlock(password))) {
        const n = fails + 1;
        setFails(n);
        setPassword("");
        if (n >= MAX_ATTEMPTS) {
          setFails(0);
          setBlockedUntil(Date.now() + COOLDOWN_MS);
          setNow(Date.now());
          setError("Muitas tentativas. Aguarde para tentar de novo.");
        } else {
          setError("Senha de segurança incorreta.");
        }
      }
    } catch {
      setError("Não foi possível continuar. Verifique sua conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <Card className={styles.card}>
        <span className={styles.icon}>{creating ? <ShieldCheck size={28} aria-hidden /> : <LockKeyhole size={28} aria-hidden />}</span>
        <h1 className={styles.title}>{creating ? "Crie a senha do cofre" : "Cofre bloqueado"}</h1>
        <p className={styles.text}>
          {creating
            ? "Essa senha protege suas senhas salvas e é diferente da senha de login. Ela será pedida a cada 5 minutos."
            : "Digite a senha de segurança para ver suas senhas. O acesso dura 5 minutos."}
        </p>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            type="password"
            label="Senha de segurança"
            icon={KeyRound}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={creating ? "new-password" : "current-password"}
            autoFocus
          />
          {creating && (
            <Input
              type="password"
              label="Confirme a senha"
              icon={KeyRound}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          )}
          {error && <Alert tone="danger">{waitSec > 0 ? `${error} (${waitSec}s)` : error}</Alert>}
          {creating && (
            <p className={styles.note}>Guarde bem essa senha: não há como recuperá-la pelo app.</p>
          )}
          <Button type="submit" fullWidth loading={busy} disabled={waitSec > 0}>
            {creating ? "Criar e abrir o cofre" : "Desbloquear"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

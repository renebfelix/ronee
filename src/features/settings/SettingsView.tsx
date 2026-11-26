"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, KeyRound, Lock, Mail, Settings, ShieldCheck } from "lucide-react";
import type { User } from "firebase/auth";
import { useAuth } from "@/components/providers";
import { PageHeader } from "@/components/layout";
import { Alert, Badge, Button, Card, CardHeader, Input } from "@/components/ui";
import {
  changeAccountPassword,
  createAccountPassword,
  getAuthErrorMessage,
  hasGoogleProvider,
  hasPasswordProvider,
} from "@/lib/firebase";
import { GoogleIcon } from "@/features/auth/GoogleIcon";
import styles from "./SettingsView.module.scss";

const MIN_LENGTH = 6;

export function SettingsView() {
  const { user } = useAuth();
  // O objeto `user` do Firebase é mutado ao vincular a senha; este contador força a nova renderização.
  const [, setVersion] = useState(0);

  if (!user) return null;

  return (
    <>
      <PageHeader icon={Settings} title="Configurações" description="Gerencie sua conta e as formas de acesso." />
      <div className={styles.grid}>
        <SignInMethodsCard user={user} />
        <PasswordCard user={user} onChanged={() => setVersion((v) => v + 1)} />
      </div>
    </>
  );
}

function SignInMethodsCard({ user }: { user: User }) {
  const google = hasGoogleProvider(user);
  const password = hasPasswordProvider(user);

  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="Formas de acesso" subtitle="Como você pode entrar na sua conta." />
      <ul className={styles.methods}>
        <li className={styles.method}>
          <span className={styles.methodIcon}>
            <GoogleIcon />
          </span>
          <div className={styles.methodText}>
            <strong>Google</strong>
            <span>{user.email}</span>
          </div>
          <Badge tone={google ? "success" : "neutral"}>{google ? "Ativo" : "Não vinculado"}</Badge>
        </li>
        <li className={styles.method}>
          <span className={styles.methodIcon}>
            <Mail size={18} aria-hidden />
          </span>
          <div className={styles.methodText}>
            <strong>E-mail e senha</strong>
            <span>{user.email}</span>
          </div>
          <Badge tone={password ? "success" : "neutral"}>{password ? "Ativo" : "Sem senha"}</Badge>
        </li>
      </ul>
    </Card>
  );
}

function PasswordCard({ user, onChanged }: { user: User; onChanged: () => void }) {
  const hasPassword = hasPasswordProvider(user);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < MIN_LENGTH) return setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
    if (password !== confirm) return setError("As senhas não conferem.");

    setLoading(true);
    try {
      if (hasPassword) {
        await changeAccountPassword(user, current, password);
        setNotice("Senha alterada com sucesso.");
      } else {
        await createAccountPassword(user, password);
        setNotice(`Senha criada! Agora você também pode entrar com ${user.email} e esta senha.`);
        onChanged();
      }
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={KeyRound}
        title={hasPassword ? "Alterar senha" : "Criar senha"}
        subtitle={
          hasPassword
            ? "Troque a senha usada para entrar com e-mail."
            : "Crie uma senha para acessar esta mesma conta também por e-mail e senha."
        }
      />
      <form className={styles.form} onSubmit={handleSubmit}>
        <Input label="E-mail da conta" type="email" icon={Mail} value={user.email ?? ""} readOnly disabled />
        {hasPassword && (
          <Input
            label="Senha atual"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        )}
        <Input
          label={hasPassword ? "Nova senha" : "Senha"}
          type="password"
          icon={Lock}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          hint={`Mínimo de ${MIN_LENGTH} caracteres.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmar senha"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {!hasPassword && (
          <p className={styles.note}>
            O e-mail é sempre o mesmo da sua conta Google. Se o Firebase pedir, confirme sua identidade na janela do
            Google.
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className={styles.actions}>
          <Button type="submit" icon={hasPassword ? KeyRound : CircleCheck} loading={loading} disabled={loading}>
            {hasPassword ? "Alterar senha" : "Criar senha"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

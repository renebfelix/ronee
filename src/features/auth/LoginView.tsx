"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Lock, Mail, User, UserPlus } from "lucide-react";
import { NAVIGATION } from "@/config/navigation";
import { useAuth } from "@/components/providers";
import { Alert, Button, Input, Logo } from "@/components/ui";
import { getAuthErrorMessage, resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase";
import { cn } from "@/lib/utils/cn";
import { GoogleIcon } from "./GoogleIcon";
import styles from "./LoginView.module.scss";

type Mode = "login" | "register" | "reset";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  login: { title: "Bem-vindo de volta", subtitle: "Entre para continuar organizando sua vida.", submit: "Entrar" },
  register: { title: "Crie sua conta", subtitle: "Comece a organizar tudo em um só lugar.", submit: "Criar conta" },
  reset: { title: "Recuperar senha", subtitle: "Enviaremos um link de redefinição para seu e-mail.", submit: "Enviar link" },
};

const SHOWCASE = NAVIGATION.flatMap((s) => s.items).filter((i) => i.comingSoon && i.id !== "settings");

export function LoginView() {
  const { configured } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = COPY[mode];

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading("form");
    try {
      if (mode === "login") await signInWithEmail(email, password);
      else if (mode === "register") await signUpWithEmail(name.trim(), email, password);
      else {
        await resetPassword(email);
        setNotice("Se houver uma conta com este e-mail, você receberá um link em instantes.");
      }
      // Após login/cadastro, o AuthGuard redireciona para o dashboard.
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-hidden>
        <Logo size="lg" className={styles.heroLogo} />
        <div className={styles.heroBody}>
          <h2 className={styles.heroTitle}>Sua vida inteira, organizada em um só lugar.</h2>
          <p className={styles.heroText}>
            Finanças, casa, agenda, compras, treinos, alimentação e saúde — tudo conectado e com alertas no momento
            certo.
          </p>
          <ul className={styles.showcase}>
            {SHOWCASE.map(({ id, label, icon: Icon }) => (
              <li key={id} className={styles.showcaseItem}>
                <span className={styles.showcaseIcon}>
                  <Icon size={20} />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.card}>
          <Logo className={styles.mobileLogo} />

          <header className={styles.header}>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.subtitle}>{copy.subtitle}</p>
          </header>

          {!configured && (
            <Alert tone="warning" title="Firebase não configurado">
              Copie <code>.env.example</code> para <code>.env.local</code>, preencha as chaves do seu projeto e
              reinicie o servidor.
            </Alert>
          )}

          {mode !== "reset" && (
            <>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                leading={<GoogleIcon />}
                loading={loading === "google"}
                disabled={!configured || loading !== null}
                onClick={handleGoogle}
              >
                Continuar com Google
              </Button>
              <div className={styles.divider}>
                <span>ou com e-mail</span>
              </div>
            </>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate={false}>
            {mode === "register" && (
              <Input
                label="Nome"
                icon={User}
                placeholder="Como podemos te chamar?"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Input
              label="E-mail"
              type="email"
              icon={Mail}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== "reset" && (
              <div className={styles.passwordField}>
                <Input
                  label="Senha"
                  type="password"
                  icon={Lock}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  hint={mode === "register" ? "Mínimo de 6 caracteres." : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {mode === "login" && (
                  <button type="button" className={styles.forgot} onClick={() => switchMode("reset")}>
                    Esqueci minha senha
                  </button>
                )}
              </div>
            )}

            {error && <Alert tone="danger">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}

            <Button
              type="submit"
              size="lg"
              fullWidth
              icon={mode === "register" ? UserPlus : mode === "reset" ? KeyRound : undefined}
              iconRight={mode === "login" ? ArrowRight : undefined}
              loading={loading === "form"}
              disabled={!configured || loading !== null}
            >
              {copy.submit}
            </Button>
          </form>

          <p className={cn(styles.switch)}>
            {mode === "login" && (
              <>
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => switchMode("register")}>
                  Criar conta
                </button>
              </>
            )}
            {mode === "register" && (
              <>
                Já tem uma conta?{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  Entrar
                </button>
              </>
            )}
            {mode === "reset" && (
              <button type="button" className={styles.back} onClick={() => switchMode("login")}>
                <ArrowLeft size={16} aria-hidden /> Voltar para o login
              </button>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}

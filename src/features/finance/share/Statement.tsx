"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { Lock, Receipt } from "lucide-react";
import { useAuth } from "@/components/providers";
import { FullScreenLoader } from "@/components/layout";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Logo } from "@/components/ui";
import { getAuthErrorMessage, getDb, signInWithGoogle } from "@/lib/firebase";
import { cn } from "@/lib/utils/cn";
import type { ShareDoc, ShareItem, ShareMonthDoc } from "../lib/types";
import { MONTH_RE, sharePath } from "../lib/share";
import { addMonths, monthOf, todayStr } from "../lib/finance";
import { brl, dateBR, dateShort, monthLabel } from "../lib/format";
import { IconBadge } from "../components/icons";
import { MonthPicker, ui } from "../components/kit";
import styles from "./Statement.module.scss";

type State = "loading" | "ok" | "denied";

/** Página pública (`/fatura/{shareId}`) com a fatura de um responsável. Lê só o espelho em `shares/`. */
export function Statement() {
  const { shareId } = useParams<{ shareId: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const mes = params.get("mes");
  // Sem mês na URL, abre no mês seguinte ao atual (mesma regra da tela de Lançamentos).
  const defaultYm = addMonths(monthOf(todayStr()), 1);
  const ym = mes && MONTH_RE.test(mes) ? mes : defaultYm;

  const [state, setState] = useState<State>("loading");
  const [share, setShare] = useState<ShareDoc | null>(null);
  const [items, setItems] = useState<ShareItem[] | null>(null);
  const [authError, setAuthError] = useState("");

  // Mês inválido ou ausente: fixa o mês na URL para o link poder ser compartilhado.
  useEffect(() => {
    if (mes !== ym) router.replace(sharePath(shareId, ym), { scroll: false });
  }, [mes, ym, shareId, router]);

  useEffect(() => {
    if (authLoading) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega ao trocar de conta */
    setState("loading");
    return onSnapshot(
      doc(getDb(), "shares", shareId),
      (snap) => {
        if (!snap.exists()) return setState("denied");
        setShare(snap.data() as ShareDoc);
        setState("ok");
      },
      () => setState("denied"),
    );
  }, [shareId, authLoading, user?.uid]);

  const hasMonth = !!share?.months[ym];
  useEffect(() => {
    if (state !== "ok") return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!hasMonth) return setItems([]);
    setItems(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    return onSnapshot(
      doc(getDb(), "shares", shareId, "months", ym),
      (snap) => setItems(snap.exists() ? (snap.data() as ShareMonthDoc).items : []),
      () => setItems([]),
    );
  }, [state, shareId, ym, hasMonth]);

  const earlierPending = useMemo(
    () => Object.entries(share?.months ?? {}).reduce((s, [m, v]) => (m < ym ? s + v.pending : s), 0),
    [share, ym],
  );
  const pendingMonths = useMemo(
    () =>
      Object.entries(share?.months ?? {})
        .filter(([m, v]) => v.pending > 0 && m <= defaultYm)
        .map(([m]) => m)
        .sort(),
    [share, defaultYm],
  );

  const goTo = (next: string) => router.replace(sharePath(shareId, next), { scroll: false });
  const login = async () => {
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthError(getAuthErrorMessage(e));
    }
  };

  if (authLoading || state === "loading") return <FullScreenLoader label="Carregando fatura" />;

  if (state === "denied" || !share) {
    return (
      <main className={cn(styles.page, styles.locked)}>
        <Card className={styles.gate}>
          <span className={styles.gateIcon}>
            <Lock size={22} aria-hidden />
          </span>
          <h1 className={styles.gateTitle}>Fatura restrita</h1>
          {user ? (
            <>
              <p>
                A conta <strong>{user.email}</strong> não tem acesso a esta fatura. Confira se o link está certo ou entre com o e-mail
                que foi cadastrado.
              </p>
              <Button variant="ghost" onClick={() => signOut()}>
                Sair e usar outra conta
              </Button>
            </>
          ) : (
            <>
              <p>Se esta fatura foi compartilhada com o seu e-mail, entre com a conta Google cadastrada para vê-la.</p>
              <Button onClick={login}>Entrar com o Google</Button>
            </>
          )}
          {authError && <p className={ui.error}>{authError}</p>}
        </Card>
      </main>
    );
  }

  const month = share.months[ym];
  const total = month ? month.pending + month.paid : 0;

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <span className={styles.who}>
          <Avatar name={share.name} src={share.avatarUrl} size="lg" />
          <span>
            <h1 className={styles.title}>Fatura de {share.name}</h1>
            {share.ownerName && <span className={styles.muted}>Compartilhada por {share.ownerName}</span>}
          </span>
        </span>
        <MonthPicker value={ym} onChange={goTo} />
      </header>

      <section className={styles.kpis}>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>Pendente em {monthLabel(ym).toLowerCase()}</span>
          <strong className={cn(styles.kpiValue, !!month?.pending && styles.kpiOut)}>{brl(month?.pending ?? 0)}</strong>
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>Já pago</span>
          <strong className={styles.kpiValue}>{brl(month?.paid ?? 0)}</strong>
        </Card>
        <Card className={styles.kpi}>
          <span className={styles.kpiLabel}>Total do mês</span>
          <strong className={styles.kpiValue}>{brl(total)}</strong>
        </Card>
      </section>

      {earlierPending > 0 && (
        <Alert tone="warning">
          Além deste mês, há <strong>{brl(earlierPending)}</strong> em aberto de meses anteriores.
        </Alert>
      )}

      {pendingMonths.length > 0 && (
        <div className={ui.chips} aria-label="Meses com pendência">
          {pendingMonths.map((m) => (
            <button key={m} type="button" className={cn(ui.chip, m === ym && ui.chipOn)} onClick={() => goTo(m)}>
              {monthLabel(m)} · {brl(share.months[m].pending)}
            </button>
          ))}
        </div>
      )}

      <Card padding="none">
        <h2 className={styles.listTitle}>Despesas de {monthLabel(ym).toLowerCase()}</h2>
        {items === null ? (
          <p className={cn(styles.muted, styles.listPad)}>Carregando…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="Nada neste mês" description="Não há despesas divididas com você neste mês." />
        ) : (
          <ul className={styles.list}>
            {items.map((i) => (
              <li key={i.key} className={styles.item}>
                <IconBadge name={i.icon} color={i.color} />
                <div className={styles.itemMain}>
                  <strong>
                    {i.title}
                    {i.installment ? ` (${i.installment})` : ""}
                  </strong>
                  <span className={styles.muted}>
                    {dateShort(i.date)} · {i.category} · {i.method}
                    {i.isPaid && i.paidAt ? ` · pago em ${dateBR(i.paidAt)}` : ""}
                  </span>
                </div>
                <strong className={styles.amount}>{brl(i.amount)}</strong>
                <Badge tone={i.isPaid ? "success" : "danger"}>{i.isPaid ? "Pago" : "Pendente"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <footer className={styles.foot}>
        <Logo />
        <span className={styles.muted}>
          Atualizado em {new Date(share.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </footer>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getCountFromServer } from "firebase/firestore";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/providers";
import { getDb } from "@/lib/firebase";
import { useFinance } from "@/features/finance";
import { brl, dateBR } from "@/features/finance/lib/format";
import { hasSplits, isOccPaid, isPayable, monthOf, todayStr } from "@/features/finance/lib/finance";
import { ME_ID, SETTINGS_ID } from "@/features/finance/lib/types";
import { useCalendar } from "@/features/calendar";
import { categoryOf, compareOccurrences, timeLabel } from "@/features/calendar/lib/calendar";
import { addDays, shortDateLabel, today as calToday } from "@/features/calendar/lib/dates";
import { expandAll } from "@/features/calendar/lib/recurrence";
import { useTasks } from "@/features/tasks";
import { formatDue, sortTasks } from "@/features/tasks/lib/tasks";
import { useTravel } from "@/features/travel";
import { PHASE_LABEL, tripDays, tripPhase, tripRangeLabel } from "@/features/travel/lib/travel";
import { useNotes } from "@/features/notes";
import { formatUpdated } from "@/features/notes/lib/notes";
import { useMonthItems, useShopping } from "@/features/shopping";
import { monthKey } from "@/features/shopping/lib/shopping";
import { CardLoading, Meter, MiniList, Stats } from "./ModuleCard";
import styles from "../Dashboard.module.scss";

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ───────────── Finanças ───────────── */

export function FinanceSummary() {
  const d = useFinance();
  const ym = monthOf(todayStr());
  const month = d.occurrences.filter((o) => o.monthYear === ym);

  const balance = sum(d.accounts.filter((a) => a.isActive).map((a) => d.balances[a.id] ?? 0));
  const income = sum(month.filter((o) => o.tx.type === "INCOME").map((o) => o.amount));
  const mySpent = sum(
    month.filter((o) => o.tx.type === "EXPENSE").flatMap((o) => o.splits.filter((s) => s.responsibleId === ME_ID).map((s) => s.amount)),
  );
  const toReceive = sum(
    month.filter((o) => hasSplits(o.tx)).flatMap((o) => o.splits.filter((s) => s.responsibleId !== ME_ID && !s.isPaid).map((s) => s.amount)),
  );
  const budget = d.settings[SETTINGS_ID]?.monthlyBudget ?? 0;

  const bills = month.filter((o) => isPayable(o) && !isOccPaid(o)).sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();

  return (
    <>
      <Stats
        items={[
          { label: "Saldo nas contas", value: brl(balance), tone: balance < 0 ? "danger" : undefined },
          { label: "Receitas do mês", value: brl(income), tone: "success" },
          { label: "Sua parte nas despesas", value: brl(mySpent), tone: "danger" },
          { label: "A receber", value: brl(toReceive), tone: toReceive > 0 ? "warning" : undefined },
        ]}
      />
      {budget > 0 && (
        <Meter
          label="Gasto mensal esperado"
          value={mySpent}
          max={budget}
          hint={budget - mySpent >= 0 ? `${brl(budget - mySpent)} disponível` : `${brl(mySpent - budget)} acima`}
        />
      )}
      <MiniList
        title={bills.length ? `Boletos a pagar · ${brl(sum(bills.map((b) => b.amount)))}` : "Boletos a pagar"}
        empty="Nenhum boleto pendente neste mês."
        items={bills.slice(0, 4).map((o) => ({
          key: o.key,
          title: o.tx.title,
          meta: `Vence ${dateBR(o.date)}`,
          aside: brl(o.amount),
          tone: o.date < today ? "danger" : undefined,
          color: d.catById(o.tx.categoryId)?.color,
          href: "/financas/lancamentos",
        }))}
      />
    </>
  );
}

/* ───────────── Viagens ───────────── */

export function TravelSummary() {
  const { trips, placesByTrip } = useTravel();
  const { occurrences } = useFinance();
  const today = todayStr();

  const withPhase = trips.map((t) => ({ trip: t, phase: tripPhase(t, today) }));
  const ongoing = withPhase.filter((t) => t.phase === "ongoing");
  const upcoming = withPhase.filter((t) => t.phase === "upcoming").sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  const highlight = ongoing[0] ?? upcoming[0];

  const spentOn = (catId: string | null) =>
    catId ? sum(occurrences.filter((o) => o.tx.type === "EXPENSE" && o.tx.categoryId === catId).map((o) => o.amount)) : 0;

  return (
    <>
      <Stats
        items={[
          { label: "Em andamento", value: ongoing.length, tone: ongoing.length ? "info" : undefined },
          { label: "Planejadas", value: upcoming.length },
          { label: "Total de viagens", value: trips.length },
        ]}
      />
      {highlight ? (
        <Link href={`/viagens/lista/${highlight.trip.id}`} className={styles.highlight}>
          <span className={styles.highlightLabel}>
            {highlight.phase === "ongoing"
              ? `Dia ${tripDays(highlight.trip.startDate, today)} de ${tripDays(highlight.trip.startDate, highlight.trip.endDate)}`
              : (() => {
                  const n = tripDays(today, highlight.trip.startDate) - 1;
                  return n === 1 ? "Começa amanhã" : `Começa em ${n} dias`;
                })()}
          </span>
          <strong>{highlight.trip.name}</strong>
          <span className={styles.highlightMeta}>
            {[highlight.trip.destination, tripRangeLabel(highlight.trip.startDate, highlight.trip.endDate)].filter(Boolean).join(" · ")}
          </span>
          <span className={styles.highlightMeta}>
            {(() => {
              const places = placesByTrip[highlight.trip.id] ?? [];
              const visited = places.filter((p) => p.visited).length;
              return `${plural(places.length, "lugar", "lugares")}${places.length ? ` (${visited} visitados)` : ""} · ${brl(spentOn(highlight.trip.financeCategoryId))} em gastos`;
            })()}
          </span>
        </Link>
      ) : (
        <p className={styles.empty}>Nenhuma viagem em andamento ou planejada.</p>
      )}
      <MiniList
        title="Próximas viagens"
        empty="Sem outras viagens planejadas."
        items={upcoming
          .filter((t) => t !== highlight)
          .slice(0, 3)
          .map(({ trip, phase }) => ({
            key: trip.id,
            title: trip.name,
            meta: tripRangeLabel(trip.startDate, trip.endDate),
            aside: PHASE_LABEL[phase],
            href: `/viagens/lista/${trip.id}`,
          }))}
      />
    </>
  );
}

/* ───────────── Agenda ───────────── */

export function CalendarSummary() {
  const { events, categoriesById } = useCalendar();
  const today = calToday();
  const weekEnd = addDays(today, 6);

  const upcoming = useMemo(
    () => expandAll(events, today, addDays(today, 30)).sort(compareOccurrences),
    [events, today],
  );
  const todayCount = upcoming.filter((o) => o.startDate <= today && o.endDate >= today).length;
  const weekCount = upcoming.filter((o) => o.startDate <= weekEnd).length;

  return (
    <>
      <Stats
        items={[
          { label: "Hoje", value: todayCount, tone: todayCount ? "info" : undefined },
          { label: "Próximos 7 dias", value: weekCount },
          { label: "Próximos 30 dias", value: upcoming.length },
        ]}
      />
      <MiniList
        title="Próximos compromissos"
        empty="Nada agendado para os próximos 30 dias."
        items={upcoming.slice(0, 5).map((o) => {
          const day = o.startDate < today ? today : o.startDate;
          return {
            key: o.key,
            title: o.event.title,
            meta: timeLabel(o, day),
            aside: day === today ? "Hoje" : day === addDays(today, 1) ? "Amanhã" : shortDateLabel(day),
            tone: day === today ? "info" : undefined,
            color: categoryOf(categoriesById, o.event.category).color,
            href: "/agenda/calendario",
          };
        })}
      />
    </>
  );
}

/* ───────────── Tarefas ───────────── */

export function TasksSummary() {
  const { tasks, categoriesById } = useTasks();
  const today = todayStr();
  const pending = tasks.filter((t) => !t.done);
  const overdue = pending.filter((t) => t.dueDate && t.dueDate < today).length;
  const dueToday = pending.filter((t) => t.dueDate === today).length;
  const done = tasks.length - pending.length;

  return (
    <>
      <Stats
        items={[
          { label: "Pendentes", value: pending.length },
          { label: "Atrasadas", value: overdue, tone: overdue ? "danger" : undefined },
          { label: "Para hoje", value: dueToday, tone: dueToday ? "warning" : undefined },
          { label: "Concluídas", value: done, tone: "success" },
        ]}
      />
      <MiniList
        title="Próximas tarefas"
        empty="Nenhuma tarefa pendente. 🎉"
        items={sortTasks(pending, "due")
          .slice(0, 5)
          .map((t) => {
            const due = t.dueDate ? formatDue(t.dueDate) : null;
            return {
              key: t.id,
              title: t.title,
              meta: categoriesById[t.category]?.name ?? "Sem categoria",
              aside: due ? (due.overdue ? `Atrasada · ${due.label}` : due.label) : "Sem prazo",
              tone: due?.overdue ? "danger" : due?.label === "Hoje" ? "warning" : undefined,
              color: categoriesById[t.category]?.color,
              href: "/tarefas/lista",
            };
          })}
      />
    </>
  );
}

/* ───────────── Notas ───────────── */

export function NotesSummary() {
  const { notes, folders } = useNotes();
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const folderById = Object.fromEntries(folders.map((f) => [f.id, f]));

  return (
    <>
      <Stats
        items={[
          { label: "Notas", value: notes.length },
          { label: "Pastas", value: folders.length },
          { label: "Fixadas", value: notes.filter((n) => n.pinned).length },
        ]}
      />
      <MiniList
        title="Editadas recentemente"
        empty="Você ainda não criou nenhuma nota."
        items={recent.map((n) => ({
          key: n.id,
          title: n.title || "Sem título",
          meta: n.folderId ? (folderById[n.folderId]?.name ?? "Sem pasta") : "Sem pasta",
          aside: formatUpdated(n.updatedAt),
          color: n.folderId ? folderById[n.folderId]?.color : undefined,
          href: "/notas",
        }))}
      />
    </>
  );
}

/* ───────────── Lista de compras ───────────── */

export function ShoppingSummary() {
  const { purchases } = useShopping();
  const ym = monthKey();
  const items = useMonthItems(ym);
  const monthPurchases = purchases.filter((p) => p.month === ym);

  if (!items) return <CardLoading label="Carregando lista do mês" />;
  const checked = items.filter((i) => i.checked).length;

  return (
    <>
      <Stats
        items={[
          { label: "Itens na lista do mês", value: items.length },
          { label: "No carrinho", value: checked, tone: checked ? "success" : undefined },
          { label: "Gasto no mês", value: brl(sum(monthPurchases.map((p) => p.total))) },
        ]}
      />
      {items.length > 0 && (
        <Meter label="Progresso da lista" value={checked} max={items.length} hint={`${checked} de ${items.length}`} />
      )}
      <MiniList
        title="Últimas compras"
        empty="Nenhuma compra finalizada ainda."
        items={purchases.slice(0, 3).map((p) => ({
          key: p.id,
          title: p.store,
          meta: `${dateBR(p.date)} · ${plural(p.items.length, "item", "itens")}`,
          aside: brl(p.total),
          href: "/compras/historico",
        }))}
      />
    </>
  );
}

/* ───────────── Senhas ───────────── */

/** O cofre fica bloqueado: aqui só contamos os registros, sem ler nem decifrar nada. */
export function PasswordsSummary() {
  const { user } = useAuth();
  const uid = user!.uid;
  const [counts, setCounts] = useState<{ entries: number; tags: number } | null | "error">(null);

  useEffect(() => {
    const col = (name: string) => collection(getDb(), "users", uid, "modules", "passwords", name);
    Promise.all([getCountFromServer(col("entries")), getCountFromServer(col("tags"))])
      .then(([e, t]) => setCounts({ entries: e.data().count, tags: t.data().count }))
      .catch(() => setCounts("error"));
  }, [uid]);

  if (counts === null) return <CardLoading label="Contando senhas" />;

  return (
    <>
      {counts === "error" ? (
        <p className={styles.empty}>Não foi possível contar as senhas agora.</p>
      ) : (
        <Stats
          items={[
            { label: "Senhas salvas", value: counts.entries },
            { label: "Tags", value: counts.tags },
          ]}
        />
      )}
      <p className={styles.note}>
        <Lock size={14} aria-hidden /> Cofre protegido pela senha de segurança. Abra o módulo para ver os dados.
      </p>
    </>
  );
}

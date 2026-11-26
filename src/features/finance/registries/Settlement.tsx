"use client";

import { useMemo, useState } from "react";
import { HandCoins, Receipt, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Alert, Badge, Button, Card, EmptyState, IconButton } from "@/components/ui";
import { useFinance } from "../data/FinanceDataProvider";
import { ME_ID, type Occurrence } from "../lib/types";
import { hasSplits, monthOf, todayStr } from "../lib/finance";
import { brl, byName, dateBR, dateShort, monthLabel } from "../lib/format";
import { IconBadge } from "../components/icons";
import { MonthPicker, Person, Segmented, ui } from "../components/kit";
import styles from "./Settlement.module.scss";

/** Parte de um responsável em uma ocorrência dividida. */
interface Item {
  occ: Occurrence;
  responsibleId: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string | null;
}

type Scope = "month" | "all";

const keyOf = (i: Item) => `${i.occ.key}|${i.responsibleId}`;
const sum = (list: Item[]) => list.reduce((s, i) => s + i.amount, 0);

/** Acerto de contas: quanto cada responsável deve, com baixa (recebimento) e desfazer. */
export function Settlement() {
  const d = useFinance();
  const [who, setWho] = useState("");
  const [scope, setScope] = useState<Scope>("month");
  const [ym, setYm] = useState(monthOf(todayStr()));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const o of d.occurrences) {
      if (!hasSplits(o.tx)) continue;
      if (scope === "month" && o.monthYear !== ym) continue;
      for (const s of o.splits) {
        if (s.responsibleId === ME_ID) continue;
        out.push({
          occ: o,
          responsibleId: s.responsibleId,
          amount: s.amount,
          isPaid: s.isPaid,
          paidAt: s.paidAt,
        });
      }
    }
    return out.sort((a, b) => (a.occ.date < b.occ.date ? 1 : -1));
  }, [d.occurrences, scope, ym]);

  const people = byName(d.responsibles);
  const summary = people.map((r) => {
    const mine = items.filter((i) => i.responsibleId === r.id);
    const open = mine.filter((i) => !i.isPaid);
    return {
      r,
      pending: sum(open),
      received: sum(mine.filter((i) => i.isPaid)),
      count: open.length,
    };
  });
  const totalPending = summary.reduce((s, x) => s + x.pending, 0);
  const totalReceived = summary.reduce((s, x) => s + x.received, 0);
  const totalCount = summary.reduce((s, x) => s + x.count, 0);

  const shown = items.filter((i) => !who || i.responsibleId === who);
  const pendingShown = shown.filter((i) => !i.isPaid);
  const pickedItems = pendingShown.filter((i) => picked.has(keyOf(i)));

  const choosePerson = (id: string) => {
    setWho(id);
    setPicked(new Set());
  };
  const toggle = (k: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });

  /** Marca (ou desmarca) as partes como recebidas. Sem conta: não mexe em saldo bancário. */
  const mark = async (list: Item[], paid: boolean) => {
    if (busy || list.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await d.settleSplits(
        list.map((i) => ({ occ: i.occ, responsibleId: i.responsibleId })),
        null,
        paid,
      );
      if (paid) setPicked(new Set());
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  if (people.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        title="Sem responsáveis"
        description="Cadastre pessoas na aba Pessoas para acompanhar o que cada uma deve."
      />
    );
  }

  return (
    <div className={ui.stack}>
      <div className={styles.filters}>
        <Segmented<Scope>
          label="Período"
          value={scope}
          onChange={setScope}
          options={[
            { value: "month", label: "Mês" },
            { value: "all", label: "Geral" },
          ]}
        />
        {scope === "month" && <MonthPicker value={ym} onChange={setYm} />}
        <select className={cn(ui.select, styles.who)} value={who} onChange={(e) => choosePerson(e.target.value)} aria-label="Responsável">
          <option value="">Todas as pessoas</option>
          {people.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <Card className={styles.total} aria-label="Total devedor">
        <span className={styles.totalLabel}>
          <HandCoins size={18} aria-hidden /> Total devedor {scope === "month" ? `em ${monthLabel(ym)}` : "geral"}
        </span>
        <strong className={styles.totalValue}>{brl(totalPending)}</strong>
        <span className={styles.muted}>
          Soma de todos os responsáveis · {totalCount} pendência(s) · recebido {brl(totalReceived)}
        </span>
      </Card>

      <div className={styles.people}>
        {summary
          .filter((s) => !who || s.r.id === who)
          .map(({ r, pending, received, count }) => (
            <button
              key={r.id}
              type="button"
              className={cn(styles.person, who === r.id && styles.personOn)}
              onClick={() => choosePerson(who === r.id ? "" : r.id)}
              aria-pressed={who === r.id}
            >
              <span className={styles.personName}>
                <Person name={r.name} url={r.avatarUrl} size="md" />
                <strong>{r.name}</strong>
              </span>
              <span className={styles.personValue}>{brl(pending)}</span>
              <span className={styles.muted}>
                {count} pendência(s) · recebido {brl(received)}
              </span>
            </button>
          ))}
      </div>

      <Card padding="none">
        <div className={styles.listHead}>
          <h2 className={styles.listTitle}>Pendências e recebimentos</h2>
          {pendingShown.length > 0 && (
            <span className={styles.listActions}>
              {pickedItems.length > 0 && (
                <Button size="sm" icon={HandCoins} disabled={busy} onClick={() => mark(pickedItems, true)}>
                  Receber selecionados ({pickedItems.length})
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark(pendingShown, true)}>
                Dar baixa em todas ({brl(sum(pendingShown))})
              </Button>
            </span>
          )}
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={Receipt} title="Nada para acertar" description="Despesas divididas com outras pessoas aparecem aqui." />
        ) : (
          <ul className={styles.list}>
            {shown.map((i) => {
              const cat = d.catById(i.occ.tx.categoryId);
              const k = keyOf(i);
              return (
                <li key={k} className={styles.item}>
                  {i.isPaid ? (
                    <span className={styles.checkSpacer} />
                  ) : (
                    <input
                      type="checkbox"
                      className={styles.check}
                      checked={picked.has(k)}
                      onChange={(e) => toggle(k, e.target.checked)}
                      aria-label={`Selecionar ${i.occ.tx.title} de ${d.respName(i.responsibleId)}`}
                    />
                  )}
                  <IconBadge name={cat?.icon ?? "tag"} color={cat?.color ?? "#8795AD"} />
                  <div className={styles.itemMain}>
                    <strong>
                      {i.occ.tx.title}
                      {i.occ.installment ? ` (${i.occ.installment.current}/${i.occ.installment.total})` : ""}
                    </strong>
                    <span className={styles.muted}>
                      {d.respName(i.responsibleId)} · {dateShort(i.occ.date)}
                      {i.isPaid && i.paidAt ? ` · recebido em ${dateBR(i.paidAt)}` : ""}
                    </span>
                  </div>
                  <strong className={styles.amount}>{brl(i.amount)}</strong>
                  {i.isPaid ? (
                    <span className={styles.itemActions}>
                      <Badge tone="success">Recebido</Badge>
                      <IconButton icon={Undo2} size="sm" label="Desfazer recebimento" disabled={busy} onClick={() => mark([i], false)} />
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark([i], true)}>
                      Confirmar recebimento
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

    </div>
  );
}


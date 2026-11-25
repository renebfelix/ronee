"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Check as CheckIcon, Copy, MoreVertical, Pencil, Receipt, Trash2, Undo2 } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { useFinance } from "../data/FinanceDataProvider";
import { ME_ID, type Occurrence } from "../lib/types";
import { isOccPaid, isPayable, isRefund, settleInfo } from "../lib/finance";
import { brl, dateShort, monthLabel } from "../lib/format";
import { IconBadge } from "./icons";
import { Person } from "./kit";
import styles from "./TxList.module.scss";

export type TxSortKey = "title" | "date" | "amount";
export interface TxSort {
  key: TxSortKey;
  dir: "asc" | "desc";
}

// Ordena por coluna; empates caem na data mais recente e depois no título.
export function sortTx(items: Occurrence[], { key, dir }: TxSort): Occurrence[] {
  const sign = dir === "asc" ? 1 : -1;
  const byTitle = (a: Occurrence, b: Occurrence) => a.tx.title.localeCompare(b.tx.title, "pt-BR");
  const byDate = (a: Occurrence, b: Occurrence) => b.date.localeCompare(a.date);
  return [...items].sort((a, b) => {
    if (key === "title") return sign * byTitle(a, b) || byDate(a, b);
    if (key === "amount") return sign * (a.amount - b.amount) || byDate(a, b) || byTitle(a, b);
    return sign * a.date.localeCompare(b.date) || byTitle(a, b);
  });
}

// Clicar na coluna já ordenada inverte o sentido; numa nova, texto começa em A–Z e data/valor no maior.
export const nextTxSort = (cur: TxSort, key: TxSortKey): TxSort =>
  cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "title" ? "asc" : "desc" };

interface Props {
  items: Occurrence[];
  mode?: "table" | "list";
  onEdit?: (o: Occurrence) => void;
  onDelete?: (o: Occurrence) => void;
  /** Mover para outro mês/fatura, mantendo a data da compra. */
  onMove?: (o: Occurrence) => void;
  emptyText?: string;
  sort?: TxSort;
  onSort?: (key: TxSortKey) => void;
  /** Modo de verificação: mostra uma caixa por linha; marcadas ficam verdes. */
  checked?: Set<string>;
  onToggleCheck?: (o: Occurrence) => void;
  /** Boletos: "Marcar como pago" (tira o valor da conta escolhida). */
  onTogglePaid?: (o: Occurrence, paid: boolean) => void;
  /** Cobranças: "Marcar como recebido" (o valor entra na conta escolhida). */
  onToggleReceived?: (o: Occurrence, received: boolean) => void;
}

const isCharge = (o: Occurrence) => o.tx.type === "CHARGE";
/** Cobrança recebida: a parte do responsável já foi baixada. */
const isReceived = (o: Occurrence) =>
  o.splits.some((s) => s.responsibleId !== ME_ID) && o.splits.every((s) => s.responsibleId === ME_ID || s.isPaid);
const CHARGE_CAT = { name: "Cobrança", icon: "circle-dollar-sign", color: "#E8A317" };

/** Situação do boleto (só sai do saldo ao ser pago). */
function PaidTag({ occ }: { occ: Occurrence }) {
  if (!isPayable(occ)) return null;
  return isOccPaid(occ) ? <Badge tone="success">Pago</Badge> : <Badge tone="warning">A pagar</Badge>;
}

interface RowMenuProps {
  o: Occurrence;
  onEdit?: (o: Occurrence) => void;
  onDelete?: (o: Occurrence) => void;
  onMove?: (o: Occurrence) => void;
  onTogglePaid?: (o: Occurrence, paid: boolean) => void;
  onToggleReceived?: (o: Occurrence, received: boolean) => void;
}

/**
 * Menu "⋮" de cada linha. O painel é fixo e vai para o <body>: a tabela tem rolagem
 * horizontal, que cortaria um painel posicionado dentro dela.
 */
function RowMenu({ o, onEdit, onDelete, onMove, onTogglePaid, onToggleReceived }: RowMenuProps) {
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canPay = !!onTogglePaid && isPayable(o);
  const paid = canPay && isOccPaid(o);
  const canReceive = !!onToggleReceived && isCharge(o);
  const received = canReceive && isReceived(o);

  const toggle = () => {
    if (pos) return setPos(null);
    const r = btnRef.current!.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 200;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, right: window.innerWidth - r.right, up });
  };

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      btnRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const run = (fn: () => void) => {
    setPos(null);
    fn();
  };

  return (
    <span className={styles.menuCell} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className={styles.menuBtn}
        onClick={toggle}
        aria-label={`Ações de ${o.tx.title}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
      >
        <MoreVertical size={16} />
      </button>
      {pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className={styles.menu}
            style={{ top: pos.top, right: pos.right, transform: pos.up ? "translateY(-100%)" : undefined }}
          >
            {canPay && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() =>
                  run(() => {
                    if (!paid) onTogglePaid!(o, true);
                    else if (window.confirm(`Desfazer o pagamento de "${o.tx.title}"? O valor volta para o saldo da conta.`))
                      onTogglePaid!(o, false);
                  })
                }
              >
                {paid ? <Undo2 size={16} /> : <CheckIcon size={16} />} {paid ? "Desfazer pagamento" : "Marcar como pago"}
              </button>
            )}
            {canReceive && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() =>
                  run(() => {
                    if (!received) onToggleReceived!(o, true);
                    else if (window.confirm(`Desfazer o recebimento de "${o.tx.title}"? O valor sai da conta onde caiu.`))
                      onToggleReceived!(o, false);
                  })
                }
              >
                {received ? <Undo2 size={16} /> : <CheckIcon size={16} />} {received ? "Desfazer recebimento" : "Marcar como recebido"}
              </button>
            )}
            {o.tx.paymentMethodType === "BOLETO" && o.tx.barcode && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() =>
                  run(() =>
                    navigator.clipboard
                      ?.writeText(o.tx.barcode!)
                      .catch(() => window.prompt("Copie o código do boleto:", o.tx.barcode)),
                  )
                }
              >
                <Copy size={16} /> Copiar código do boleto
              </button>
            )}
            {onEdit && (
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => run(() => onEdit(o))}>
                <Pencil size={16} /> Editar
              </button>
            )}
            {onMove && (
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => run(() => onMove(o))}>
                <CalendarDays size={16} /> {o.tx.paymentMethodType === "CARD" && o.tx.type === "EXPENSE" ? "Mover para outra fatura" : "Mover para outro mês"}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                className={cn(styles.menuItem, styles.menuDanger)}
                onClick={() => run(() => onDelete(o))}
              >
                <Trash2 size={16} /> Excluir
              </button>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

export function SettleTag({ occ }: { occ: Occurrence }) {
  if (occ.tx.type === "INCOME") return null;
  if (isCharge(occ)) return isReceived(occ) ? <Badge tone="success">Recebido</Badge> : <Badge tone="warning">A receber</Badge>;
  const { state, paid, total } = settleInfo(occ.splits);
  if (state === "NONE") return null;
  if (state === "DONE") return <Badge tone="success">Totalmente liquidado</Badge>;
  if (state === "PARTIAL")
    return (
      <Badge tone="warning">
        Parcialmente pago ({paid}/{total})
      </Badge>
    );
  return <Badge tone="danger">Pendente</Badge>;
}

function People({ occ }: { occ: Occurrence }) {
  const d = useFinance();
  const others = occ.splits.filter((s) => s.responsibleId !== ME_ID);
  if (!others.length) return <span className={styles.muted}>Só eu</span>;
  return (
    <span className={styles.avatars}>
      {others.map((s) => (
        <Person key={s.responsibleId} name={d.respName(s.responsibleId)} url={d.respById(s.responsibleId)?.avatarUrl} />
      ))}
    </span>
  );
}

function Amount({ occ }: { occ: Occurrence }) {
  // Estorno é despesa com valor negativo: aparece como crédito. Cobrança é valor a receber.
  const inc = occ.tx.type === "INCOME" || isCharge(occ) || occ.amount < 0;
  return (
    <span className={cn(styles.money, inc ? styles.moneyIn : styles.moneyOut)}>
      {inc ? "+" : "−"} {brl(Math.abs(occ.amount))}
    </span>
  );
}

function Tags({ occ }: { occ: Occurrence }) {
  return (
    <>
      {isRefund(occ.tx) && <Badge tone="success">Estorno</Badge>}
      {occ.installment && (
        <Badge tone="info">
          {occ.installment.current}/{occ.installment.total}
        </Badge>
      )}
      {occ.tx.frequency === "FIXED" && <Badge tone="neutral">Fixa</Badge>}
      {!!occ.monthShift && (
        <span title={`Movido; o mês original é ${monthLabel(occ.baseMonth).toLowerCase()}`}>
          <Badge tone="primary" icon={CalendarDays}>
            Movido
          </Badge>
        </span>
      )}
    </>
  );
}

export function TxList({
  items,
  mode = "table",
  onEdit,
  onDelete,
  onMove,
  emptyText,
  sort,
  onSort,
  checked,
  onToggleCheck,
  onTogglePaid,
  onToggleReceived,
}: Props) {
  const d = useFinance();
  const actions = !!(onEdit || onDelete || onMove || onTogglePaid || onToggleReceived);
  // Cobrança não tem categoria: mostra um rótulo próprio.
  const catOf = (o: Occurrence) => (isCharge(o) ? CHARGE_CAT : d.catById(o.tx.categoryId));
  const verifying = !!onToggleCheck;
  const isChecked = (o: Occurrence) => !!checked?.has(o.key);
  const renderCheck = (o: Occurrence) => (
    <input
      type="checkbox"
      className={styles.check}
      checked={isChecked(o)}
      onChange={() => onToggleCheck?.(o)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Conferido: ${o.tx.title}`}
    />
  );
  if (!items.length)
    return (
      <EmptyState
        icon={Receipt}
        title="Nenhum lançamento aqui"
        description={emptyText ?? "Quando houver lançamentos neste período, eles aparecem nesta lista."}
      />
    );

  // Chamado como função (não como componente) para o menu não perder o estado a cada render da lista.
  const renderActions = (o: Occurrence) =>
    actions ? (
      <RowMenu o={o} onEdit={onEdit} onDelete={onDelete} onMove={onMove} onTogglePaid={onTogglePaid} onToggleReceived={onToggleReceived} />
    ) : null;

  // Título de coluna: vira botão de ordenação quando a tela passa onSort.
  const th = (k: TxSortKey, label: string, className?: string) => {
    if (!onSort) return <th className={className}>{label}</th>;
    const active = sort?.key === k;
    const SortIcon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className={cn(styles.thSort, active && styles.thSortActive)} onClick={() => onSort(k)}>
          {label} <SortIcon size={13} />
        </button>
      </th>
    );
  };

  if (mode === "list") {
    return (
      <ul className={styles.cards}>
        {items.map((o) => {
          const cat = catOf(o);
          const m = d.methodOf(o.tx);
          return (
            <li
              key={o.key}
              className={cn(styles.card, verifying && styles.verify, verifying && isChecked(o) && styles.isChecked)}
              onClick={verifying ? () => onToggleCheck?.(o) : undefined}
            >
              {verifying && renderCheck(o)}
              <IconBadge name={cat?.icon ?? "tag"} color={cat?.color ?? "#8795AD"} />
              <div className={styles.cardMain}>
                <strong className={styles.title}>{o.tx.title}</strong>
                <span className={styles.muted}>
                  {dateShort(o.date)} · {cat?.name ?? "Sem categoria"} · {m.name}
                </span>
                <span className={styles.tags}>
                  <Tags occ={o} />
                  <SettleTag occ={o} />
                  <PaidTag occ={o} />
                </span>
              </div>
              <div className={styles.cardSide}>
                <Amount occ={o} />
                <People occ={o} />
                {renderActions(o)}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {verifying && <th className={styles.checkCol} aria-label="Conferido" />}
            {th("title", "Lançamento")}
            {th("date", "Data")}
            <th>Método</th>
            <th>Responsáveis</th>
            <th>Acerto</th>
            {th("amount", "Valor", styles.num)}
            {actions && <th className={styles.num}>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((o) => {
            const cat = catOf(o);
            const m = d.methodOf(o.tx);
            return (
              <tr
                key={o.key}
                className={cn(verifying && styles.verify, verifying && isChecked(o) && styles.isChecked)}
                onClick={verifying ? () => onToggleCheck?.(o) : undefined}
              >
                {verifying && <td className={styles.checkCol}>{renderCheck(o)}</td>}
                <td>
                  <span className={styles.txCell}>
                    <IconBadge name={cat?.icon ?? "tag"} color={cat?.color ?? "#8795AD"} size={34} />
                    <span className={styles.txText}>
                      <strong className={styles.title}>{o.tx.title}</strong>
                      <span className={styles.tags}>
                        <span className={styles.muted}>{cat?.name ?? "Sem categoria"}</span>
                        <Tags occ={o} />
                      </span>
                    </span>
                  </span>
                </td>
                <td className={styles.nowrap}>{dateShort(o.date)}</td>
                <td>
                  <span className={styles.method}>
                    <span className={styles.dot} style={{ background: m.color }} /> {m.name}
                  </span>
                </td>
                <td>
                  <People occ={o} />
                </td>
                <td>
                  <span className={styles.tags}>
                    <SettleTag occ={o} />
                    <PaidTag occ={o} />
                  </span>
                </td>
                <td className={styles.num}>
                  <Amount occ={o} />
                </td>
                {actions && <td className={styles.num}>{renderActions(o)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import {
  BankAccount,
  CreditCard,
  InvoiceStatus,
  Occurrence,
  OverrideMap,
  ResponsibleSplit,
  Transaction,
  ME_ID,
} from './types';

/* ───────────── Datas (sempre strings YYYY-MM-DD / YYYY-MM, sem fuso) ───────────── */

const pad = (n: number) => String(n).padStart(2, '0');

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthOf = (date: string) => date.slice(0, 7);

export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};

export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export const dateInMonth = (ym: string, day: number) => `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;
export const addMonthsToDate = (date: string, n: number) =>
  dateInMonth(addMonths(monthOf(date), n), Number(date.slice(8, 10)));

export const diffDays = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};

export const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export const monthRange =(endYm: string, count: number) =>
  Array.from({ length: count }, (_, i) => addMonths(endYm, i - (count - 1)));

/* ───────────── Valores ───────────── */

/** Divide `total` em `n` partes em centavos; os centavos restantes vão para as primeiras. */
export const splitAmounts = (total: number, n: number): number[] => {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
};

/** `parts` permite valores diferentes por responsável; sem ele, divide `amount` igualmente. */
export function buildSplits(
  amount: number,
  ids: string[],
  existing: ResponsibleSplit[] = [],
  today = todayStr(),
  parts = splitAmounts(amount, ids.length),
): ResponsibleSplit[] {
  return ids.map((rid, i) => {
    const prev = existing.find((s) => s.responsibleId === rid);
    const isMe = rid === ME_ID;
    return {
      responsibleId: rid,
      amount: parts[i],
      isPaid: isMe ? true : prev?.isPaid ?? false,
      paidAt: isMe ? today : prev?.paidAt ?? null,
      destinationAccountId: prev?.destinationAccountId ?? null,
    };
  });
}

/* ───────────── Ocorrências (expande lançamentos fixos mês a mês) ───────────── */

/** Lançamento com partes de responsáveis a receber: despesas divididas e cobranças. */
export const hasSplits = (tx: Pick<Transaction, 'type'>) => tx.type === 'EXPENSE' || tx.type === 'CHARGE';

/** Estorno só vale para despesa única no cartão. */
export const isRefund = (tx: Pick<Transaction, 'isRefund' | 'type' | 'paymentMethodType' | 'frequency'>) =>
  !!tx.isRefund && tx.type === 'EXPENSE' && tx.paymentMethodType === 'CARD' && tx.frequency === 'SINGLE';

/**
 * `monthFor` define o mês de cada ocorrência a partir da data dela
 * (ex.: compras no cartão, inclusive fixas, caem no mês da fatura).
 * Em fixas, baixas (`occurrenceSplits`), valores ajustados (`occurrenceAmounts`), pagamentos e `endMonth` usam esse
 * mesmo mês — o mês natural (`baseMonth`), mesmo quando a ocorrência foi movida (`occurrenceShifts`).
 */
export function buildOccurrences(
  txs: Transaction[],
  fromYm: string,
  toYm: string,
  monthFor: (tx: Transaction, date: string) => string = (_tx, date) => monthOf(date),
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const tx of txs) {
    if (tx.frequency === 'FIXED') {
      // Ocorrências movidas podem vir de meses fora do intervalo: amplia a varredura pelo maior deslocamento.
      const shifts = Object.values(tx.occurrenceShifts ?? {});
      const maxAhead = Math.max(0, ...shifts);
      const maxBack = Math.max(0, ...shifts.map((s) => -s));
      const start = monthOf(tx.date);
      // A fatura cai no mês anterior, no mesmo ou no seguinte ao da data: varre um mês a mais de cada lado.
      const before = addMonths(fromYm, -1 - maxAhead);
      const first = start > before ? start : before;
      const lastBase = addMonths(toYm, maxBack);
      const last = addMonths(lastBase, 1);
      const day = Number(tx.date.slice(8, 10));
      for (let cal = first; cal <= last; cal = addMonths(cal, 1)) {
        const date = dateInMonth(cal, day);
        const base = monthFor(tx, date);
        if (base > lastBase || (tx.endMonth && base > tx.endMonth)) break;
        const shift = tx.occurrenceShifts?.[base] ?? 0;
        const ym = addMonths(base, shift);
        if (ym < fromYm || ym > toYm) continue;
        out.push({
          key: `${tx.id}_${cal}`,
          tx,
          monthYear: ym,
          baseMonth: base,
          date,
          ...(shift ? { monthShift: shift } : {}),
          amount: tx.occurrenceAmounts?.[base] ?? tx.totalAmount,
          splits: tx.occurrenceSplits?.[base] ?? tx.splits,
        });
      }
    } else {
      // Lançamento movido: entra N meses (ou faturas) depois do natural, mantendo a data original da compra.
      const shift = tx.monthShift ?? 0;
      const base = monthFor(tx, tx.date);
      const ym = addMonths(base, shift);
      if (ym < fromYm || ym > toYm) continue;
      // Estorno entra negativo: abate a fatura, os gastos do mês e a parte de cada responsável.
      const refund = isRefund(tx);
      out.push({
        key: tx.id,
        tx,
        monthYear: ym,
        baseMonth: base,
        date: tx.date,
        ...(shift ? { monthShift: shift } : {}),
        amount: refund ? -tx.totalAmount : tx.totalAmount,
        splits: refund ? tx.splits.map((s) => ({ ...s, amount: -s.amount })) : tx.splits,
        installment:
          tx.frequency === 'INSTALLMENT' && tx.currentInstallment && tx.installmentsCount
            ? { current: tx.currentInstallment, total: tx.installmentsCount }
            : undefined,
      });
    }
  }
  return out;
}

/* ───────────── Faturas de cartão ───────────── */

export const overrideId = (cardId: string, ym: string) => `${cardId}_${ym}`;

export const bestDayFor = (card: CreditCard, ym: string, ov: OverrideMap) =>
  ov[overrideId(card.id, ym)]?.customBestDay ?? card.defaultBestDay;

/** Fechamento da fatura do mês `ym`: o melhor dia do mês ou a data ajustada (que pode cair no mês seguinte). */
export const closingDate = (card: CreditCard, ym: string, ov: OverrideMap) =>
  ov[overrideId(card.id, ym)]?.customClosingDate ?? dateInMonth(ym, bestDayFor(card, ym, ov));

/**
 * Fatura (mês do fechamento) em que a compra entra: a primeira cujo fechamento é no dia da compra ou depois.
 * Ex.: se a fatura de novembro fecha em 02/12, uma compra em 01/12 conta em novembro.
 */
export const invoiceMonthOf = (card: CreditCard, date: string, ov: OverrideMap) => {
  const ym = monthOf(date);
  for (const m of [addMonths(ym, -1), ym]) if (date <= closingDate(card, m, ov)) return m;
  return addMonths(ym, 1);
};

/** Vencimento: o primeiro dia de vencimento depois do fechamento. */
export const dueDate = (card: CreditCard, ym: string, ov: OverrideMap) => {
  const closing = closingDate(card, ym, ov);
  const cym = monthOf(closing);
  return dateInMonth(card.dueDay > Number(closing.slice(8, 10)) ? cym : addMonths(cym, 1), card.dueDay);
};

export const invoiceStatus = (
  card: CreditCard,
  ym: string,
  ov: OverrideMap,
  today = todayStr(),
): InvoiceStatus => {
  if (ov[overrideId(card.id, ym)]?.status === 'PAID') return 'PAID';
  return today > closingDate(card, ym, ov) ? 'CLOSED' : 'OPEN';
};

/**
 * Agrupa as compras no cartão pela fatura em que caem.
 * As ocorrências já vêm com `monthYear` = mês da fatura (inclusive as movidas para outra fatura).
 */
export function cardInvoiceMap(card: CreditCard, occs: Occurrence[]) {
  const map: Record<string, Occurrence[]> = {};
  for (const o of occs) {
    if (o.tx.type !== 'EXPENSE' || o.tx.paymentMethodType !== 'CARD' || o.tx.paymentMethodId !== card.id) continue;
    (map[o.monthYear] ??= []).push(o);
  }
  return map;
}

export const sumOcc = (list: Occurrence[]) => list.reduce((s, o) => s + o.amount, 0);

/* ───────────── Pagamento de boletos ───────────── */

/** Só boleto precisa ser marcado como pago; despesa direto na conta sai do saldo pela data. */
export const isPayable = (o: Occurrence) => o.tx.type === 'EXPENSE' && o.tx.paymentMethodType === 'BOLETO';

/** Boleto já pago (saiu do saldo). Em fixas, o pagamento é por mês. */
export const isOccPaid = (o: Occurrence) =>
  !!(o.tx.frequency === 'FIXED' ? o.tx.occurrencePaid?.[o.baseMonth] : o.tx.isPaid);

/** Conta escolhida ao pagar o boleto. */
export const paidFromOf = (o: Occurrence): string | null =>
  (o.tx.frequency === 'FIXED' ? o.tx.occurrencePaidFrom?.[o.baseMonth] : o.tx.paidFromAccountId) ?? null;

/* ───────────── Saldos ───────────── */

export function computeBalances(
  accounts: Pick<BankAccount, 'id' | 'initialBalance'>[],
  cards: CreditCard[],
  occs: Occurrence[],
  ov: OverrideMap,
  today = todayStr(),
): Record<string, number> {
  const bal: Record<string, number> = {};
  accounts.forEach((a) => (bal[a.id] = a.initialBalance));

  for (const o of occs) {
    if (o.tx.paymentMethodType === 'BANK') {
      // Receita e despesa direto na conta entram/saem pela data.
      if (bal[o.tx.paymentMethodId] !== undefined && o.date <= today) {
        bal[o.tx.paymentMethodId] += o.tx.type === 'INCOME' ? o.amount : -o.amount;
      }
    } else if (isPayable(o) && isOccPaid(o)) {
      // Boleto só sai da conta escolhida quando o pagamento é confirmado.
      const from = paidFromOf(o);
      if (from && bal[from] !== undefined) bal[from] -= o.amount;
    }
    // Partes recebidas de responsáveis (despesa dividida ou cobrança) entram na conta indicada.
    if (hasSplits(o.tx)) {
      for (const s of o.splits) {
        if (s.isPaid && s.responsibleId !== ME_ID && s.destinationAccountId && bal[s.destinationAccountId] !== undefined) {
          bal[s.destinationAccountId] += s.amount;
        }
      }
    }
  }

  for (const card of cards) {
    const inv = cardInvoiceMap(card, occs);
    for (const [ym, list] of Object.entries(inv)) {
      const o = ov[overrideId(card.id, ym)];
      if (o?.status === 'PAID' && o.paidFromAccountId && bal[o.paidFromAccountId] !== undefined) {
        bal[o.paidFromAccountId] -= sumOcc(list);
      }
    }
  }

  return bal;
}

/* ───────────── Acerto de contas ───────────── */

export type SettleState = 'NONE' | 'PENDING' | 'PARTIAL' | 'DONE';

export function settleInfo(splits: ResponsibleSplit[]) {
  const others = splits.filter((s) => s.responsibleId !== ME_ID);
  const paid = others.filter((s) => s.isPaid).length;
  const state: SettleState =
    others.length === 0 ? 'NONE' : paid === others.length ? 'DONE' : paid === 0 ? 'PENDING' : 'PARTIAL';
  return { state, paid, total: others.length };
}

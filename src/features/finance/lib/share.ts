import type { Category, Occurrence, Responsible, ShareItem, ShareMode, ShareMonthSummary } from "./types";
import { hasSplits } from "./finance";

export const SHARE_MODES: { value: ShareMode; label: string; hint: string }[] = [
  { value: "PRIVATE", label: "Privado", hint: "Só você consegue abrir o link." },
  { value: "EMAIL", label: "Por e-mail", hint: "A pessoa entra com o Google usando o e-mail cadastrado." },
  { value: "PUBLIC", label: "Público", hint: "Qualquer pessoa com o link vê a fatura." },
];

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const sharePath = (shareId: string, ym?: string) => `/fatura/${shareId}${ym ? `?mes=${ym}` : ""}`;

/** Hash curto (cyrb53) só para detectar mudança de conteúdo; não é segurança. */
export const hashOf = (s: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/** Agrupa por mês (o mesmo do acerto de contas) a parte do responsável em cada despesa. */
export function buildShareMonths(
  r: Responsible,
  occurrences: Occurrence[],
  catById: (id: string) => Category | undefined,
  methodName: (o: Occurrence) => string,
): Record<string, ShareItem[]> {
  const out: Record<string, ShareItem[]> = {};
  for (const o of occurrences) {
    if (!hasSplits(o.tx)) continue;
    const s = o.splits.find((x) => x.responsibleId === r.id);
    if (!s) continue;
    const cat = catById(o.tx.categoryId);
    (out[o.monthYear] ??= []).push({
      key: o.key,
      title: o.amount < 0 ? `${o.tx.title} (estorno)` : o.tx.title,
      date: o.date,
      amount: s.amount,
      isPaid: s.isPaid,
      paidAt: s.paidAt ?? null,
      category: cat?.name ?? (o.tx.type === "CHARGE" ? "Cobrança" : "Sem categoria"),
      color: cat?.color ?? "#8795AD",
      icon: cat?.icon ?? "tag",
      method: methodName(o),
      ...(o.installment ? { installment: `${o.installment.current}/${o.installment.total}` } : {}),
    });
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? -1 : 1));
  }
  return out;
}

export const summarize = (items: ShareItem[]): ShareMonthSummary => {
  const cents = (paid: boolean) => items.filter((i) => i.isPaid === paid).reduce((s, i) => s + Math.round(i.amount * 100), 0);
  return { pending: cents(false) / 100, paid: cents(true) / 100, count: items.length };
};

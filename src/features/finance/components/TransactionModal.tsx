"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { Button, Modal } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { useFinance } from "../data/FinanceDataProvider";
import { ME_ID, type FrequencyType, type PaymentMethodType, type Transaction, type TransactionType } from "../lib/types";
import {
  addMonths,
  addMonthsToDate,
  buildSplits,
  dateInMonth,
  invoiceMonthOf,
  isRefund,
  monthOf,
  splitAmounts,
  todayStr,
} from "../lib/finance";
import { brl, byName, dateBR, monthLabel, parseMoney } from "../lib/format";
import { FinIcon } from "./icons";
import { ErrorText, Field, FieldGroup, Hint, Person, Segmented, ui } from "./kit";

type SplitMode = "EQUAL" | "CUSTOM";
type EndMode = "ONGOING" | "UNTIL";
type Scope = "ALL" | "MONTH";

const toCents = (v: number) => Math.round(v * 100);
const moneyInput = (v: number) => v.toFixed(2).replace(".", ",");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  initialType?: TransactionType;
  /** Mês ("YYYY-MM") da ocorrência aberta para edição: em fixas, permite alterar só esse mês. */
  editingMonth?: string;
}

export function TransactionModal({ open, onClose, editing, initialType = "EXPENSE", editingMonth }: Props) {
  const { user } = useAuth();
  const d = useFinance();

  const [type, setType] = useState<TransactionType>(initialType);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [categoryId, setCategoryId] = useState("");
  const [methodType, setMethodType] = useState<PaymentMethodType>("BANK");
  const [methodId, setMethodId] = useState("");
  const [frequency, setFrequency] = useState<FrequencyType>("SINGLE");
  const [n, setN] = useState("2");
  const [people, setPeople] = useState<string[]>([ME_ID]);
  const [splitMode, setSplitMode] = useState<SplitMode>("EQUAL");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [barcode, setBarcode] = useState("");
  /** Cobrança: responsável que me deve o valor. */
  const [debtor, setDebtor] = useState("");
  const [endMode, setEndMode] = useState<EndMode>("ONGOING");
  const [endDate, setEndDate] = useState("");
  const [refund, setRefund] = useState(false);
  const [scope, setScope] = useState<Scope>("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeAccounts = byName(d.accounts.filter((a) => a.isActive));
  const activeCards = byName(d.cards.filter((c) => c.isActive));
  // Despesa nova começa no cartão de crédito; receita só entra em conta bancária; cobrança não tem método.
  const defaultMethod = (t: TransactionType): [PaymentMethodType, string] =>
    t === "EXPENSE" ? ["CARD", activeCards[0]?.id ?? ""] : t === "CHARGE" ? ["NONE", ""] : ["BANK", activeAccounts[0]?.id ?? ""];
  // Mês em que a ocorrência é cobrada: no cartão, o da fatura (mesma regra das ocorrências).
  const chargeMonthOf = (t: Pick<Transaction, "type" | "paymentMethodType" | "paymentMethodId">, at: string) => {
    const card =
      t.type === "EXPENSE" && t.paymentMethodType === "CARD" ? d.cards.find((c) => c.id === t.paymentMethodId) : undefined;
    return card ? invoiceMonthOf(card, at, d.overrides) : monthOf(at);
  };
  // `endMonth` salvo → data da última ocorrência cobrada nesse mês, para mostrar no campo de data.
  const lastChargeDateIn = (t: Transaction, ym: string) => {
    const day = Number(t.date.slice(8, 10));
    const hit = [ym, addMonths(ym, -1), addMonths(ym, 1)].map((cal) => dateInMonth(cal, day)).find((at) => chargeMonthOf(t, at) === ym);
    return hit ?? dateInMonth(ym, day);
  };

  // Fixa aberta a partir de uma ocorrência: pode alterar só aquele mês ou todos.
  const monthYm = editing?.frequency === "FIXED" && editingMonth ? editingMonth : null;
  const monthOnly = !!monthYm && scope === "MONTH";
  const monthOverride = monthYm ? editing?.occurrenceAmounts?.[monthYm] : undefined;

  // Preenche valor e divisão a partir de um valor e das partes salvas.
  const loadAmount = (total: number, splits: Transaction["splits"]) => {
    setAmount(String(total).replace(".", ","));
    setPeople(splits.map((s) => s.responsibleId));
    const equal = splitAmounts(total, splits.length || 1);
    const isCustom = splits.some((s, i) => toCents(s.amount) !== toCents(equal[i]));
    setSplitMode(isCustom ? "CUSTOM" : "EQUAL");
    setCustomAmounts(isCustom ? Object.fromEntries(splits.map((s) => [s.responsibleId, moneyInput(s.amount)])) : {});
  };
  const changeScope = (s: Scope) => {
    if (!editing || !monthYm) return;
    setScope(s);
    setError("");
    if (s === "MONTH") loadAmount(monthOverride ?? editing.totalAmount, editing.occurrenceSplits?.[monthYm] ?? editing.splits);
    else loadAmount(editing.totalAmount, editing.splits);
  };

  // Recarrega o formulário sempre que a modal abre (novo lançamento ou edição).
  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    setScope("ALL");
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setDate(editing.date);
      setCategoryId(editing.categoryId);
      setMethodType(editing.paymentMethodType);
      setMethodId(editing.paymentMethodId);
      setFrequency(editing.frequency);
      setN(String(editing.installmentsCount ?? 2));
      loadAmount(editing.totalAmount, editing.splits);
      setNotes(editing.notes ?? "");
      setBarcode(editing.barcode ?? "");
      setDebtor(editing.type === "CHARGE" ? (editing.splits.find((s) => s.responsibleId !== ME_ID)?.responsibleId ?? "") : "");
      setEndMode(editing.endMonth ? "UNTIL" : "ONGOING");
      setEndDate(editing.endMonth ? lastChargeDateIn(editing, editing.endMonth) : "");
      setRefund(isRefund(editing));
    } else {
      setType(initialType);
      setTitle("");
      setAmount("");
      setDate(todayStr());
      setCategoryId("");
      const [mt, mid] = defaultMethod(initialType);
      setMethodType(mt);
      setMethodId(mid);
      setRefund(false);
      setFrequency("SINGLE");
      setN("2");
      setPeople([ME_ID]);
      setSplitMode("EQUAL");
      setCustomAmounts({});
      setNotes("");
      setBarcode("");
      setDebtor("");
      setEndMode("ONGOING");
      setEndDate("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, editingMonth, initialType]);

  const categories = byName(d.categories.filter((c) => c.type === type && (c.isActive || c.id === categoryId)));
  const value = parseMoney(amount);
  const count = parseInt(n, 10);
  const isInstallment = frequency === "INSTALLMENT";
  const invoiceCard = type === "EXPENSE" && methodType === "CARD" ? d.cards.find((c) => c.id === methodId) : undefined;
  // Estorno: só em despesa única no cartão. Parcelas e fixas já salvas não viram estorno.
  const canRefund = type === "EXPENSE" && methodType === "CARD" && (!editing || editing.frequency === "SINGLE");
  const asRefund = canRefund && refund;
  const changeRefund = (v: boolean) => {
    setRefund(v);
    if (v) setFrequency("SINGLE");
  };
  const firstInvoice = invoiceCard && isDate(date) ? invoiceMonthOf(invoiceCard, date, d.overrides) : null;
  // Fixas: cobra as ocorrências com data até a data limite; a última define o `endMonth`.
  const canEnd = !!editing && frequency === "FIXED";
  const lastChargeDate = useMemo(() => {
    if (!canEnd || !isDate(date) || !isDate(endDate) || endDate < date) return null;
    const day = Number(date.slice(8, 10));
    const at = dateInMonth(monthOf(endDate), day);
    return at <= endDate ? at : dateInMonth(addMonths(monthOf(endDate), -1), day);
  }, [canEnd, date, endDate]);
  const endMonth = lastChargeDate ? chargeMonthOf({ type, paymentMethodType: methodType, paymentMethodId: methodId }, lastChargeDate) : null;
  const changeEndMode = (m: EndMode) => {
    setEndMode(m);
    if (m === "UNTIL" && !endDate) {
      const today = todayStr();
      setEndDate(isDate(date) && date > today ? date : today);
    }
  };

  const perPart = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!isInstallment || !(count >= 2)) return value;
    return splitAmounts(value, count)[0];
  }, [value, count, isInstallment]);
  const shareEach = people.length ? perPart / people.length : perPart;
  const isCustomSplit = type === "EXPENSE" && splitMode === "CUSTOM" && people.length > 1;
  const customParts = people.map((id) => toCents(parseMoney(customAmounts[id] ?? "")) / 100);
  const customDiff = Number.isFinite(value) ? toCents(value) - customParts.reduce((s, v) => s + toCents(v), 0) : 0;

  const changeType = (t: TransactionType) => {
    setType(t);
    setCategoryId("");
    setError("");
    if (t !== "EXPENSE") {
      setPeople([ME_ID]);
      setSplitMode("EQUAL");
    }
    // Cobrança é sempre um lançamento único.
    if (t === "CHARGE") {
      setFrequency("SINGLE");
      setRefund(false);
    }
    // Ao editar, mantém o método salvo se ele ainda vale para o novo tipo.
    if (t !== "EXPENSE" || !editing || methodType === "NONE") {
      const [mt, mid] = defaultMethod(t);
      setMethodType(mt);
      setMethodId(mid);
    }
  };
  const changeMethodType = (m: PaymentMethodType) => {
    setMethodType(m);
    // Boleto não tem método cadastrado: a conta é escolhida ao marcar como pago.
    setMethodId(m === "BOLETO" ? "" : ((m === "BANK" ? activeAccounts : activeCards)[0]?.id ?? ""));
  };
  const isBoleto = type === "EXPENSE" && methodType === "BOLETO";
  const isCharge = type === "CHARGE";
  const debtors = byName(d.responsibles);
  const barcodeData = isBoleto && barcode.trim() ? { barcode: barcode.trim() } : {};
  const togglePerson = (id: string) => setPeople((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const changeSplitMode = (m: SplitMode) => {
    setSplitMode(m);
    // Ao abrir o modo personalizado, parte da divisão igual para o usuário só ajustar.
    if (m === "CUSTOM" && Number.isFinite(value) && value > 0) {
      const parts = splitAmounts(value, people.length);
      setCustomAmounts(Object.fromEntries(people.map((id, i) => [id, moneyInput(parts[i])])));
    }
  };

  const fail = () => {
    setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    setSaving(false);
  };

  // Cobrança: valor todo do responsável, sem conta, cartão nem categoria. Ao editar, mantém o recebimento.
  const saveCharge = async () => {
    const fields = {
      type: "CHARGE" as const,
      title: title.trim(),
      totalAmount: value,
      date,
      categoryId: "",
      paymentMethodType: "NONE" as const,
      paymentMethodId: "",
      frequency: "SINGLE" as const,
      splits: buildSplits(value, [debtor], editing?.splits ?? []),
      notes: notes.trim(),
    };
    setSaving(true);
    try {
      if (editing) {
        const { endMonth: _e, isRefund: _r, barcode: _b, ...rest } = editing;
        void _e;
        void _r;
        void _b;
        await d.save("transactions", { ...rest, ...fields });
      } else {
        await d.save("transactions", { id: d.newId("transactions"), userId: user!.uid, createdAt: Date.now(), ...fields } as Transaction);
      }
      onClose();
    } catch {
      fail();
    }
  };

  const submit = async () => {
    setError("");
    if (!title.trim() && !monthOnly) return setError("Informe um título.");
    if (!Number.isFinite(value) || value <= 0) return setError("Informe um valor maior que zero.");
    if (isCharge) {
      if (!debtor)
        return setError(debtors.length ? "Escolha quem te deve esse valor." : "Cadastre a pessoa em Responsáveis para criar a cobrança.");
      return saveCharge();
    }
    if (!categoryId) return setError("Escolha uma categoria.");
    if (!methodId && !isBoleto)
      return setError(methodType === "BANK" ? "Cadastre uma conta em Finanças → Bancos." : "Cadastre um cartão em Finanças → Cartões.");
    if (asRefund && frequency !== "SINGLE") return setError("Estorno é sempre um lançamento único.");
    if (isInstallment && !editing && !(count >= 2 && count <= 60)) return setError("Parcelas devem ficar entre 2 e 60.");

    if (isCustomSplit) {
      if (customParts.some((v) => !Number.isFinite(v) || v <= 0)) return setError("Informe um valor maior que zero para cada responsável.");
      if (customDiff !== 0) return setError(`A soma dos valores por responsável precisa ser igual a ${brl(value)}.`);
    }

    if (monthOnly && editing && monthYm) {
      // Só este mês: guarda valor e divisão do mês; o lançamento fixo segue igual nos demais.
      const ids = type === "INCOME" || people.length === 0 ? [ME_ID] : people;
      const { [monthYm]: _prevAmount, ...otherAmounts } = editing.occurrenceAmounts ?? {};
      void _prevAmount;
      const occurrenceAmounts = toCents(value) === toCents(editing.totalAmount) ? otherAmounts : { ...otherAmounts, [monthYm]: value };
      const monthSplits = editing.occurrenceSplits?.[monthYm] ?? editing.splits;
      setSaving(true);
      try {
        await d.save("transactions", {
          ...editing,
          occurrenceAmounts,
          occurrenceSplits: {
            ...(editing.occurrenceSplits ?? {}),
            [monthYm]: buildSplits(value, ids, monthSplits, undefined, isCustomSplit ? customParts : undefined),
          },
        });
        onClose();
      } catch {
        fail();
      }
      return;
    }

    if (canEnd && endMode === "UNTIL") {
      if (!isDate(endDate)) return setError("Informe a data limite da cobrança.");
      if (!endMonth) return setError(`A data limite não pode ser antes da 1ª cobrança (${dateBR(date)}).`);
    }

    const ids = type === "INCOME" || people.length === 0 ? [ME_ID] : people;
    const shares = isCustomSplit ? customParts : undefined;
    setSaving(true);
    try {
      if (editing) {
        // Campos opcionais que deixaram de valer saem do documento.
        const { endMonth: _prevEnd, isRefund: _prevRefund, barcode: _prevBarcode, ...rest } = editing;
        void _prevEnd;
        void _prevRefund;
        void _prevBarcode;
        const next: Transaction = {
          ...rest,
          ...(canEnd && endMode === "UNTIL" && endMonth ? { endMonth } : {}),
          ...(asRefund ? { isRefund: true } : {}),
          ...barcodeData,
          type,
          title: title.trim(),
          totalAmount: value,
          date,
          categoryId,
          paymentMethodType: methodType,
          paymentMethodId: methodId,
          splits: buildSplits(value, ids, editing.splits, undefined, shares),
          notes: notes.trim(),
        };
        await d.save("transactions", next);
      } else {
        const base = {
          userId: user!.uid,
          type,
          title: title.trim(),
          categoryId,
          paymentMethodType: methodType,
          paymentMethodId: methodId,
          notes: notes.trim(),
          createdAt: Date.now(),
          ...(asRefund ? { isRefund: true } : {}),
          ...barcodeData,
        };
        if (isInstallment) {
          // Valores personalizados referem-se ao total da compra: parcela a parte de cada um.
          const perPerson = shares?.map((v) => splitAmounts(v, count));
          const parts = perPerson
            ? Array.from({ length: count }, (_, i) => perPerson.reduce((sum, pp) => sum + toCents(pp[i]), 0) / 100)
            : splitAmounts(value, count);
          const groupId = d.newId("transactions");
          const items: Transaction[] = parts.map((p, i) => ({
            ...base,
            id: i === 0 ? groupId : d.newId("transactions"),
            totalAmount: p,
            purchaseTotal: value,
            date: addMonthsToDate(date, i),
            frequency,
            installmentsCount: count,
            currentInstallment: i + 1,
            parentTransactionId: groupId,
            splits: buildSplits(p, ids, [], undefined, perPerson?.map((pp) => pp[i])),
          }));
          await d.saveMany("transactions", items);
        } else {
          await d.save("transactions", {
            ...base,
            id: d.newId("transactions"),
            totalAmount: value,
            date,
            frequency,
            splits: buildSplits(value, ids, [], undefined, shares),
          } as Transaction);
        }
      }
      onClose();
    } catch {
      fail();
    }
  };

  const persons = [{ id: ME_ID, name: "Eu", avatarUrl: undefined as string | undefined }, ...d.responsibles];

  const freqOptions: { value: FrequencyType; label: string }[] = [
    { value: "SINGLE", label: "Única" },
    { value: "FIXED", label: "Fixa mensal" },
    { value: "INSTALLMENT", label: "Parcelada" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        monthOnly
          ? `${title} — ${monthLabel(monthYm!)}`
          : editing
            ? isCharge
              ? "Editar cobrança"
              : asRefund
                ? "Editar estorno"
                : "Editar lançamento"
            : "Novo lançamento"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            {editing ? "Salvar alterações" : "Salvar lançamento"}
          </Button>
        </>
      }
    >
      <form
        className={ui.stack}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {monthYm && (
          <FieldGroup
            label="Aplicar alteração em"
            hint={
              monthOnly
                ? `Muda só o valor${type === "EXPENSE" ? " e a divisão" : ""} de ${monthLabel(monthYm).toLowerCase()}. Os outros meses continuam com ${brl(editing!.totalAmount)}.`
                : monthOverride !== undefined
                  ? `${monthLabel(monthYm)} tem valor próprio (${brl(monthOverride)}) e continua com ele.`
                  : "Vale para todas as repetições, exceto meses com valor próprio."
            }
          >
            <Segmented
              value={scope}
              onChange={changeScope}
              options={[
                { value: "ALL", label: "Todos os meses" },
                { value: "MONTH", label: `Só ${monthLabel(monthYm).toLowerCase()}` },
              ]}
            />
          </FieldGroup>
        )}

        {/* Cobrança salva não vira despesa/receita (e vice-versa): ao editar, só troca entre despesa e receita. */}
        {!monthOnly && !(editing && editing.type === "CHARGE") && (
          <Segmented
            label="Tipo"
            value={type}
            onChange={changeType}
            options={[
              { value: "EXPENSE", label: "Despesa" },
              { value: "INCOME", label: "Receita" },
              ...(editing ? [] : [{ value: "CHARGE" as const, label: "Cobrança" }]),
            ]}
          />
        )}
        {isCharge && (
          <Hint>
            Valor que alguém te deve, sem conta nem cartão. Fica a receber até você marcar como recebido e escolher a conta onde
            caiu.
          </Hint>
        )}

        <div className={ui.grid2}>
          {!monthOnly && (
            <Field label="Título">
              <input
                className={ui.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isCharge ? "Ex.: Empréstimo para a Ana" : asRefund ? "Ex.: Estorno da compra na loja X" : "Ex.: Mercado da semana"}
                autoFocus
              />
            </Field>
          )}
          <Field
            label={
              monthOnly
                ? `Valor em ${monthLabel(monthYm!).toLowerCase()} (R$)`
                : asRefund
                  ? "Valor estornado (R$)"
                  : isInstallment && !editing
                    ? "Valor total da compra (R$)"
                    : isInstallment
                      ? "Valor da parcela (R$)"
                      : "Valor (R$)"
            }
            hint={
              isInstallment && !editing && count >= 2 && perPart > 0
                ? `${count}× de ${brl(perPart)}`
                : monthOnly && monthOverride !== undefined
                  ? `Para voltar ao padrão, informe ${brl(editing!.totalAmount)}.`
                  : undefined
            }
          >
            <input className={ui.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </Field>
          {!monthOnly && (
            <>
              <Field
                label={asRefund ? "Data do estorno" : isInstallment && !editing ? "Data da compra" : "Data"}
                hint={
                  firstInvoice && asRefund
                    ? `Abate da fatura de ${monthLabel(firstInvoice).toLowerCase()}.`
                    : firstInvoice && !(editing && isInstallment)
                      ? `${isInstallment ? "1ª parcela na fatura" : frequency === "FIXED" ? "1ª cobrança na fatura" : "Entra na fatura"} de ${monthLabel(firstInvoice).toLowerCase()}.`
                      : undefined
                }
              >
                <input className={ui.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              {isCharge ? (
                <Field label="Quem te deve" hint={debtors.length ? undefined : "Cadastre a pessoa em Finanças → Responsáveis."}>
                  <select className={ui.select} value={debtor} onChange={(e) => setDebtor(e.target.value)}>
                    <option value="">Selecione…</option>
                    {debtors.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Categoria">
                  <select className={ui.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}
        </div>

        {!monthOnly && !isCharge && (
          <div className={ui.grid2}>
            <FieldGroup label="Método de pagamento">
              <div className={ui.stackTight}>
                {type === "EXPENSE" && (
                  <Segmented
                    label="Método de pagamento"
                    value={methodType}
                    onChange={changeMethodType}
                    options={[
                      { value: "BANK", label: "Conta" },
                      { value: "CARD", label: "Cartão" },
                      { value: "BOLETO", label: "Boleto" },
                    ]}
                  />
                )}
                {isBoleto ? (
                  <>
                    <input
                      className={ui.input}
                      inputMode="numeric"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Código de barras (opcional)"
                      aria-label="Código de barras do boleto"
                    />
                    <Hint>Fica a pagar até você marcar como pago; aí você escolhe de qual conta sai o dinheiro.</Hint>
                  </>
                ) : (
                  <select
                    className={ui.select}
                    value={methodId}
                    onChange={(e) => setMethodId(e.target.value)}
                    aria-label={methodType === "BANK" ? "Conta" : "Cartão"}
                  >
                    <option value="">Selecione…</option>
                    {(methodType === "BANK" ? activeAccounts : activeCards).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                {canRefund && (
                  <Segmented
                    label="Compra ou estorno"
                    value={asRefund ? "REFUND" : "PURCHASE"}
                    onChange={(v) => changeRefund(v === "REFUND")}
                    options={[
                      { value: "PURCHASE", label: "Compra" },
                      { value: "REFUND", label: "Estorno" },
                    ]}
                  />
                )}
                {asRefund && <Hint>O valor é creditado no cartão e abate a fatura.</Hint>}
              </div>
            </FieldGroup>
            <FieldGroup label="Periodicidade">
              <div className={ui.stackTight}>
                {asRefund ? (
                  <Hint>Estorno é sempre um lançamento único.</Hint>
                ) : (
                  <Segmented label="Periodicidade" value={frequency} onChange={(f) => !editing && setFrequency(f)} options={freqOptions} />
                )}
                {isInstallment && !editing && (
                  <input
                    className={ui.input}
                    type="number"
                    min={2}
                    max={60}
                    value={n}
                    onChange={(e) => setN(e.target.value)}
                    aria-label="Número de parcelas"
                    placeholder="Nº de parcelas"
                  />
                )}
                {editing && !asRefund && <Hint>A periodicidade não pode ser alterada depois de salvar.</Hint>}
              </div>
            </FieldGroup>
          </div>
        )}

        {type === "EXPENSE" && (
          <FieldGroup
            label={asRefund ? "Devolver a parte de" : "Dividir com"}
            hint={
              people.length <= 1
                ? asRefund
                  ? "Marque quem dividiu a compra estornada: a parte de cada um é abatida."
                  : "Marque quem divide esta despesa com você."
                : undefined
            }
          >
            <div className={ui.chips}>
              {persons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={cn(ui.chip, people.includes(r.id) && ui.chipOn)}
                  aria-pressed={people.includes(r.id)}
                  onClick={() => togglePerson(r.id)}
                >
                  <Person name={r.name} url={r.avatarUrl} />
                  {r.name}
                </button>
              ))}
              {d.responsibles.length === 0 && (
                <Hint>
                  <FinIcon name="tag" size={12} /> Cadastre pessoas em Finanças → Responsáveis para dividir gastos.
                </Hint>
              )}
            </div>
          </FieldGroup>
        )}

        {type === "EXPENSE" && people.length > 1 && (
          <FieldGroup label="Como dividir">
            <Segmented
              label="Como dividir"
              value={splitMode}
              onChange={changeSplitMode}
              options={[
                { value: "EQUAL", label: "Igualmente" },
                { value: "CUSTOM", label: "Valores diferentes" },
              ]}
            />
            {isCustomSplit ? (
              <>
                <div className={ui.splitList}>
                  {people.map((id) => {
                    const r = persons.find((x) => x.id === id);
                    if (!r) return null;
                    return (
                      <div key={id} className={ui.splitRow}>
                        <Person name={r.name} url={r.avatarUrl} />
                        <span className={ui.splitName}>{r.name}</span>
                        <input
                          className={cn(ui.input, ui.splitInput)}
                          inputMode="decimal"
                          placeholder="0,00"
                          aria-label={`Valor de ${r.name}`}
                          value={customAmounts[id] ?? ""}
                          onChange={(e) => setCustomAmounts((c) => ({ ...c, [id]: e.target.value }))}
                        />
                      </div>
                    );
                  })}
                </div>
                <Hint warn={value > 0 && customDiff !== 0}>
                  {isInstallment && !editing ? "Valores sobre o total da compra. " : isInstallment ? "Valores por parcela. " : ""}
                  {!(value > 0)
                    ? "Informe o valor da despesa."
                    : customDiff === 0
                      ? `A soma confere com ${brl(value)}.`
                      : customDiff > 0
                        ? `Faltam ${brl(customDiff / 100)} para fechar ${brl(value)}.`
                        : `Passou ${brl(-customDiff / 100)} do total de ${brl(value)}.`}
                </Hint>
              </>
            ) : (
              perPart > 0 && (
                <Hint>
                  Cada um fica com {brl(shareEach)}
                  {isInstallment ? " por parcela" : ""}.
                </Hint>
              )
            )}
          </FieldGroup>
        )}

        {canEnd && !monthOnly && (
          <FieldGroup
            label="Cobrança"
            warn={endMode === "UNTIL" && isDate(endDate) && !endMonth}
            hint={
              endMode !== "UNTIL"
                ? "Repete todo mês até você definir uma data limite."
                : !isDate(endDate)
                  ? "Informe a data limite da cobrança."
                  : lastChargeDate && endMonth
                    ? `Última cobrança em ${dateBR(lastChargeDate)}${invoiceCard ? `, na fatura de ${monthLabel(endMonth).toLowerCase()}` : ""}. Depois disso não entra mais; o histórico é mantido.`
                    : `A data limite não pode ser antes da 1ª cobrança (${dateBR(date)}).`
            }
          >
            <Segmented
              label="Cobrança"
              value={endMode}
              onChange={changeEndMode}
              options={[
                { value: "ONGOING", label: "Sem data para acabar" },
                { value: "UNTIL", label: "Parar de cobrar" },
              ]}
            />
            {endMode === "UNTIL" && (
              <input
                className={ui.input}
                type="date"
                min={isDate(date) ? date : undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Data limite da cobrança"
              />
            )}
          </FieldGroup>
        )}

        {!monthOnly && (
          <Field label="Observações">
            <textarea className={ui.textarea} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeftRight, Check, ChevronDown, Eye, EyeOff, FileSpreadsheet, Plus, Search, Settings, SlidersHorizontal, X } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Button, Card, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { useFinance } from "./data/FinanceDataProvider";
import { ME_ID, SETTINGS_ID, type FrequencyType, type Occurrence, type Transaction, type TransactionType } from "./lib/types";
import { addDays, addMonths, dateInMonth, diffDays, monthOf, todayStr } from "./lib/finance";
import { brl, byName, dateBR, monthLabel } from "./lib/format";
import { exportOccurrences } from "./lib/exportSheet";
import { Field, FieldGroup, MonthPicker, Segmented, ui } from "./components/kit";
import { TxList, nextTxSort, sortTx, type TxSort } from "./components/TxList";
import { TransactionModal } from "./components/TransactionModal";
import { BudgetSettingsModal, DeleteTransactionModal, PayBoletoModal, ReceiveChargeModal } from "./components/OccurrenceModals";
import styles from "./TransactionsView.module.scss";

// Busca sem diferenciar maiúsculas nem acentos.
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Fecha um painel suspenso ao clicar fora dele ou apertar Esc. */
function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}

/** Tabela em telas largas; lista em cards no celular. */
function useWide(query = "(min-width: 900px)") {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return wide;
}

export function TransactionsView() {
  const d = useFinance();
  const wide = useWide();
  // Abre sempre no mês seguinte ao atual (ex.: em outubro, abre em novembro).
  const [ym, setYm] = useState(() => addMonths(monthOf(todayStr()), 1));
  const [fType, setFType] = useState<"ALL" | TransactionType>("ALL");
  const [fCat, setFCat] = useState("");
  const [fMethod, setFMethod] = useState("");
  const [fResp, setFResp] = useState("");
  const [fFreq, setFFreq] = useState<"" | FrequencyType>("");
  // Busca por texto: título, observação, categoria e método.
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  // Período dentro do mês selecionado (no máximo o mês inteiro, logo ≤ 31 dias).
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const monthStart = `${ym}-01`;
  const monthEnd = dateInMonth(ym, 31);
  // O período pode começar em meses anteriores, mas termina no máximo no fim do mês da tela e tem até 31 dias.
  const normalize = (rawFrom: string, rawTo: string): [string, string] => {
    const valid = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" ? (v > monthEnd ? monthEnd : v) : "");
    let f = valid(rawFrom);
    let t = valid(rawTo);
    if (f && t && t < f) t = f;
    if (f && !t && f < monthStart) t = addDays(f, 30) < monthEnd ? addDays(f, 30) : monthEnd;
    if (!f && t && t < monthStart) f = t;
    if (f && t && diffDays(f, t) > 30) f = addDays(t, -30);
    return [f, t];
  };
  // Enquanto digita, filtra pelo valor já corrigido; ao sair do campo, corrige o que aparece.
  const [from, to] = normalize(fFrom, fTo);
  const withinMonth = (!from || from >= monthStart) && (!to || to >= monthStart);
  const fixRange = () => {
    setFFrom(from);
    setFTo(to);
  };

  // Selects e período ficam num painel suspenso aberto pelo botão "Filtros".
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const closeFilters = useMemo(() => () => setFiltersOpen(false), []);
  useDismiss(filtersOpen, filtersRef, closeFilters);
  const activeFilters = [fCat, fMethod, fResp, fFreq].filter(Boolean).length + (fFrom || fTo ? 1 : 0);
  const clearFilters = () => {
    setFCat("");
    setFMethod("");
    setFResp("");
    setFFreq("");
    setFFrom("");
    setFTo("");
  };

  const [modal, setModal] = useState<{ open: boolean; editing: Transaction | null; type: TransactionType; month?: string }>({
    open: false,
    editing: null,
    type: "EXPENSE",
  });
  const [toDelete, setToDelete] = useState<Occurrence | null>(null);
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const [receiving, setReceiving] = useState<Occurrence | null>(null);
  // Começa do dia mais recente ao mais antigo; clicar em Lançamento, Data ou Valor reordena.
  const [sort, setSort] = useState<TxSort>({ key: "date", dir: "desc" });

  const items = useMemo(
    () =>
      sortTx(
        d.occurrences
          .filter((o) => o.monthYear === ym)
          .filter((o) => fType === "ALL" || o.tx.type === fType)
          .filter((o) => !fCat || o.tx.categoryId === fCat)
          .filter((o) => !fMethod || `${o.tx.paymentMethodType}:${o.tx.paymentMethodId}` === fMethod)
          .filter((o) => !fResp || o.splits.some((s) => s.responsibleId === fResp))
          .filter((o) => !fFreq || o.tx.frequency === fFreq)
          .filter(
            (o) =>
              !q ||
              fold([o.tx.title, o.tx.notes ?? "", d.catById(o.tx.categoryId)?.name ?? "", d.methodOf(o.tx).name].join(" ")).includes(q),
          )
          // Período dentro do mês da tela: compara pelo número do dia, para compras no cartão de mês
          // anterior (que caem nesta fatura) aparecerem quando o dia delas está no período.
          // Período que começa em mês anterior: compara pela data completa.
          .filter((o) => {
            if (!withinMonth) return o.date >= from && o.date <= to;
            const day = o.date.slice(8, 10);
            return (!from || day >= from.slice(8, 10)) && (!to || day <= to.slice(8, 10));
          }),
        sort,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.occurrences, d.categories, d.accounts, d.cards, ym, fType, fCat, fMethod, fResp, fFreq, q, from, to, withinMonth, sort],
  );

  // Com um responsável filtrado, os totais somam só a parte dele em cada lançamento.
  const share = (o: Occurrence) => (fResp ? (o.splits.find((s) => s.responsibleId === fResp)?.amount ?? 0) : o.amount);
  const inc = items.filter((o) => o.tx.type === "INCOME").reduce((s, o) => s + share(o), 0);
  const exp = items.filter((o) => o.tx.type === "EXPENSE").reduce((s, o) => s + share(o), 0);
  const respLabel = fResp === ME_ID ? "sua parte" : fResp ? `parte de ${d.respName(fResp)}` : "";

  // Exportação: com filtros ativos, oferece exportar o recorte filtrado ou o mês inteiro.
  const filterLabels = [
    q && `Busca: “${query.trim()}”`,
    fType !== "ALL" && `Tipo: ${fType === "EXPENSE" ? "Despesas" : fType === "INCOME" ? "Receitas" : "Cobranças"}`,
    fCat && `Categoria: ${d.catById(fCat)?.name ?? "—"}`,
    fMethod &&
      `Método: ${fMethod === "BOLETO:" ? "Boleto" : ([...d.accounts, ...d.cards].find((m) => fMethod.endsWith(`:${m.id}`))?.name ?? "—")}`,
    fResp && `Responsável: ${d.respName(fResp)}`,
    fFreq && `Periodicidade: ${{ FIXED: "Fixa mensal", INSTALLMENT: "Parcelada", SINGLE: "Única" }[fFreq]}`,
    (from || to) && `Período: ${from ? dateBR(from) : "início"} até ${to ? dateBR(to) : "fim do mês"}`,
  ].filter(Boolean) as string[];
  const allMonth = useMemo(() => sortTx(d.occurrences.filter((o) => o.monthYear === ym), sort), [d.occurrences, ym, sort]);

  // Gasto mensal esperado: limite da minha parte ("Eu") nas despesas do mês inteiro, sem filtros.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const budget = d.settings[SETTINGS_ID]?.monthlyBudget ?? 0;
  const mySpent = allMonth
    .filter((o) => o.tx.type === "EXPENSE")
    .reduce((s, o) => s + o.splits.filter((sp) => sp.responsibleId === ME_ID).reduce((a, sp) => a + sp.amount, 0), 0);
  const budgetPct = budget > 0 ? (mySpent / budget) * 100 : 0;
  const budgetTone = budgetPct > 90 ? styles.barDanger : budgetPct >= 70 ? styles.barWarn : styles.barOk;
  const available = budget - mySpent;

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const closeExport = useMemo(() => () => setExportOpen(false), []);
  useDismiss(exportOpen, exportRef, closeExport);

  // Modo de verificação: marca lançamentos conferidos; ao salvar, a marcação fica guardada para o mês.
  const [verifying, setVerifying] = useState(false);
  const [draft, setDraft] = useState<{ ym: string; keys: Set<string> } | null>(null);
  const [savingCheck, setSavingCheck] = useState(false);
  const savedKeys = useMemo(() => new Set(d.checks[ym]?.keys ?? []), [d.checks, ym]);
  const checkedKeys = draft?.ym === ym ? draft.keys : savedKeys;
  const dirty = draft?.ym === ym && (draft.keys.size !== savedKeys.size || [...draft.keys].some((k) => !savedKeys.has(k)));
  const confirmDiscard = () => !dirty || window.confirm("Há marcações não salvas neste mês. Descartar?");
  const toggleCheck = (o: Occurrence) => {
    const next = new Set(checkedKeys);
    if (next.has(o.key)) next.delete(o.key);
    else next.add(o.key);
    setDraft({ ym, keys: next });
  };
  const toggleVerifying = () => {
    if (verifying && !confirmDiscard()) return;
    setDraft(null);
    setVerifying((v) => !v);
  };
  const saveChecks = async () => {
    setSavingCheck(true);
    try {
      // Guarda só chaves de lançamentos que ainda existem no mês.
      const monthKeys = new Set(allMonth.map((o) => o.key));
      await d.save("checks", { id: ym, keys: [...checkedKeys].filter((k) => monthKeys.has(k)), updatedAt: Date.now() });
      setDraft(null);
    } finally {
      setSavingCheck(false);
    }
  };
  const checkedShown = items.filter((o) => checkedKeys.has(o.key)).length;

  const changeMonth = (m: string) => {
    if (!confirmDiscard()) return;
    setDraft(null);
    setYm(m);
    setFFrom("");
    setFTo("");
  };

  const doExport = async (filtered: boolean) => {
    setExportOpen(false);
    setExporting(true);
    try {
      await exportOccurrences(d, {
        fileName: `lancamentos-${ym}${filtered && filterLabels.length ? "-filtrado" : ""}`,
        items: filtered ? items : allMonth,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={ArrowLeftRight}
        title="Lançamentos"
        description="Entradas e despesas do mês. Compras no cartão entram no mês da fatura."
        actions={
          <>
            <MonthPicker value={ym} onChange={changeMonth} />
            <Button icon={Plus} onClick={() => setModal({ open: true, editing: null, type: "EXPENSE" })}>
              Lançamento
            </Button>
            {filterLabels.length === 0 ? (
              <Button variant="outline" icon={FileSpreadsheet} loading={exporting} disabled={allMonth.length === 0} onClick={() => doExport(false)}>
              </Button>
            ) : (
              <div className={styles.dropdown} ref={exportRef}>
                <Button
                  variant="outline"
                  icon={FileSpreadsheet}
                  iconRight={ChevronDown}
                  loading={exporting}
                  onClick={() => setExportOpen((o) => !o)}
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                >
                </Button>
                {exportOpen && (
                  <div className={cn(styles.panel, styles.panelMenu)} role="menu">
                    <button type="button" role="menuitem" className={styles.menuitem} onClick={() => doExport(true)} disabled={items.length === 0}>
                      <strong>Com os filtros aplicados</strong>
                      <span>
                        {items.length} lançamento(s) · {filterLabels.join(" · ")}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuitem}
                      onClick={() => doExport(false)}
                      disabled={allMonth.length === 0}
                    >
                      <strong>Mês completo, sem filtros</strong>
                      <span>
                        {allMonth.length} lançamento(s) de {monthLabel(ym)}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
            <IconButton icon={Settings} label="Configurações" variant="outline" onClick={() => setSettingsOpen(true)} />
          </>
        }
      />

      <Card padding="lg" className={styles.card}>
        <div className={styles.filters}>
          <Segmented
            label="Tipo de lançamento"
            value={fType}
            onChange={setFType}
            options={[
              { value: "ALL", label: "Tudo" },
              { value: "EXPENSE", label: "Despesas" },
              { value: "INCOME", label: "Receitas" },
              { value: "CHARGE", label: "Cobranças" },
            ]}
          />
          <div className={styles.searchbox}>
            <Search size={16} className={styles.searchIcon} aria-hidden />
            <input
              className={cn(ui.input, styles.searchInput)}
              type="search"
              placeholder="Buscar lançamento…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              aria-label="Buscar lançamentos"
            />
            {query && (
              <button type="button" className={styles.searchClear} onClick={() => setQuery("")} aria-label="Limpar busca">
                <X size={14} />
              </button>
            )}
          </div>
          <Button
            variant={verifying ? "secondary" : "outline"}
            icon={verifying ? EyeOff : Eye}
            onClick={toggleVerifying}
            aria-pressed={verifying}
            title={verifying ? "Sair do modo de verificação" : "Conferir lançamentos"}
          >
            {verifying ? "Sair da verificação" : "Verificar"}
          </Button>
          <div className={styles.dropdown} ref={filtersRef}>
            <Button
              variant={activeFilters > 0 ? "secondary" : "outline"}
              icon={SlidersHorizontal}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
            >
              Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </Button>
            {filtersOpen && (
              <div className={styles.panel} role="dialog" aria-label="Filtros">
                <Field label="Categoria">
                  <select className={ui.select} value={fCat} onChange={(e) => setFCat(e.target.value)}>
                    <option value="">Todas as categorias</option>
                    {byName(d.categories).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Método de pagamento">
                  <select className={ui.select} value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
                    <option value="">Todos os métodos</option>
                    {byName([
                      ...d.accounts.map((a) => ({ value: `BANK:${a.id}`, name: a.name })),
                      ...d.cards.map((c) => ({ value: `CARD:${c.id}`, name: `${c.name} (cartão)` })),
                      { value: "BOLETO:", name: "Boleto" },
                    ]).map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Responsável">
                  <select className={ui.select} value={fResp} onChange={(e) => setFResp(e.target.value)}>
                    <option value="">Todos os responsáveis</option>
                    <option value={ME_ID}>Eu</option>
                    {byName(d.responsibles).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Periodicidade">
                  <select className={ui.select} value={fFreq} onChange={(e) => setFFreq(e.target.value as "" | FrequencyType)}>
                    <option value="">Todas as periodicidades</option>
                    <option value="FIXED">Fixa mensal</option>
                    <option value="INSTALLMENT">Parcelada</option>
                    <option value="SINGLE">Única</option>
                  </select>
                </Field>
                <FieldGroup label="Período">
                  <span className={styles.daterange}>
                    <input
                      className={ui.input}
                      type="date"
                      value={fFrom}
                      max={to || monthEnd}
                      onChange={(e) => setFFrom(e.target.value)}
                      onBlur={fixRange}
                      aria-label="Data inicial"
                    />
                    <span>até</span>
                    <input
                      className={ui.input}
                      type="date"
                      value={fTo}
                      min={from || undefined}
                      max={monthEnd}
                      onChange={(e) => setFTo(e.target.value)}
                      onBlur={fixRange}
                      aria-label="Data final"
                    />
                  </span>
                </FieldGroup>
                <div className={styles.panelFoot}>
                  <Button variant="ghost" size="sm" icon={X} onClick={clearFilters} disabled={activeFilters === 0}>
                    Limpar filtros
                  </Button>
                  <Button size="sm" onClick={() => setFiltersOpen(false)}>
                    Ver lançamentos
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.totals}>
          <span>
            Entradas <strong className={styles.in}>{brl(inc)}</strong>
          </span>
          <span>
            Saídas <strong className={styles.out}>{brl(exp)}</strong>
          </span>
          <span>
            Resultado <strong>{brl(inc - exp)}</strong>
          </span>
          {respLabel && <span className={styles.note}>Totais considerando só a {respLabel}.</span>}
        </div>

        {budget > 0 ? (
          <div className={styles.budget}>
            <div className={styles.budgetInfo}>
              <span>
                Limite atingido (sua parte) <strong>{Math.round(budgetPct)}%</strong>
              </span>
              <span>
                Gasto <strong className={styles.out}>{brl(mySpent)}</strong>
              </span>
              <span>
                Disponível <strong className={available < 0 ? styles.out : styles.in}>{brl(available)}</strong>
              </span>
              <span>
                Limite <strong>{brl(budget)}</strong>
              </span>
            </div>
            <div
              className={styles.progress}
              role="progressbar"
              aria-label="Limite de gastos atingido"
              aria-valuenow={Math.round(budgetPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={cn(styles.bar, budgetTone)} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
            </div>
          </div>
        ) : (
          <button type="button" className={styles.budgetEmpty} onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> Defina o gasto mensal esperado para acompanhar quanto da sua parte já foi usado.
          </button>
        )}

        {verifying && (
          <div className={styles.verifybar} role="status">
            <Check size={16} />
            <span>
              <strong>{checkedShown}</strong> de {items.length} lançamento(s) conferido(s)
              {dirty ? " · alterações não salvas" : savedKeys.size ? " · salvo" : ""}
            </span>
            <span className={styles.verifyActions}>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={!dirty || savingCheck}>
                Descartar
              </Button>
              <Button size="sm" onClick={saveChecks} loading={savingCheck} disabled={!dirty}>
                Salvar verificação
              </Button>
            </span>
          </div>
        )}

        <TxList
          items={items}
          mode={wide ? "table" : "list"}
          checked={verifying ? checkedKeys : undefined}
          onToggleCheck={verifying ? toggleCheck : undefined}
          sort={sort}
          onSort={(k) => setSort((s) => nextTxSort(s, k))}
          onEdit={(o) => setModal({ open: true, editing: o.tx, type: o.tx.type, month: o.monthYear })}
          onDelete={setToDelete}
          onTogglePaid={verifying ? undefined : (o, paid) => (paid ? setPaying(o) : d.setOccPaid(o, false))}
          onToggleReceived={
            verifying
              ? undefined
              : (o, received) =>
                  received
                    ? setReceiving(o)
                    : d.settleSplits(
                        o.splits.filter((s) => s.responsibleId !== ME_ID).map((s) => ({ occ: o, responsibleId: s.responsibleId })),
                        null,
                        false,
                      )
          }
          emptyText="Nenhum lançamento com esses filtros neste mês."
        />
      </Card>

      <TransactionModal
        open={modal.open}
        editing={modal.editing}
        editingMonth={modal.month}
        initialType={modal.type}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
      />
      <DeleteTransactionModal occ={toDelete} onClose={() => setToDelete(null)} />
      <PayBoletoModal occ={paying} onClose={() => setPaying(null)} />
      <ReceiveChargeModal occ={receiving} onClose={() => setReceiving(null)} />
      <BudgetSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

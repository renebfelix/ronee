"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import {
  ME_ID,
  type BankAccount,
  type Category,
  type CreditCard,
  type MonthCheck,
  type Occurrence,
  type OverrideMap,
  type Responsible,
  type ResponsibleSplit,
  type Transaction,
  type UserSettings,
} from "../lib/types";
import { addMonths, buildOccurrences, computeBalances, invoiceMonthOf, monthOf, todayStr } from "../lib/finance";

/**
 * Coleções do módulo de Finanças. Ficam em `users/{uid}/modules/finance/{coleção}`,
 * separadas dos outros módulos da plataforma.
 */
export type FinanceCol = "accounts" | "cards" | "categories" | "responsibles" | "transactions" | "overrides" | "checks" | "settings";

const COLS: FinanceCol[] = ["accounts", "cards", "categories", "responsibles", "transactions", "overrides", "checks", "settings"];

interface Raw {
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  responsibles: Responsible[];
  transactions: Transaction[];
  overrides: OverrideMap;
  /** Verificações por mês (id = YYYY-MM). */
  checks: Record<string, MonthCheck>;
  /** Preferências do usuário (id = SETTINGS_ID). */
  settings: Record<string, UserSettings>;
}

const EMPTY: Raw = {
  accounts: [],
  cards: [],
  categories: [],
  responsibles: [],
  transactions: [],
  overrides: {},
  checks: {},
  settings: {},
};

export interface MethodInfo {
  name: string;
  color: string;
  icon: string;
}

export interface FinanceData extends Raw {
  occurrences: Occurrence[];
  balances: Record<string, number>;
  catById: (id: string) => Category | undefined;
  respName: (id: string) => string;
  respById: (id: string) => Responsible | undefined;
  methodOf: (tx: Transaction) => MethodInfo;
  newId: (col: FinanceCol) => string;
  save: <T extends { id: string }>(col: FinanceCol, item: T) => Promise<void>;
  saveMany: <T extends { id: string }>(col: FinanceCol, items: T[]) => Promise<void>;
  remove: (col: FinanceCol, id: string) => Promise<void>;
  removeMany: (col: FinanceCol, ids: string[]) => Promise<void>;
  /** Dá baixa (ou desfaz) em partes de responsáveis. Fixas guardam a baixa por mês. */
  settleSplits: (items: { occ: Occurrence; responsibleId: string }[], accountId: string | null, paid: boolean) => Promise<void>;
  /** Marca (ou desmarca) um boleto como pago, com a conta de onde sai o dinheiro. Fixas guardam por mês. */
  setOccPaid: (occ: Occurrence, paid: boolean, fromAccountId?: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceData | null>(null);

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Alimentação", type: "EXPENSE", color: "#F97316", icon: "utensils", isActive: true },
  { name: "Moradia", type: "EXPENSE", color: "#3A3DE8", icon: "home", isActive: true },
  { name: "Transporte", type: "EXPENSE", color: "#0F8FD6", icon: "car", isActive: true },
  { name: "Saúde", type: "EXPENSE", color: "#E23D4B", icon: "heart-pulse", isActive: true },
  { name: "Lazer", type: "EXPENSE", color: "#8E44EC", icon: "gamepad-2", isActive: true },
  { name: "Compras", type: "EXPENSE", color: "#E0558F", icon: "shopping-bag", isActive: true },
  { name: "Educação", type: "EXPENSE", color: "#14B8A6", icon: "graduation-cap", isActive: true },
  { name: "Contas e serviços", type: "EXPENSE", color: "#E8A317", icon: "zap", isActive: true },
  { name: "Salário", type: "INCOME", color: "#0E9F83", icon: "briefcase", isActive: true },
  { name: "Investimentos", type: "INCOME", color: "#84CC16", icon: "trending-up", isActive: true },
  { name: "Outras receitas", type: "INCOME", color: "#06B6D4", icon: "circle-dollar-sign", isActive: true },
];

/** O Firestore não aceita `undefined`: remove essas chaves (inclusive em objetos aninhados). */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, clean(v)]),
    ) as T;
  }
  return value;
}

/** Dados do módulo de Finanças em tempo real. Envolve todas as rotas em /financas. */
export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);
  const seeded = useRef(false);

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "finance"), [uid]);
  const colRef = useCallback((name: FinanceCol) => collection(moduleDoc(), name), [moduleDoc]);
  const docRef = useCallback((name: FinanceCol, id: string) => doc(moduleDoc(), name, id), [moduleDoc]);

  /* Assinaturas em tempo real */
  useEffect(() => {
    const unsubs = COLS.map((name) =>
      onSnapshot(
        colRef(name),
        (snap) => {
          const docs = snap.docs.map((d) => d.data());
          setRaw((prev) => ({
            ...prev,
            [name]:
              name === "overrides" || name === "checks" || name === "settings"
                ? Object.fromEntries(docs.map((d) => [d.id, d]))
                : docs,
          }));
          setReady((r) => ({ ...r, [name]: true }));
        },
        () => setError(true),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [colRef]);

  /* Categorias padrão no primeiro acesso ao módulo */
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    (async () => {
      const snap = await getDoc(moduleDoc());
      if (snap.exists() && snap.data().seeded) return;
      const batch = writeBatch(getDb());
      DEFAULT_CATEGORIES.forEach((c) => {
        const ref = doc(colRef("categories"));
        batch.set(ref, { ...c, id: ref.id });
      });
      batch.set(moduleDoc(), { seeded: true }, { merge: true });
      await batch.commit();
    })().catch(() => setError(true));
  }, [moduleDoc, colRef]);

  const loading = COLS.some((c) => !ready[c]);

  /* Ocorrências: do mês mais antigo até 24 meses à frente */
  const occurrences = useMemo(() => {
    const cur = monthOf(todayStr());
    const earliest = raw.transactions.reduce((m, t) => (monthOf(t.date) < m ? monthOf(t.date) : m), cur);
    // Compras no cartão (únicas, parcelas e fixas) contam no mês da fatura em que caem, não no mês da compra.
    const monthFor = (t: Transaction, date: string) => {
      const card =
        t.type === "EXPENSE" && t.paymentMethodType === "CARD" ? raw.cards.find((c) => c.id === t.paymentMethodId) : undefined;
      return card ? invoiceMonthOf(card, date, raw.overrides) : monthOf(date);
    };
    return buildOccurrences(raw.transactions, earliest, addMonths(cur, 24), monthFor);
  }, [raw.transactions, raw.cards, raw.overrides]);

  const balances = useMemo(
    () => computeBalances(raw.accounts, raw.cards, occurrences, raw.overrides),
    [raw.accounts, raw.cards, occurrences, raw.overrides],
  );

  const catById = useCallback((id: string) => raw.categories.find((c) => c.id === id), [raw.categories]);
  const respById = useCallback((id: string) => raw.responsibles.find((r) => r.id === id), [raw.responsibles]);
  const respName = useCallback(
    (id: string) => (id === ME_ID ? "Eu" : (raw.responsibles.find((r) => r.id === id)?.name ?? "Removido")),
    [raw.responsibles],
  );
  const methodOf = useCallback(
    (tx: Transaction): MethodInfo => {
      if (tx.paymentMethodType === "BOLETO") return { name: "Boleto", color: "#5B6B86", icon: "receipt" };
      if (tx.type === "CHARGE" || tx.paymentMethodType === "NONE") return { name: "Cobrança", color: "#E8A317", icon: "circle-dollar-sign" };
      const m =
        tx.paymentMethodType === "BANK"
          ? raw.accounts.find((a) => a.id === tx.paymentMethodId)
          : raw.cards.find((c) => c.id === tx.paymentMethodId);
      return m
        ? { name: m.name, color: m.color, icon: m.icon || (tx.paymentMethodType === "BANK" ? "landmark" : "credit-card") }
        : { name: "Removido", color: "#8795AD", icon: "tag" };
    },
    [raw.accounts, raw.cards],
  );

  const newId = useCallback((name: FinanceCol) => doc(colRef(name)).id, [colRef]);
  const save = useCallback(
    async <T extends { id: string }>(name: FinanceCol, item: T) => {
      await setDoc(docRef(name, item.id), clean(item));
    },
    [docRef],
  );
  const saveMany = useCallback(
    async <T extends { id: string }>(name: FinanceCol, items: T[]) => {
      for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(getDb());
        items.slice(i, i + 400).forEach((it) => batch.set(docRef(name, it.id), clean(it)));
        await batch.commit();
      }
    },
    [docRef],
  );
  const remove = useCallback(async (name: FinanceCol, id: string) => deleteDoc(docRef(name, id)), [docRef]);
  const removeMany = useCallback(
    async (name: FinanceCol, ids: string[]) => {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(getDb());
        ids.slice(i, i + 400).forEach((id) => batch.delete(docRef(name, id)));
        await batch.commit();
      }
    },
    [docRef],
  );

  const settleSplits = useCallback<FinanceData["settleSplits"]>(
    async (items, accountId, paid) => {
      const byTx = new Map<string, Transaction>();
      for (const { occ, responsibleId } of items) {
        const tx = byTx.get(occ.tx.id) ?? (JSON.parse(JSON.stringify(occ.tx)) as Transaction);
        const update = (arr: ResponsibleSplit[]) =>
          arr.map((s) =>
            s.responsibleId === responsibleId
              ? { ...s, isPaid: paid, paidAt: paid ? todayStr() : null, destinationAccountId: paid ? accountId : null }
              : s,
          );
        if (tx.frequency === "FIXED") {
          const cur = tx.occurrenceSplits?.[occ.monthYear] ?? tx.splits;
          tx.occurrenceSplits = { ...(tx.occurrenceSplits ?? {}), [occ.monthYear]: update(cur) };
        } else {
          tx.splits = update(tx.splits);
        }
        byTx.set(tx.id, tx);
      }
      await saveMany("transactions", [...byTx.values()]);
    },
    [saveMany],
  );

  const setOccPaid = useCallback<FinanceData["setOccPaid"]>(
    async (occ, paid, fromAccountId) => {
      const tx = occ.tx;
      const boleto = tx.paymentMethodType === "BOLETO";
      const from = paid && boleto ? (fromAccountId ?? null) : null;
      await save(
        "transactions",
        tx.frequency === "FIXED"
          ? {
              ...tx,
              occurrencePaid: { ...(tx.occurrencePaid ?? {}), [occ.monthYear]: paid },
              ...(boleto ? { occurrencePaidFrom: { ...(tx.occurrencePaidFrom ?? {}), [occ.monthYear]: from } } : {}),
            }
          : { ...tx, isPaid: paid, ...(boleto ? { paidFromAccountId: from } : {}) },
      );
    },
    [save],
  );

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar suas finanças">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
        <Spinner label="Carregando suas finanças" />
      </div>
    );
  }

  const value: FinanceData = {
    ...raw,
    occurrences,
    balances,
    catById,
    respName,
    respById,
    methodOf,
    newId,
    save,
    saveMany,
    remove,
    removeMany,
    settleSplits,
    setOccPaid,
  };
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceData {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance precisa ser usado dentro de <FinanceDataProvider>.");
  return ctx;
}

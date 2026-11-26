"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { monthKey, monthShortLabel, shiftMonth, sortByName } from "../lib/shopping";
import type { MonthItem, PricePoint, PriceRecord, Product, Purchase, PurchaseItem, ShoppingCategory } from "../lib/types";

/**
 * Dados em `users/{uid}/modules/shopping/...`:
 * - `categories/{id}` → { name }
 * - `products/{id}` → { name, unit, categoryId, imageUrl, variants[] }
 * - `lists/{YYYY-MM}/items/{productId}` → { checked, price, priceType, quantity, variantId } (ou item avulso)
 * - `purchases/{id}` → { store, date, month, total, items[] } (compra finalizada)
 * - `priceRecords/{id}` → { productId, purchaseId, store, date, price, ... } (preço por mercado/data)
 */
type Col = "categories" | "products" | "purchases" | "priceRecords";
const COLS: Col[] = ["categories", "products", "purchases", "priceRecords"];

export type SaveProductInput = Omit<Product, "id"> & { id?: string };

export interface FinishPurchaseInput {
  month: string;
  store: string;
  date: string;
  bought: PurchaseItem[];
  /** Itens da lista que não foram para o carrinho. */
  pendingIds: string[];
  keepPending: boolean;
}

export interface ShoppingData {
  categories: ShoppingCategory[];
  products: Product[];
  /** Mais recentes primeiro. */
  purchases: Purchase[];
  /** Ordenados por data (mais antigos primeiro). */
  priceRecords: PriceRecord[];
  /** Último preço pago por produto. */
  lastPrice: Map<string, number>;
  /** Mercados já usados (para sugerir ao finalizar). */
  stores: string[];
  categoryName: (id?: string) => string;

  addCategory: (name: string) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

  saveProduct: (input: SaveProductInput) => Promise<string>;
  removeProduct: (id: string) => Promise<void>;

  setMonthItem: (month: string, id: string, data: Partial<Omit<MonthItem, "id">>) => Promise<void>;
  removeMonthItem: (month: string, id: string) => Promise<void>;
  addTempItem: (month: string, data: { name: string; unit: string; quantity: number }) => Promise<void>;
  /** Preços registrados nas listas dos últimos meses (antes de existir o histórico por mercado). */
  getPriceHistory: (productId: string, months?: number) => Promise<PricePoint[]>;

  finishPurchase: (input: FinishPurchaseInput) => Promise<string>;
  removePurchase: (id: string) => Promise<void>;

  /** Assinatura em tempo real dos itens de uma lista mensal. */
  subscribeMonth: (month: string, onItems: (items: MonthItem[]) => void, onError: () => void) => () => void;
}

const ShoppingContext = createContext<ShoppingData | null>(null);

interface Raw {
  categories: ShoppingCategory[];
  products: Product[];
  purchases: Purchase[];
  priceRecords: PriceRecord[];
}
const EMPTY: Raw = { categories: [], products: [], purchases: [], priceRecords: [] };

/** Dados da Lista de compras em tempo real. Envolve todas as rotas em /compras. */
export function ShoppingDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "shopping"), [uid]);
  const col = useCallback((...path: string[]) => collection(moduleDoc(), path.join("/")), [moduleDoc]);
  const ref = useCallback((...path: string[]) => doc(moduleDoc(), path.join("/")) as DocumentReference, [moduleDoc]);

  useEffect(() => {
    const unsubs = COLS.map((name) =>
      onSnapshot(
        col(name),
        (snap) => {
          const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          setRaw((prev) => ({ ...prev, [name]: docs }));
          setReady((r) => ({ ...r, [name]: true }));
        },
        () => setError(true),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [col]);

  const categories = useMemo(() => sortByName(raw.categories), [raw.categories]);
  const products = useMemo(() => sortByName(raw.products), [raw.products]);
  const purchases = useMemo(() => [...raw.purchases].sort((a, b) => b.date.localeCompare(a.date)), [raw.purchases]);
  const priceRecords = useMemo(() => [...raw.priceRecords].sort((a, b) => a.date.localeCompare(b.date)), [raw.priceRecords]);
  // Registros ordenados por data: o último preço sobrescreve.
  const lastPrice = useMemo(() => new Map(priceRecords.map((r) => [r.productId, r.price])), [priceRecords]);
  const stores = useMemo(
    () => [...new Set(purchases.map((p) => p.store))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [purchases],
  );

  // Identidade estável: as telas assinam a lista do mês sem reassinar a cada mudança de dados.
  const subscribeMonth = useCallback<ShoppingData["subscribeMonth"]>(
    (month, onItems, onError) =>
      onSnapshot(
        col("lists", month, "items"),
        (snap) => onItems(snap.docs.map((d) => ({ ...(d.data() as Omit<MonthItem, "id">), id: d.id }))),
        onError,
      ),
    [col],
  );

  const getPriceHistory = useCallback<ShoppingData["getPriceHistory"]>(
    async (productId, months = 4) => {
      const now = monthKey();
      const keys = Array.from({ length: months }, (_, i) => shiftMonth(now, i - (months - 1)));
      const snaps = await Promise.all(keys.map((k) => getDoc(ref("lists", k, "items", productId))));
      return keys.map((k, i) => ({
        month: monthShortLabel(k),
        price: snaps[i].exists() ? ((snaps[i].data().price as number | null | undefined) ?? null) : null,
      }));
    },
    [ref],
  );

  const value = useMemo<ShoppingData>(
    () => ({
      categories,
      products,
      purchases,
      priceRecords,
      lastPrice,
      stores,
      categoryName: (id) => categories.find((c) => c.id === id)?.name ?? "Sem categoria",

      addCategory: async (name) => {
        await addDoc(col("categories"), { name });
      },
      renameCategory: (id, name) => updateDoc(ref("categories", id), { name }),
      removeCategory: (id) => deleteDoc(ref("categories", id)),

      saveProduct: async ({ id, ...data }) => {
        const docRef = id ? ref("products", id) : doc(col("products"));
        await setDoc(docRef, data, { merge: true });
        return docRef.id;
      },
      removeProduct: (id) => deleteDoc(ref("products", id)),

      setMonthItem: (month, id, data) => setDoc(ref("lists", month, "items", id), data, { merge: true }),
      removeMonthItem: (month, id) => deleteDoc(ref("lists", month, "items", id)),
      addTempItem: async (month, data) => {
        await addDoc(col("lists", month, "items"), { ...data, temp: true, checked: false });
      },
      getPriceHistory,

      // Salva a compra no histórico e tira da lista do mês o que foi comprado.
      finishPurchase: async ({ month, store, date, bought, pendingIds, keepPending }) => {
        const batch = writeBatch(getDb());
        const purchaseRef = doc(col("purchases"));
        batch.set(purchaseRef, {
          month,
          store,
          date,
          total: bought.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0),
          items: bought,
        });
        bought.forEach((i) => {
          // Sem preço informado ou item avulso não entra no histórico de preços.
          if (i.price != null && !i.temp) {
            batch.set(doc(col("priceRecords")), {
              productId: i.productId,
              purchaseId: purchaseRef.id,
              store,
              date,
              price: i.price,
              priceType: i.priceType ?? "unit",
              quantity: i.quantity,
              ...(i.variant && { variant: i.variant }),
            });
          }
          batch.delete(ref("lists", month, "items", i.productId));
        });
        if (!keepPending) pendingIds.forEach((id) => batch.delete(ref("lists", month, "items", id)));
        await batch.commit();
        return purchaseRef.id;
      },
      removePurchase: async (id) => {
        const recs = await getDocs(query(col("priceRecords"), where("purchaseId", "==", id)));
        const batch = writeBatch(getDb());
        recs.docs.forEach((r) => batch.delete(r.ref));
        batch.delete(ref("purchases", id));
        await batch.commit();
      },

      subscribeMonth,
    }),
    [categories, products, purchases, priceRecords, lastPrice, stores, col, ref, subscribeMonth, getPriceHistory],
  );

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar a lista de compras">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (COLS.some((c) => !ready[c])) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
        <Spinner label="Carregando lista de compras" />
      </div>
    );
  }

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

export function useShopping(): ShoppingData {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error("useShopping precisa ser usado dentro de <ShoppingDataProvider>.");
  return ctx;
}

/** Itens de uma lista mensal em tempo real (`null` enquanto carrega). */
export function useMonthItems(month: string): MonthItem[] | null {
  const { subscribeMonth } = useShopping();
  const [state, setState] = useState<{ month: string; items: MonthItem[] } | null>(null);
  useEffect(
    () =>
      subscribeMonth(
        month,
        (items) => setState({ month, items }),
        () => setState({ month, items: [] }),
      ),
    [month, subscribeMonth],
  );
  return state?.month === month ? state.items : null;
}

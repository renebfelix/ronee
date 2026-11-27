"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch, type DocumentReference } from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { useFinance } from "@/features/finance/data/FinanceDataProvider";
import { COLORS } from "@/features/finance/lib/format";
import type { Category } from "@/features/finance/lib/types";
import { DEFAULT_PLACE_CATEGORIES, financeCategoryName } from "../lib/travel";
import type { Place, PlaceCategory, PlaceCategoryInput, PlaceInput, Trip, TripInput } from "../lib/types";

/**
 * Dados em `users/{uid}/modules/travel/...`:
 * - `trips/{id}`      → { name, destination, startDate, endDate, companions: string[], financeCategoryId, closed, createdAt }
 * - `places/{id}`     → { tripId, name, categoryId, description, address, lat, lng, date, visited, createdAt }
 * - `categories/{id}` → { name, icon, color, order }
 *
 * Os gastos NÃO ficam aqui: são lançamentos de Finanças (`modules/finance/transactions`) na
 * categoria de despesa `trip.financeCategoryId`, criada automaticamente para cada viagem aberta.
 */
type Col = "trips" | "places" | "categories";
const COLS: Col[] = ["trips", "places", "categories"];

export interface TravelData {
  trips: Trip[];
  tripsById: Record<string, Trip>;
  places: Place[];
  placesByTrip: Record<string, Place[]>;
  categories: PlaceCategory[];
  categoriesById: Record<string, PlaceCategory>;
  placeCounts: Record<string, number>;

  /** Cria a viagem (aberta) e a categoria de despesa dela em Finanças. Devolve o id. */
  addTrip: (data: TripInput) => Promise<string>;
  /** Atualiza a viagem; renomear também renomeia a categoria em Finanças. */
  updateTrip: (trip: Trip, data: TripInput) => Promise<void>;
  /** Encerra ou reabre. Encerrada desativa a categoria em Finanças (os lançamentos continuam lá). */
  setTripClosed: (trip: Trip, closed: boolean) => Promise<void>;
  /** Recria a categoria em Finanças quando ela foi excluída por lá. */
  ensureFinanceCategory: (trip: Trip) => Promise<void>;
  /**
   * Exclui a viagem e os lugares dela. Os lançamentos em Finanças ficam; a categoria é excluída
   * se não tiver lançamentos, senão é só desativada.
   */
  removeTrip: (trip: Trip) => Promise<void>;

  addPlace: (tripId: string, data: PlaceInput) => Promise<void>;
  updatePlace: (id: string, data: Partial<PlaceInput>) => Promise<void>;
  removePlace: (id: string) => Promise<void>;

  addCategory: (data: PlaceCategoryInput) => Promise<void>;
  updateCategory: (id: string, data: PlaceCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
}

const TravelContext = createContext<TravelData | null>(null);

interface Raw {
  trips: Trip[];
  places: Place[];
  categories: PlaceCategory[];
}

/** Viagens, lugares e categorias em tempo real. Precisa estar dentro de <FinanceDataProvider>. */
export function TravelDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const fin = useFinance();
  const [raw, setRaw] = useState<Raw>({ trips: [], places: [], categories: [] });
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "travel"), [uid]);
  const col = useCallback((name: Col) => collection(moduleDoc(), name), [moduleDoc]);
  const ref = useCallback((name: Col, id: string) => doc(moduleDoc(), name, id) as DocumentReference, [moduleDoc]);

  useEffect(() => {
    const unsubs = COLS.map((name) =>
      onSnapshot(
        col(name),
        (snap) => {
          if (name === "categories" && snap.empty && !snap.metadata.fromCache) {
            const batch = writeBatch(getDb());
            DEFAULT_PLACE_CATEGORIES.forEach(({ id, ...data }) => batch.set(ref("categories", id), data));
            batch.commit().catch(() => setError(true));
            return;
          }
          const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          setRaw((prev) => ({ ...prev, [name]: docs }));
          setReady((r) => ({ ...r, [name]: true }));
        },
        () => setError(true),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [col, ref]);

  const trips = useMemo(
    () =>
      raw.trips
        .map((t) => ({ ...t, companions: t.companions ?? [], closed: !!t.closed, financeCategoryId: t.financeCategoryId ?? null }))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [raw.trips],
  );
  const tripsById = useMemo(() => Object.fromEntries(trips.map((t) => [t.id, t])), [trips]);
  const places = useMemo(
    () =>
      [...raw.places].sort(
        (a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.name.localeCompare(b.name, "pt-BR"),
      ),
    [raw.places],
  );
  const placesByTrip = useMemo(() => {
    const map: Record<string, Place[]> = {};
    places.forEach((p) => (map[p.tripId] ??= []).push(p));
    return map;
  }, [places]);
  const categories = useMemo(() => [...raw.categories].sort((a, b) => a.order - b.order), [raw.categories]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const placeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    raw.places.forEach((p) => (counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1));
    return counts;
  }, [raw.places]);

  const { save: finSave, remove: finRemove, newId: finNewId, catById, categories: finCategories, transactions } = fin;

  const value = useMemo<TravelData>(() => {
    /** Cria a categoria de despesa da viagem em Finanças e devolve o id. */
    const createFinanceCategory = async (name: string, active: boolean) => {
      const expenseCount = finCategories.filter((c) => c.type === "EXPENSE").length;
      const category: Category = {
        id: finNewId("categories"),
        name: financeCategoryName(name),
        type: "EXPENSE",
        color: COLORS[expenseCount % COLORS.length],
        icon: "plane",
        isActive: active,
      };
      await finSave("categories", category);
      return category.id;
    };
    const patchFinanceCategory = async (id: string | null, patch: Partial<Category>) => {
      const cur = id ? catById(id) : undefined;
      if (cur) await finSave("categories", { ...cur, ...patch });
    };

    return {
      trips,
      tripsById,
      places,
      placesByTrip,
      categories,
      categoriesById,
      placeCounts,

      addTrip: async (data) => {
        const tripRef = doc(col("trips"));
        const financeCategoryId = await createFinanceCategory(data.name, true);
        await setDoc(tripRef, { ...data, financeCategoryId, closed: false, createdAt: Date.now() });
        return tripRef.id;
      },

      updateTrip: async (trip, data) => {
        await updateDoc(ref("trips", trip.id), { ...data });
        if (data.name !== trip.name) await patchFinanceCategory(trip.financeCategoryId, { name: financeCategoryName(data.name) });
      },

      setTripClosed: async (trip, closed) => {
        const exists = !!(trip.financeCategoryId && catById(trip.financeCategoryId));
        if (!closed && !exists) {
          const financeCategoryId = await createFinanceCategory(trip.name, true);
          await updateDoc(ref("trips", trip.id), { closed, financeCategoryId });
          return;
        }
        await updateDoc(ref("trips", trip.id), { closed });
        await patchFinanceCategory(trip.financeCategoryId, { isActive: !closed });
      },

      ensureFinanceCategory: async (trip) => {
        if (trip.financeCategoryId && catById(trip.financeCategoryId)) return;
        const financeCategoryId = await createFinanceCategory(trip.name, !trip.closed);
        await updateDoc(ref("trips", trip.id), { financeCategoryId });
      },

      removeTrip: async (trip) => {
        const batch = writeBatch(getDb());
        raw.places.filter((p) => p.tripId === trip.id).forEach((p) => batch.delete(ref("places", p.id)));
        batch.delete(ref("trips", trip.id));
        await batch.commit();
        const catId = trip.financeCategoryId;
        if (!catId || !catById(catId)) return;
        if (transactions.some((t) => t.categoryId === catId)) await patchFinanceCategory(catId, { isActive: false });
        else await finRemove("categories", catId);
      },

      addPlace: async (tripId, data) => {
        await addDoc(col("places"), { ...data, tripId, createdAt: Date.now() });
      },
      updatePlace: (id, data) => updateDoc(ref("places", id), data),
      removePlace: (id) => deleteDoc(ref("places", id)),

      addCategory: async (data) => {
        await addDoc(col("categories"), { ...data, order: Date.now() });
      },
      updateCategory: (id, data) => updateDoc(ref("categories", id), data),
      removeCategory: (id) => deleteDoc(ref("categories", id)),
    };
  }, [
    trips,
    tripsById,
    places,
    placesByTrip,
    categories,
    categoriesById,
    placeCounts,
    raw.places,
    col,
    ref,
    finSave,
    finRemove,
    finNewId,
    catById,
    finCategories,
    transactions,
  ]);

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar suas viagens">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (COLS.some((c) => !ready[c])) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
        <Spinner label="Carregando viagens" />
      </div>
    );
  }

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel(): TravelData {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error("useTravel precisa ser usado dentro de <TravelDataProvider>.");
  return ctx;
}

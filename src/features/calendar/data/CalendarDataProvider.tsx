"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { DEFAULT_CATEGORIES } from "../lib/calendar";
import { HOLIDAY_CATEGORY } from "../lib/holidays";
import { dayBefore } from "../lib/recurrence";
import type { CalendarEvent, EditScope, EventCategory, EventCategoryInput, EventInput, Occurrence } from "../lib/types";

/**
 * Dados em `users/{uid}/modules/calendar/...`:
 * - `events/{id}` → { title, description, location, category, allDay, startDate, startTime, endDate, endTime,
 *                     recurrence: { freq, interval, weekdays, until, count } | null, exceptions: string[], createdAt }
 * - `categories/{id}` → { name, icon, color, order }
 */
type Col = "events" | "categories";
const COLS: Col[] = ["events", "categories"];

export interface CalendarData {
  uid: string;
  events: CalendarEvent[];
  categories: EventCategory[];
  categoriesById: Record<string, EventCategory>;
  eventCounts: Record<string, number>;

  addEvent: (data: EventInput) => Promise<void>;
  /** Salva a edição de uma ocorrência conforme o escopo (só esta, esta e as seguintes, todas). */
  saveOccurrence: (occ: Occurrence, scope: EditScope, data: EventInput) => Promise<void>;
  removeOccurrence: (occ: Occurrence, scope: EditScope) => Promise<void>;

  addCategory: (data: EventCategoryInput) => Promise<void>;
  updateCategory: (id: string, data: EventCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
}

const CalendarContext = createContext<CalendarData | null>(null);

interface Raw {
  events: CalendarEvent[];
  categories: EventCategory[];
}

/** Eventos e categorias da Agenda em tempo real. Envolve todas as rotas em /agenda. */
export function CalendarDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [raw, setRaw] = useState<Raw>({ events: [], categories: [] });
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "calendar"), [uid]);
  const col = useCallback((name: string) => collection(moduleDoc(), name), [moduleDoc]);
  const ref = useCallback((name: string, id: string) => doc(moduleDoc(), name, id) as DocumentReference, [moduleDoc]);

  useEffect(() => {
    const unsubs = COLS.map((name) =>
      onSnapshot(
        col(name),
        (snap) => {
          if (name === "categories" && snap.empty && !snap.metadata.fromCache) {
            const batch = writeBatch(getDb());
            [HOLIDAY_CATEGORY, ...DEFAULT_CATEGORIES].forEach(({ id, ...data }) => batch.set(ref("categories", id), data));
            batch.commit().catch(() => setError(true));
            return;
          }
          // Agendas criadas antes dos feriados: adiciona a categoria que eles usam.
          if (name === "categories" && !snap.metadata.fromCache && !snap.docs.some((d) => d.id === HOLIDAY_CATEGORY.id)) {
            const { id, ...data } = HOLIDAY_CATEGORY;
            setDoc(ref("categories", id), data).catch(() => {});
          }
          const docs = snap.docs.map((d) => ({ exceptions: [], reminders: [], ...d.data(), id: d.id }));
          setRaw((prev) => ({ ...prev, [name]: docs }));
          setReady((r) => ({ ...r, [name]: true }));
        },
        () => setError(true),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [col, ref]);

  const categories = useMemo(() => [...raw.categories].sort((a, b) => a.order - b.order), [raw.categories]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    raw.events.forEach((e) => (counts[e.category] = (counts[e.category] ?? 0) + 1));
    return counts;
  }, [raw.events]);

  const value = useMemo<CalendarData>(() => {
    const create = (data: EventInput) => addDoc(col("events"), { ...data, exceptions: [], createdAt: Date.now() });
    const isFirst = (occ: Occurrence) => occ.startDate === occ.event.startDate;
    // Encerra a série no dia anterior à ocorrência (o limite de quantidade deixa de valer: as anteriores já cabem nele).
    const endSeriesBefore = (occ: Occurrence) =>
      updateDoc(ref("events", occ.event.id), { "recurrence.until": dayBefore(occ.startDate), "recurrence.count": null });

    return {
      uid,
      events: raw.events,
      categories,
      categoriesById,
      eventCounts,

      addEvent: async (data) => {
        await create(data);
      },

      saveOccurrence: async (occ, scope, data) => {
        const id = occ.event.id;
        if (!occ.event.recurrence || scope === "all" || (scope === "following" && isFirst(occ))) {
          await updateDoc(ref("events", id), { ...data });
          return;
        }
        if (scope === "this") {
          await updateDoc(ref("events", id), { exceptions: arrayUnion(occ.startDate) });
          await create({ ...data, recurrence: null });
          return;
        }
        await endSeriesBefore(occ);
        await create(data);
      },

      removeOccurrence: async (occ, scope) => {
        const id = occ.event.id;
        if (!occ.event.recurrence || scope === "all" || (scope === "following" && isFirst(occ))) {
          await deleteDoc(ref("events", id));
          return;
        }
        if (scope === "this") await updateDoc(ref("events", id), { exceptions: arrayUnion(occ.startDate) });
        else await endSeriesBefore(occ);
      },

      addCategory: async (data) => {
        await addDoc(col("categories"), { ...data, order: Date.now() });
      },
      updateCategory: (id, data) => updateDoc(ref("categories", id), data),
      removeCategory: (id) => deleteDoc(ref("categories", id)),
    };
  }, [uid, raw.events, categories, categoriesById, eventCounts, col, ref]);

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar a agenda">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (COLS.some((c) => !ready[c])) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
        <Spinner label="Carregando agenda" />
      </div>
    );
  }

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar(): CalendarData {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar precisa ser usado dentro de <CalendarDataProvider>.");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { nextOccurrence } from "../lib/recurrence";
import { DEFAULT_CATEGORIES } from "../lib/tasks";
import type { NewTask, Task, TaskCategory, TaskCategoryInput, TaskUpdate } from "../lib/types";

/**
 * Dados em `users/{uid}/modules/tasks/...`:
 * - `tasks/{id}` → { title, description, done, priority, category, dueDate, recurrence, createdAt }
 * - `categories/{id}` → { name, icon, color, order }
 * - `devices/{token}` → { token, hour, timeZone, lastSentDate } (push do resumo diário)
 */
type Col = "tasks" | "categories";
const COLS: Col[] = ["tasks", "categories"];

export interface TasksData {
  uid: string;
  tasks: Task[];
  /** Na ordem definida pelo usuário. */
  categories: TaskCategory[];
  categoriesById: Record<string, TaskCategory>;
  /** Quantidade de tarefas por categoria. */
  taskCounts: Record<string, number>;

  addTask: (task: NewTask) => Promise<void>;
  updateTask: (id: string, data: TaskUpdate) => Promise<void>;
  /** Concluir uma tarefa recorrente não a encerra: ela volta pendente na próxima data. */
  toggleTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;

  addCategory: (data: TaskCategoryInput) => Promise<void>;
  updateCategory: (id: string, data: TaskCategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
}

const TasksContext = createContext<TasksData | null>(null);

interface Raw {
  tasks: Task[];
  categories: TaskCategory[];
}

/** Tarefas e categorias em tempo real. Envolve todas as rotas em /tarefas. */
export function TasksDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [raw, setRaw] = useState<Raw>({ tasks: [], categories: [] });
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "tasks"), [uid]);
  const col = useCallback((name: string) => collection(moduleDoc(), name), [moduleDoc]);
  const ref = useCallback((name: string, id: string) => doc(moduleDoc(), name, id) as DocumentReference, [moduleDoc]);

  useEffect(() => {
    const unsubs = COLS.map((name) =>
      onSnapshot(
        col(name),
        (snap) => {
          // Primeira visita: cria as categorias padrão (o próximo snapshot traz os dados).
          if (name === "categories" && snap.empty && !snap.metadata.fromCache) {
            const batch = writeBatch(getDb());
            DEFAULT_CATEGORIES.forEach(({ id, ...data }) => batch.set(ref("categories", id), data));
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

  const categories = useMemo(() => [...raw.categories].sort((a, b) => a.order - b.order), [raw.categories]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    raw.tasks.forEach((t) => (counts[t.category] = (counts[t.category] ?? 0) + 1));
    return counts;
  }, [raw.tasks]);

  const value = useMemo<TasksData>(
    () => ({
      uid,
      tasks: raw.tasks,
      categories,
      categoriesById,
      taskCounts,

      addTask: async (task) => {
        await addDoc(col("tasks"), { ...task, done: false, createdAt: Date.now() });
      },
      updateTask: (id, data) => updateDoc(ref("tasks", id), data),
      toggleTask: (task) => {
        if (!task.done && task.recurrence && task.dueDate) {
          return updateDoc(ref("tasks", task.id), { dueDate: nextOccurrence(task.dueDate, task.recurrence) });
        }
        return updateDoc(ref("tasks", task.id), { done: !task.done });
      },
      removeTask: (id) => deleteDoc(ref("tasks", id)),

      addCategory: async (data) => {
        await addDoc(col("categories"), { ...data, order: Date.now() });
      },
      updateCategory: (id, data) => updateDoc(ref("categories", id), data),
      removeCategory: (id) => deleteDoc(ref("categories", id)),
    }),
    [uid, raw.tasks, categories, categoriesById, taskCounts, col, ref],
  );

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar as tarefas">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (COLS.some((c) => !ready[c])) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
        <Spinner label="Carregando tarefas" />
      </div>
    );
  }

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksData {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks precisa ser usado dentro de <TasksDataProvider>.");
  return ctx;
}

export type Priority = "low" | "medium" | "high";

export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

export interface TaskCategory {
  id: string;
  name: string;
  /** Chave em `CATEGORY_ICONS`. */
  icon: string;
  color: string;
  order: number;
}

export type TaskCategoryInput = Pick<TaskCategory, "name" | "icon" | "color">;

export interface Task {
  id: string;
  title: string;
  /** HTML gerado pelo editor; opcional. */
  description?: string | null;
  done: boolean;
  priority: Priority;
  /** Id da categoria (pode apontar para uma categoria excluída → "Sem categoria"). */
  category: string;
  /** "YYYY-MM-DD" ou null. */
  dueDate: string | null;
  /** Só vale com prazo: ao concluir, o prazo avança para a próxima ocorrência. */
  recurrence?: Recurrence | null;
  createdAt: number;
}

export type NewTask = Pick<Task, "title" | "description" | "priority" | "category" | "dueDate" | "recurrence">;

export type TaskUpdate = Partial<Omit<Task, "id" | "createdAt">>;

export type StatusFilter = "pending" | "done" | "all";

export type SortKey = "due" | "priority" | "newest" | "oldest" | "title";

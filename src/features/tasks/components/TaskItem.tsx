"use client";

import { useState, type CSSProperties } from "react";
import { AlignLeft, CalendarDays, Check, ChevronDown, Pencil, Repeat, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { RECURRENCES } from "../lib/recurrence";
import { sanitizeHtml } from "../lib/sanitize";
import { PRIORITIES, formatDue } from "../lib/tasks";
import type { Priority, Recurrence, Task, TaskCategory, TaskUpdate } from "../lib/types";
import { CategoryGlyph } from "./CategoryGlyph";
import { DescriptionEditor } from "./DescriptionEditor";
import { TaskOptions } from "./TaskOptions";
import styles from "./Tasks.module.scss";

interface Props {
  task: Task;
  category: TaskCategory | undefined;
  categories: TaskCategory[];
  onToggle: () => void;
  onUpdate: (data: TaskUpdate) => void;
  onDelete: () => void;
}

export function TaskItem({ task, category, categories, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [draftDescription, setDraftDescription] = useState(task.description ?? "");
  const [draftCategory, setDraftCategory] = useState(task.category);
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority);
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate ?? "");
  const [draftRecurrence, setDraftRecurrence] = useState<Recurrence | null>(task.recurrence ?? null);
  const priority = PRIORITIES[task.priority] ?? PRIORITIES.medium;
  const PriorityIcon = priority.icon;
  const due = task.dueDate ? formatDue(task.dueDate) : null;

  function startEditing() {
    setDraft(task.title);
    setDraftDescription(task.description ?? "");
    setDraftCategory(task.category);
    setDraftPriority(task.priority);
    setDraftDueDate(task.dueDate ?? "");
    setDraftRecurrence(task.recurrence ?? null);
    setEditing(true);
  }

  function save() {
    const title = draft.trim();
    if (!title) return;
    const next = {
      title,
      description: draftDescription || null,
      category: draftCategory,
      priority: draftPriority,
      dueDate: draftDueDate || null,
      recurrence: draftDueDate ? draftRecurrence : null,
    };
    // Envia só os campos que mudaram.
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value !== (task[key as keyof typeof next] ?? null)),
    );
    if (Object.keys(changes).length) onUpdate(changes);
    setEditing(false);
  }

  return (
    <li className={cn(styles.item, styles[`item-${task.priority}`], task.done && styles.itemDone, editing && styles.itemEditing)}>
      <button
        type="button"
        className={styles.check}
        onClick={onToggle}
        aria-label={task.done ? "Marcar como pendente" : "Marcar como concluída"}
        aria-pressed={task.done}
      >
        {task.done && <Check size={14} strokeWidth={3} aria-hidden />}
      </button>

      <div className={styles.itemBody}>
        {editing ? (
          <>
            <input
              className={styles.editTitle}
              value={draft}
              autoFocus
              maxLength={140}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Título da tarefa"
            />
            <DescriptionEditor value={draftDescription} onChange={setDraftDescription} placeholder="Descrição (opcional)..." />
            <TaskOptions
              compact
              categories={categories}
              category={draftCategory}
              onCategoryChange={setDraftCategory}
              priority={draftPriority}
              onPriorityChange={setDraftPriority}
              dueDate={draftDueDate}
              onDueDateChange={setDraftDueDate}
              recurrence={draftRecurrence}
              onRecurrenceChange={setDraftRecurrence}
            />
            <div className={styles.editActions}>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={!draft.trim()}>
                Salvar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.itemTitle}>{task.title}</p>

            <div className={styles.meta}>
              <span
                className={cn(styles.tag, styles.tagCat)}
                style={category ? ({ "--cat": category.color } as CSSProperties) : undefined}
              >
                <CategoryGlyph icon={category?.icon} size={12} /> {category?.name ?? "Sem categoria"}
              </span>
              <span className={cn(styles.tag, styles.tagPrio)}>
                <PriorityIcon size={12} aria-hidden /> {priority.label}
              </span>
              {due && (
                <span className={cn(styles.tag, due.overdue && !task.done && styles.tagOverdue)}>
                  <CalendarDays size={12} aria-hidden /> {due.label}
                </span>
              )}
              {task.recurrence && task.dueDate && (
                <span className={styles.tag}>
                  <Repeat size={12} aria-hidden /> {RECURRENCES[task.recurrence]}
                </span>
              )}
              {task.description && (
                <button
                  type="button"
                  className={cn(styles.tag, styles.tagToggle, expanded && styles.tagToggleOpen)}
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                >
                  <AlignLeft size={12} aria-hidden /> Descrição <ChevronDown size={12} className={styles.chevron} aria-hidden />
                </button>
              )}
            </div>

            {task.description && expanded && (
              <div className={cn(styles.itemDescription, styles.richText)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.description) }} />
            )}
          </>
        )}
      </div>

      {!editing && (
        <div className={styles.itemActions}>
          <IconButton icon={Pencil} size="sm" label="Editar" onClick={startEditing} />
          <IconButton icon={Trash2} size="sm" label="Excluir" className={styles.deleteBtn} onClick={onDelete} />
        </div>
      )}
    </li>
  );
}

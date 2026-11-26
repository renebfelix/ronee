"use client";

import type { CSSProperties } from "react";
import { CalendarDays, Repeat, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RECURRENCES } from "../lib/recurrence";
import { PRIORITIES } from "../lib/tasks";
import type { Priority, Recurrence, TaskCategory } from "../lib/types";
import { CategoryGlyph } from "./CategoryGlyph";
import styles from "./Tasks.module.scss";

interface Props {
  categories: TaskCategory[];
  category: string | undefined;
  onCategoryChange: (id: string) => void;
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  recurrence: Recurrence | null;
  onRecurrenceChange: (recurrence: Recurrence | null) => void;
  compact?: boolean;
}

/** Seletores de categoria, prioridade, prazo e repetição — usados ao criar e ao editar uma tarefa. */
export function TaskOptions({
  categories,
  category,
  onCategoryChange,
  priority,
  onPriorityChange,
  dueDate,
  onDueDateChange,
  recurrence,
  onRecurrenceChange,
  compact = false,
}: Props) {
  return (
    <div className={cn(styles.options, compact && styles.optionsCompact)}>
      <div className={styles.optGroup}>
        <span className={styles.optLabel}>Categoria</span>
        <div className={styles.chips}>
          {categories.map((c) => {
            return (
              <button
                type="button"
                key={c.id}
                className={cn(styles.chip, styles.chipCat, category === c.id && styles.chipOn)}
                style={{ "--cat": c.color } as CSSProperties}
                onClick={() => onCategoryChange(c.id)}
                aria-pressed={category === c.id}
              >
                <CategoryGlyph icon={c.icon} /> {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.optGroup}>
        <span className={styles.optLabel}>Prioridade</span>
        <div className={styles.chips}>
          {(Object.keys(PRIORITIES) as Priority[]).map((key) => {
            const { label, icon: Icon } = PRIORITIES[key];
            return (
              <button
                type="button"
                key={key}
                className={cn(styles.chip, styles[`prio-${key}`], priority === key && styles.chipOn)}
                onClick={() => onPriorityChange(key)}
                aria-pressed={priority === key}
              >
                <Icon size={14} aria-hidden /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.optGroup}>
        <span className={styles.optLabel}>Prazo</span>
        <div className={styles.date}>
          <CalendarDays size={16} aria-hidden />
          <input type="date" value={dueDate} onChange={(e) => onDueDateChange(e.target.value)} aria-label="Prazo" />
          {dueDate && (
            <button type="button" className={styles.dateClear} onClick={() => onDueDateChange("")} aria-label="Remover prazo" title="Remover prazo">
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Repetição depende de um prazo para calcular a próxima data. */}
      {dueDate && (
        <div className={styles.optGroup}>
          <span className={styles.optLabel}>Repetir</span>
          <div className={styles.chips}>
            <button
              type="button"
              className={cn(styles.chip, !recurrence && styles.chipOn)}
              onClick={() => onRecurrenceChange(null)}
              aria-pressed={!recurrence}
            >
              Não repetir
            </button>
            {(Object.keys(RECURRENCES) as Recurrence[]).map((key) => (
              <button
                type="button"
                key={key}
                className={cn(styles.chip, recurrence === key && styles.chipOn)}
                onClick={() => onRecurrenceChange(key)}
                aria-pressed={recurrence === key}
              >
                <Repeat size={14} aria-hidden /> {RECURRENCES[key]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { AlignLeft, PencilLine, Plus, X } from "lucide-react";
import { Button, Card, IconButton } from "@/components/ui";
import type { NewTask, Priority, Recurrence, TaskCategory } from "../lib/types";
import { DescriptionEditor } from "./DescriptionEditor";
import { TaskOptions } from "./TaskOptions";
import styles from "./Tasks.module.scss";

export function TaskForm({ categories, onAdd }: { categories: TaskCategory[]; onAdd: (task: NewTask) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // Cai na primeira categoria se a escolhida foi excluída (ou nada foi escolhido).
  const category = categories.some((c) => c.id === selected) ? selected! : categories[0]?.id;
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");
  // Muda a cada envio para recriar o editor vazio.
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const closeDescription = () => {
    setShowDescription(false);
    setDescription("");
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !category) return;
    setSaving(true);
    try {
      await onAdd({
        title: trimmed,
        description: description || null,
        category,
        priority,
        dueDate: dueDate || null,
        recurrence: dueDate ? recurrence : null,
      });
      setTitle("");
      setDueDate("");
      setRecurrence(null);
      closeDescription();
      setEditorKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={styles.form}>
      <form onSubmit={handleSubmit} className={styles.formInner}>
        <div className={styles.formRow}>
          <label className={styles.titleInput}>
            <PencilLine size={18} aria-hidden />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O que você precisa fazer?"
              maxLength={140}
              aria-label="Título da tarefa"
            />
          </label>
          <Button type="submit" icon={Plus} loading={saving} disabled={!title.trim() || !category}>
            Adicionar
          </Button>
        </div>

        {showDescription ? (
          <div className={styles.descriptionBox}>
            <div className={styles.descriptionHead}>
              <span className={styles.optLabel}>
                <AlignLeft size={14} aria-hidden /> Descrição <em>(opcional)</em>
              </span>
              <IconButton icon={X} size="sm" label="Remover descrição" onClick={closeDescription} />
            </div>
            <DescriptionEditor key={editorKey} value={description} onChange={setDescription} />
          </div>
        ) : (
          <button type="button" className={styles.addDescription} onClick={() => setShowDescription(true)}>
            <AlignLeft size={15} aria-hidden /> Adicionar descrição
          </button>
        )}

        <TaskOptions
          categories={categories}
          category={category}
          onCategoryChange={setSelected}
          priority={priority}
          onPriorityChange={setPriority}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          recurrence={recurrence}
          onRecurrenceChange={setRecurrence}
        />
      </form>
    </Card>
  );
}

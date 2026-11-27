"use client";

import type { CSSProperties } from "react";
import { Bell, CalendarDays, Clock, MapPin, Pencil, Repeat, Trash2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { CategoryGlyph } from "@/features/tasks/components/CategoryGlyph";
import { sanitizeHtml } from "@/features/tasks/lib/sanitize";
import tasksStyles from "@/features/tasks/components/Tasks.module.scss";
import { cn } from "@/lib/utils/cn";
import { useCalendar } from "../data/CalendarDataProvider";
import { categoryOf, durationLabel, mapsUrl } from "../lib/calendar";
import { longDateLabel, shortDateLabel } from "../lib/dates";
import { describeRecurrence } from "../lib/recurrence";
import { reminderLabel } from "../lib/reminders";
import type { EditScope, Occurrence } from "../lib/types";
import styles from "./Calendar.module.scss";

function whenText(o: Occurrence) {
  const { allDay, startTime, endTime } = o.event;
  const sameDay = o.startDate === o.endDate;
  if (allDay) return sameDay ? longDateLabel(o.startDate) : `${shortDateLabel(o.startDate)} – ${shortDateLabel(o.endDate)}`;
  if (sameDay) return longDateLabel(o.startDate);
  return `${shortDateLabel(o.startDate)}, ${startTime} – ${shortDateLabel(o.endDate)}, ${endTime}`;
}

export function EventDetails({
  occurrence: o,
  onClose,
  onEdit,
  onDelete,
}: {
  occurrence: Occurrence;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const s = useCalendar();
  const e = o.event;
  const cat = categoryOf(s.categoriesById, e.category);
  const sameDay = o.startDate === o.endDate;

  return (
    <Modal
      open
      onClose={onClose}
      title={e.title}
      footer={
        e.readOnly ? (
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="ghost" icon={Trash2} onClick={onDelete}>
              Excluir
            </Button>
            <Button icon={Pencil} onClick={onEdit}>
              Editar
            </Button>
          </>
        )
      }
    >
      <div className={styles.details} style={{ "--cat": cat.color } as CSSProperties}>
        <span className={styles.detailCat}>
          <CategoryGlyph icon={cat.icon} size={14} /> {cat.name}
        </span>

        <div className={styles.detailRow}>
          <CalendarDays size={18} aria-hidden />
          <span>{whenText(o)}</span>
        </div>
        {!e.allDay && sameDay && (
          <div className={styles.detailRow}>
            <Clock size={18} aria-hidden />
            <span>
              {e.startTime} – {e.endTime}
              {e.startTime && e.endTime && durationLabel(e.startTime, e.endTime) && (
                <em className={styles.muted}> · {durationLabel(e.startTime, e.endTime)}</em>
              )}
            </span>
          </div>
        )}
        {e.reminders?.length > 0 && (
          <div className={styles.detailRow}>
            <Bell size={18} aria-hidden />
            <span>{[...e.reminders].sort((a, b) => a - b).map((m) => reminderLabel(m, e.allDay)).join(" · ")}</span>
          </div>
        )}
        {e.recurrence && (
          <div className={styles.detailRow}>
            <Repeat size={18} aria-hidden />
            <span>{describeRecurrence(e.recurrence)}</span>
          </div>
        )}
        {e.location && (
          <div className={styles.detailRow}>
            <MapPin size={18} aria-hidden />
            {/^https?:\/\//i.test(e.location) ? (
              <a href={e.location} target="_blank" rel="noreferrer">
                {e.location}
              </a>
            ) : (
              <a href={mapsUrl(e.location)} target="_blank" rel="noreferrer" title="Abrir no mapa">
                {e.location}
              </a>
            )}
          </div>
        )}
        {e.description && (
          <div
            className={cn(styles.detailDescription, tasksStyles.richText)}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.description) }}
          />
        )}
      </div>
    </Modal>
  );
}

const SCOPES: { value: EditScope; label: string; hint: string }[] = [
  { value: "this", label: "Somente este evento", hint: "As outras datas continuam como estão." },
  { value: "following", label: "Este e os seguintes", hint: "A série anterior termina antes desta data." },
  { value: "all", label: "Todos os eventos", hint: "Altera a série inteira." },
];

/** Pergunta qual parte da série recorrente editar ou excluir. */
export function ScopeModal({
  mode,
  onClose,
  onPick,
}: {
  mode: "edit" | "delete";
  onClose: () => void;
  onPick: (scope: EditScope) => void;
}) {
  return (
    <Modal open onClose={onClose} title={mode === "edit" ? "Editar evento recorrente" : "Excluir evento recorrente"}>
      <div className={styles.scopeList}>
        {SCOPES.map((sc) => (
          <button
            key={sc.value}
            type="button"
            className={cn(styles.scopeBtn, mode === "delete" && styles.scopeDanger)}
            onClick={() => onPick(sc.value)}
          >
            <strong>{sc.label}</strong>
            <span>{sc.hint}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

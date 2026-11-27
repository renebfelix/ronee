"use client";

import type { CSSProperties } from "react";
import { MapPin, Repeat } from "lucide-react";
import { CategoryGlyph } from "@/features/tasks/components/CategoryGlyph";
import { useCalendar } from "../data/CalendarDataProvider";
import { categoryOf, timeLabel } from "../lib/calendar";
import type { Occurrence } from "../lib/types";
import styles from "./Calendar.module.scss";

/** Linha de evento nas listas (painel do dia, próximos, visão em lista). */
export function OccurrenceItem({ occurrence: o, day, onOpen }: { occurrence: Occurrence; day?: string; onOpen: (o: Occurrence) => void }) {
  const s = useCalendar();
  const cat = categoryOf(s.categoriesById, o.event.category);

  return (
    <li>
      <button type="button" className={styles.item} style={{ "--cat": cat.color } as CSSProperties} onClick={() => onOpen(o)}>
        <span className={styles.itemBar} aria-hidden />
        <span className={styles.itemTime}>{timeLabel(o, day)}</span>
        <span className={styles.itemMain}>
          <span className={styles.itemTitle}>
            {o.event.title}
            {o.event.recurrence && <Repeat size={12} aria-label="Recorrente" />}
          </span>
          <span className={styles.itemMeta}>
            <span className={styles.itemCat}>
              <CategoryGlyph icon={cat.icon} size={12} /> {cat.name}
            </span>
            {o.event.location && (
              <span className={styles.itemLoc}>
                <MapPin size={12} aria-hidden /> {o.event.location}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

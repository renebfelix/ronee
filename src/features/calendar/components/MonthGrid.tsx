"use client";

import type { CSSProperties } from "react";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCalendar } from "../data/CalendarDataProvider";
import { categoryOf } from "../lib/calendar";
import { monthOf, parseDate, today, WEEKDAYS_SHORT } from "../lib/dates";
import type { Occurrence } from "../lib/types";
import styles from "./Calendar.module.scss";

const MAX_PER_CELL = 3;

export function MonthGrid({
  ym,
  days,
  byDay,
  selected,
  onSelect,
  onCreate,
  onOpen,
}: {
  ym: string;
  days: string[];
  byDay: Record<string, Occurrence[]>;
  selected: string;
  onSelect: (day: string) => void;
  onCreate: (day: string) => void;
  onOpen: (o: Occurrence) => void;
}) {
  const s = useCalendar();
  const now = today();

  return (
    <div className={styles.grid} role="grid" aria-label="Calendário do mês">
      <div className={styles.gridHead} role="row">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      <div className={styles.gridBody}>
        {days.map((day) => {
          const list = byDay[day] ?? [];
          const outside = monthOf(day) !== ym;
          const extra = list.length - MAX_PER_CELL;
          return (
            <div
              key={day}
              role="gridcell"
              tabIndex={0}
              aria-selected={day === selected}
              aria-label={`${parseDate(day).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}, ${list.length} eventos`}
              className={cn(styles.cell, outside && styles.cellOutside, day === selected && styles.cellSelected)}
              onClick={() => onSelect(day)}
              onDoubleClick={() => onCreate(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(day);
              }}
            >
              <span className={cn(styles.dayNum, day === now && styles.dayToday)}>{parseDate(day).getDate()}</span>

              {/* Telas largas: pílulas com título. */}
              <div className={styles.pills}>
                {list.slice(0, MAX_PER_CELL).map((o) => {
                  const cat = categoryOf(s.categoriesById, o.event.category);
                  const block = o.event.allDay || o.startDate !== o.endDate;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      className={cn(styles.pill, block && styles.pillBlock)}
                      style={{ "--cat": cat.color } as CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(day);
                        onOpen(o);
                      }}
                      title={o.event.title}
                    >
                      {!block && <i className={styles.pillDot} aria-hidden />}
                      {!block && o.startDate === day && <span className={styles.pillTime}>{o.event.startTime}</span>}
                      <span className={styles.pillTitle}>{o.event.title}</span>
                      {o.event.recurrence && <Repeat size={10} className={styles.pillRepeat} aria-hidden />}
                    </button>
                  );
                })}
                {extra > 0 && <span className={styles.more}>+{extra} mais</span>}
              </div>

              {/* Telas pequenas: só pontinhos coloridos. */}
              <div className={styles.dots} aria-hidden>
                {list.slice(0, 4).map((o) => (
                  <i key={o.key} style={{ background: categoryOf(s.categoriesById, o.event.category).color }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

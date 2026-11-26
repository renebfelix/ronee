"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SORT_OPTIONS } from "../lib/tasks";
import type { SortKey } from "../lib/types";
import styles from "./Tasks.module.scss";

export function SortMenu({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.sort} ref={ref}>
      <button
        type="button"
        className={cn(styles.sortTrigger, open && styles.sortTriggerOpen)}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ArrowUpDown size={15} aria-hidden />
        <span className={styles.sortPrefix}>Ordenar:</span>
        <strong>{current.label}</strong>
        <ChevronDown size={15} className={styles.chevron} aria-hidden />
      </button>

      {open && (
        <ul className={styles.sortMenu} role="menu">
          {SORT_OPTIONS.map(({ key, label, hint, icon: Icon }) => (
            <li key={key}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={key === value}
                className={cn(styles.sortOption, key === value && styles.sortOptionOn)}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                <span className={styles.sortIcon}>
                  <Icon size={15} aria-hidden />
                </span>
                <span className={styles.sortText}>
                  {label}
                  <small>{hint}</small>
                </span>
                {key === value && <Check size={15} className={styles.sortCheck} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

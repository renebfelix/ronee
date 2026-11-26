"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import styles from "./RichEditor.module.scss";

/**
 * Botão da barra com painel flutuante. O painel vai para o <body> (position: fixed),
 * para não ser cortado pela rolagem horizontal da barra no celular.
 */
export function Popover({
  icon: Icon,
  label,
  active,
  disabled,
  swatch,
  caret = true,
  align = "start",
  children,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  /** Barrinha de cor sob o ícone (cor atual do texto/marca-texto). */
  swatch?: string | null;
  caret?: boolean;
  align?: "start" | "end";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    const p = panelRef.current?.getBoundingClientRect();
    if (!b) return;
    const width = p?.width ?? 240;
    const height = p?.height ?? 0;
    let left = align === "end" ? b.right - width : b.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = b.bottom + 6;
    if (height && top + height > window.innerHeight - 8) top = Math.max(8, b.top - height - 6);
    setPos({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={cn(styles.tbtn, caret && styles.tbtnCaret, (active || open) && styles.tbtnOn)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.tbtnIcon}>
          <Icon size={17} aria-hidden />
          {swatch !== undefined && <span className={styles.swatchBar} style={{ background: swatch ?? "transparent" }} />}
        </span>
        {caret && <ChevronDown size={12} aria-hidden className={styles.caret} />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={styles.popover}
            role="dialog"
            aria-label={label}
            style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

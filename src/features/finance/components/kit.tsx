"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, Button, IconButton, Modal } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { addMonths } from "../lib/finance";
import { COLORS, monthLabel } from "../lib/format";
import { FinIcon, ICONS } from "./icons";
import ui from "./kit.module.scss";

/** Classes dos controles de formulário (input, select, textarea) e layouts do módulo de Finanças. */
export { ui };

export function Field({ label, hint, warn, children }: { label: string; hint?: ReactNode; warn?: boolean; children: ReactNode }) {
  return (
    <label className={ui.field}>
      <span className={ui.label}>{label}</span>
      {children}
      {hint && <span className={cn(ui.hint, warn && ui.hintWarn)}>{hint}</span>}
    </label>
  );
}

/** Mesmo visual do Field, sem <label> (para grupos com vários controles). */
export function FieldGroup({ label, hint, warn, children }: { label: string; hint?: ReactNode; warn?: boolean; children: ReactNode }) {
  return (
    <div className={ui.field}>
      <span className={ui.label}>{label}</span>
      {children}
      {hint && <span className={cn(ui.hint, warn && ui.hintWarn)}>{hint}</span>}
    </div>
  );
}

export function Hint({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return <span className={cn(ui.hint, warn && ui.hintWarn)}>{children}</span>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  return (
    <div className={ui.seg} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cn(ui.segBtn, value === o.value && ui.segOn)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  return (
    <div className={ui.monthpicker}>
      <IconButton icon={ChevronLeft} label="Mês anterior" size="sm" onClick={() => onChange(addMonths(value, -1))} />
      <strong>{monthLabel(value)}</strong>
      <IconButton icon={ChevronRight} label="Próximo mês" size="sm" onClick={() => onChange(addMonths(value, 1))} />
    </div>
  );
}

export function Person({ name, url, size = "sm" }: { name: string; url?: string; size?: "sm" | "md" }) {
  return <Avatar name={name} src={url} size={size} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className={ui.error} role="alert">
      {children}
    </p>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = "Excluir",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirmLabel?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  );
}

export function AppearancePicker({
  color,
  icon,
  onColor,
  onIcon,
}: {
  color: string;
  icon: string;
  onColor: (c: string) => void;
  onIcon: (i: string) => void;
}) {
  return (
    <>
      <FieldGroup label="Cor">
        <div className={ui.swatches}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(ui.swatch, c === color && ui.swatchOn)}
              style={{ background: c }}
              onClick={() => onColor(c)}
              aria-label={`Cor ${c}`}
              aria-pressed={c === color}
            />
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Ícone">
        <div className={ui.iconpick}>
          {Object.keys(ICONS).map((i) => (
            <button
              key={i}
              type="button"
              className={cn(ui.iconpickBtn, i === icon && ui.iconpickOn)}
              style={i === icon ? { color, borderColor: color } : undefined}
              onClick={() => onIcon(i)}
              aria-label={i}
              aria-pressed={i === icon}
            >
              <FinIcon name={i} size={18} />
            </button>
          ))}
        </div>
      </FieldGroup>
    </>
  );
}

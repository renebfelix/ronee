import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "../Spinner";
import styles from "./Button.module.scss";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone Lucide à esquerda do texto. */
  icon?: LucideIcon;
  /** Ícone Lucide à direita do texto. */
  iconRight?: LucideIcon;
  /** Conteúdo visual customizado à esquerda (ex.: logo do Google). */
  leading?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  leading,
  loading = false,
  fullWidth = false,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = ICON_SIZE[size];
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className)}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : (leading ?? (Icon && <Icon size={iconSize} aria-hidden />))}
      {children && <span className={styles.label}>{children}</span>}
      {!loading && IconRight && <IconRight size={iconSize} aria-hidden />}
    </button>
  );
}

import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import styles from "./IconButton.module.scss";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  /** Texto acessível obrigatório (botões só com ícone precisam de rótulo). */
  label: string;
  variant?: "ghost" | "outline" | "primary";
  size?: "sm" | "md" | "lg";
  /** Exibe um pequeno ponto de notificação. */
  dot?: boolean;
}

const ICON_SIZE = { sm: 16, md: 20, lg: 22 } as const;

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  dot = false,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(styles.iconButton, styles[variant], styles[size], className)}
      {...rest}
    >
      <Icon size={ICON_SIZE[size]} aria-hidden />
      {dot && <span className={styles.dot} aria-hidden />}
    </button>
  );
}

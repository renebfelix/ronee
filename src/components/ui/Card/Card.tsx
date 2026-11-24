import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import styles from "./Card.module.scss";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  /** Efeito de elevação ao passar o mouse (para cards clicáveis). */
  interactive?: boolean;
}

export function Card({ padding = "md", interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(styles.card, styles[`pad-${padding}`], interactive && styles.interactive, className)}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Conteúdo alinhado à direita (botões, badges...). */
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }: CardHeaderProps) {
  return (
    <div className={cn(styles.header, className)}>
      {Icon && (
        <span className={styles.headerIcon}>
          <Icon size={20} aria-hidden />
        </span>
      )}
      <div className={styles.headerText}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

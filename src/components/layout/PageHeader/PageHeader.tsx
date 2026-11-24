import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import styles from "./PageHeader.module.scss";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Ações à direita (em telas pequenas quebram para baixo). */
  actions?: ReactNode;
  className?: string;
}

/** Cabeçalho padrão de página — use no topo de cada módulo. */
export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn(styles.header, className)}>
      <div className={styles.heading}>
        {Icon && (
          <span className={styles.icon}>
            <Icon size={24} aria-hidden />
          </span>
        )}
        <div className={styles.text}>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import styles from "./Logo.module.scss";

export interface LogoProps {
  /** Esconde o nome e mostra só o símbolo. */
  compact?: boolean;
  size?: "md" | "lg";
  className?: string;
}

export function Logo({ compact = false, size = "md", className }: LogoProps) {
  return (
    <span className={cn(styles.logo, styles[size], className)}>
      <span className={styles.mark}>
        <Sparkles size={size === "lg" ? 24 : 20} aria-hidden />
      </span>
      {!compact && <span className={styles.name}>Ronee</span>}
    </span>
  );
}

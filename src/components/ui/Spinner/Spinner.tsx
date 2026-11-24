import { cn } from "@/lib/utils/cn";
import styles from "./Spinner.module.scss";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label = "Carregando", className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn(styles.spinner, styles[size], className)} />
  );
}

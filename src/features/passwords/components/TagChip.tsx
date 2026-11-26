import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import type { PasswordTag } from "../lib/types";
import styles from "./PasswordsView.module.scss";

/** Tag colorida. Com `onClick` vira um botão alternável (filtro ou seleção no formulário). */
export function TagChip({ tag, selected, onClick }: { tag: PasswordTag; selected?: boolean; onClick?: () => void }) {
  const style = { "--tag": tag.color } as CSSProperties;
  if (!onClick) {
    return (
      <span className={styles.tag} style={style}>
        {tag.name}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cn(styles.chip, selected && styles.chipOn)}
      style={style}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.dot} aria-hidden />
      {tag.name}
    </button>
  );
}

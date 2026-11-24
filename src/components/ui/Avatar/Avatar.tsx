/* eslint-disable @next/next/no-img-element -- fotos de perfil vêm de domínios externos variados */
import { cn } from "@/lib/utils/cn";
import styles from "./Avatar.module.scss";

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <span className={cn(styles.avatar, styles[size], className)} aria-hidden={!name} title={name ?? undefined}>
      {src ? (
        <img src={src} alt={name ?? ""} referrerPolicy="no-referrer" className={styles.image} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

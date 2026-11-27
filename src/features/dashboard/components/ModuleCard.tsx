"use client";

import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, Spinner } from "@/components/ui";
import { NAVIGATION, getNavItemTarget, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import styles from "../Dashboard.module.scss";

function navItem(id: string): NavItem {
  for (const section of NAVIGATION) {
    const found = section.items.find((i) => i.id === id);
    if (found) return found;
  }
  throw new Error(`Módulo não encontrado na navegação: ${id}`);
}

export function moduleLabel(id: string) {
  return navItem(id).label;
}

export function ModuleIcon({ id, size = 20 }: { id: string; size?: number }) {
  const item = navItem(id);
  const Icon = item.icon;
  return (
    <span className={cn(styles.cardIcon, styles[`accent-${item.accent}`])}>
      <Icon size={size} aria-hidden />
    </span>
  );
}

interface ModuleCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
  id: string;
  wide?: boolean;
  /** Controles do modo "Organizar"; substituem o link "Abrir". */
  toolbar?: ReactNode;
  children: ReactNode;
}

/** Card de um módulo: cabeçalho com ícone, nome e atalho; o resumo vem em `children`. */
export function ModuleCard({ id, wide, toolbar, children, className, ...rest }: ModuleCardProps) {
  const item = navItem(id);
  const href = getNavItemTarget(item);
  return (
    <Card className={cn(styles.card, wide && styles.wide, toolbar != null && styles.editing, className)} {...rest}>
      <div className={styles.cardHeader}>
        <ModuleIcon id={id} />
        <h2 className={styles.cardTitle}>{item.label}</h2>
        {toolbar ?? (
          <Link href={href} className={styles.open}>
            Abrir <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </Card>
  );
}

export type Tone = "success" | "danger" | "warning" | "info" | "primary";

export interface StatItem {
  label: string;
  value: ReactNode;
  tone?: Tone;
}

export function Stats({ items }: { items: StatItem[] }) {
  return (
    <dl className={styles.stats}>
      {items.map((s) => (
        <div key={s.label} className={styles.stat}>
          <dt>{s.label}</dt>
          <dd className={s.tone ? styles[`tone-${s.tone}`] : undefined}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface ListEntry {
  key: string;
  title: string;
  meta?: ReactNode;
  /** Texto à direita (valor, prazo...). */
  aside?: ReactNode;
  color?: string;
  href?: string;
  tone?: Tone;
}

export function MiniList({ title, items, empty }: { title: string; items: ListEntry[]; empty: string }) {
  return (
    <div className={styles.listBlock}>
      <h3 className={styles.listTitle}>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((it) => {
            const content = (
              <>
                <span className={styles.dot} style={{ background: it.color ?? "var(--color-border)" }} aria-hidden />
                <span className={styles.itemText}>
                  <span className={styles.itemTitle}>{it.title}</span>
                  {it.meta && <span className={styles.itemMeta}>{it.meta}</span>}
                </span>
                {it.aside && (
                  <span className={cn(styles.itemAside, it.tone && styles[`tone-${it.tone}`])}>{it.aside}</span>
                )}
              </>
            );
            return (
              <li key={it.key}>
                {it.href ? (
                  <Link href={it.href} className={styles.item}>
                    {content}
                  </Link>
                ) : (
                  <div className={styles.item}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Meter({ label, value, max, hint }: { label: string; value: number; max: number; hint: ReactNode }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct > 90 ? "danger" : pct >= 70 ? "warning" : "success";
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <span className={styles.meterHint}>{hint}</span>
      </div>
      <div className={styles.meterTrack} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span className={cn(styles.meterBar, styles[`bar-${tone}`])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CardLoading({ label }: { label: string }) {
  return (
    <div className={styles.loading}>
      <Spinner label={label} />
    </div>
  );
}

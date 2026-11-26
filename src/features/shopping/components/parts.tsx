"use client";

import { useState } from "react";
import { Package, Search, X } from "lucide-react";
import { IconButton, Modal } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { ui } from "@/features/finance/components/kit";
import { variantLabel } from "../lib/shopping";
import type { Product } from "../lib/types";
import styles from "./Shopping.module.scss";

type ThumbSize = "md" | "lg" | "hero";
const THUMB_CLASS: Record<ThumbSize, string | undefined> = { md: undefined, lg: styles.thumbLg, hero: styles.thumbHero };
const THUMB_ICON: Record<ThumbSize, number> = { md: 20, lg: 24, hero: 36 };

/**
 * Foto do produto hospedada no ImgBB. Sem foto, mostra um ícone.
 * Com `zoom`, clicar abre a imagem ampliada.
 */
export function ProductThumb({ src, alt, size = "md", zoom = false }: { src?: string; alt: string; size?: ThumbSize; zoom?: boolean }) {
  const [open, setOpen] = useState(false);
  const cls = cn(styles.thumb, THUMB_CLASS[size]);
  if (!src) {
    return (
      <span className={cn(cls, styles.thumbPlaceholder)} aria-hidden>
        <Package size={THUMB_ICON[size]} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- imagem externa (ImgBB), sem otimização do Next
  const img = <img className={cls} src={src} alt={alt} loading="lazy" decoding="async" />;
  if (!zoom) return img;
  return (
    <>
      <button type="button" className={styles.thumbButton} onClick={() => setOpen(true)} aria-label={`Ampliar foto de ${alt}`}>
        {img}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={alt} size="lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem externa (ImgBB) */}
        <img className={styles.viewer} src={src} alt={alt} />
      </Modal>
    </>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar produto…",
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={styles.search}>
      <Search className={styles.searchIcon} size={18} aria-hidden />
      <input type="search" value={value} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && <IconButton className={styles.searchClear} icon={X} size="sm" label="Limpar busca" onClick={() => onChange("")} />}
    </div>
  );
}

/** Select "Marca - tamanho"; só aparece se o produto tiver marcas cadastradas. */
export function VariantSelect({
  product,
  value,
  onChange,
  className,
}: {
  product: Product;
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  if (!product.variants?.length) return null;
  return (
    <select
      className={cn(ui.select, className)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={`Marca de ${product.name}`}
    >
      <option value="">Sem marca definida</option>
      {product.variants.map((v) => (
        <option key={v.id} value={v.id}>
          {variantLabel(v)}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button, IconButton, Modal } from "@/components/ui";
import { Field, FieldGroup, Hint, ui } from "@/features/finance/components/kit";
import { RegistryForm } from "@/features/finance/registries/RegistryView";
import { useShopping } from "../data/ShoppingDataProvider";
import { newVariantId, SIZE_UNITS, UNITS } from "../lib/shopping";
import { MAX_IMAGE_BYTES, uploadImage } from "../lib/upload";
import type { Product } from "../lib/types";
import { ProductThumb } from "./parts";
import styles from "./Shopping.module.scss";

/** Linha do formulário de marcas: tamanho como texto enquanto é digitado. */
interface VariantDraft {
  id: string;
  brand: string;
  size: string;
  sizeUnit: string;
}

export function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const s = useShopping();
  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? UNITS[0]);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? s.categories[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.imageUrl ?? "");
  const [removed, setRemoved] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>(
    (product?.variants ?? []).map((v) => ({ ...v, size: v.size == null ? "" : String(v.size) })),
  );

  // Libera a URL temporária da prévia local.
  useEffect(() => () => void (preview.startsWith("blob:") && URL.revokeObjectURL(preview)), [preview]);

  const editVariant = (id: string, data: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, ...data } : v)));

  function pickFile(next: File | undefined) {
    setPhotoError("");
    if (!next) return;
    if (!next.type.startsWith("image/")) return setPhotoError("Escolha um arquivo de imagem.");
    if (next.size > MAX_IMAGE_BYTES) return setPhotoError("A imagem deve ter no máximo 8 MB.");
    setFile(next);
    setRemoved(false);
    setPreview(URL.createObjectURL(next));
  }

  const submit = async () => {
    if (!name.trim()) return "Informe o nome do produto.";
    if (!categoryId) return "Escolha a categoria.";
    let imageUrl = removed ? "" : (product?.imageUrl ?? "");
    if (file) {
      try {
        imageUrl = await uploadImage(file);
      } catch (err) {
        return `Não foi possível enviar a foto: ${(err as Error).message}`;
      }
    }
    await s.saveProduct({
      id: product?.id,
      name: name.trim(),
      unit,
      categoryId,
      imageUrl,
      // Linhas sem marca e sem tamanho são descartadas.
      variants: variants
        .filter((v) => v.brand.trim() || v.size !== "")
        .map((v) => ({ id: v.id, brand: v.brand.trim(), size: v.size === "" ? null : Number(v.size), sizeUnit: v.sizeUnit })),
    });
  };

  if (s.categories.length === 0) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Novo produto"
        footer={
          <Link href="/compras/categorias" className={styles.fileButton}>
            Criar categoria
          </Link>
        }
      >
        <p>Crie uma categoria antes de adicionar produtos.</p>
      </Modal>
    );
  }

  return (
    <RegistryForm title={product ? "Editar produto" : "Novo produto"} onClose={onClose} onSubmit={submit}>
      <Field label="Nome">
        <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Arroz" autoFocus />
      </Field>

      <FieldGroup label="Foto" hint={photoError || undefined} warn={!!photoError}>
        <div className={styles.photoPicker}>
          <ProductThumb src={preview} alt={name || "Produto"} size="lg" />
          <div className={styles.photoActions}>
            <label className={styles.fileButton}>
              <ImagePlus size={16} aria-hidden />
              {preview ? "Trocar foto" : "Enviar foto"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {preview && (
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  setFile(null);
                  setPreview("");
                  setRemoved(true);
                }}
              >
                Remover
              </Button>
            )}
          </div>
        </div>
      </FieldGroup>

      <div className={ui.grid2}>
        <Field label="Unidade de medida">
          <select className={ui.select} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className={ui.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {s.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <FieldGroup label="Marcas e tamanhos · opcional">
        <div className={styles.variants}>
          {variants.map((v) => (
            <div className={styles.variantRow} key={v.id}>
              <input
                className={ui.input}
                placeholder="Marca (opcional)"
                value={v.brand}
                onChange={(e) => editVariant(v.id, { brand: e.target.value })}
                aria-label="Marca"
              />
              <input
                className={ui.input}
                type="number"
                step="any"
                min="0"
                placeholder="Tamanho"
                value={v.size}
                onChange={(e) => editVariant(v.id, { size: e.target.value })}
                aria-label="Tamanho"
              />
              <select className={ui.select} value={v.sizeUnit} onChange={(e) => editVariant(v.id, { sizeUnit: e.target.value })} aria-label="Unidade do tamanho">
                {SIZE_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <IconButton icon={X} size="sm" label="Remover marca" onClick={() => setVariants((vs) => vs.filter((x) => x.id !== v.id))} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={() => setVariants((vs) => [...vs, { id: newVariantId(), brand: "", size: "", sizeUnit: SIZE_UNITS[0] }])}
          >
            Adicionar marca
          </Button>
          {variants.length === 0 && <Hint>Ex.: “Camil - 5 kg”. Na lista você escolhe qual marca comprar.</Hint>}
        </div>
      </FieldGroup>
    </RegistryForm>
  );
}

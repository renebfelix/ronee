"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, DatabaseZap, PackageOpen, PackageSearch, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Badge, Button, Card, EmptyState, IconButton } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { ConfirmModal } from "@/features/finance/components/kit";
import { useShopping } from "./data/ShoppingDataProvider";
import { matches } from "./lib/shopping";
import type { Product } from "./lib/types";
import { ProductForm } from "./components/ProductForm";
import { ProductThumb, SearchInput } from "./components/parts";
import styles from "./components/Shopping.module.scss";

export function ProductsView() {
  const s = useShopping();
  const router = useRouter();
  const { label, icon } = getNavSubItem("shopping-products");
  // `null` = fechado; `{ product: null }` = novo produto.
  const [form, setForm] = useState<{ product: Product | null } | null>(null);
  const [del, setDel] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const found = s.products.filter((p) => matches(search, p.name, s.categoryName(p.categoryId)));

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description="O que você costuma comprar todo mês, com foto, marcas e histórico de preços."
        actions={
          <>
            <Button variant="outline" icon={DatabaseZap} onClick={() => router.push("/compras/importar")}>
              Importar do Store Leest
            </Button>
            <Button icon={Plus} onClick={() => setForm({ product: null })}>
              Novo produto
            </Button>
          </>
        }
      />

      {s.products.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nenhum produto"
          description="Cadastre o que você costuma comprar todo mês para montar a lista rapidamente."
          action={
            <Button icon={Plus} onClick={() => setForm({ product: null })}>
              Novo produto
            </Button>
          }
        />
      ) : (
        <>
          <SearchInput value={search} onChange={setSearch} />
          {found.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Nada encontrado" description={`Nenhum produto encontrado para “${search}”.`} />
          ) : (
            <Card padding="none">
              <ul className={styles.list}>
                {found.map((p) => (
                  <li className={styles.row} key={p.id}>
                    <ProductThumb src={p.imageUrl} alt={p.name} zoom />
                    <Link href={`/compras/produtos/${p.id}`} className={`${styles.main} ${styles.link}`}>
                      <span className={styles.name}>
                        <span>{p.name}</span> <ChevronRight size={15} aria-hidden />
                      </span>
                      <span className={styles.meta}>
                        <Badge>{s.categoryName(p.categoryId)}</Badge>
                        {p.unit}
                        {!!p.variants?.length && ` · ${p.variants.length} ${p.variants.length === 1 ? "marca" : "marcas"}`}
                      </span>
                    </Link>
                    <div className={styles.actions}>
                      <IconButton icon={Pencil} size="sm" label={`Editar ${p.name}`} onClick={() => setForm({ product: p })} />
                      <IconButton icon={Trash2} size="sm" label={`Excluir ${p.name}`} onClick={() => setDel(p)} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {form && <ProductForm key={form.product?.id ?? "new"} product={form.product} onClose={() => setForm(null)} />}
      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (del) await s.removeProduct(del.id);
          setDel(null);
        }}
        title="Excluir produto"
        text={`Excluir “${del?.name}” dos produtos? O histórico de compras continua salvo.`}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, Receipt, Store, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { ConfirmModal } from "@/features/finance/components/kit";
import { brl, dateBR } from "@/features/finance/lib/format";
import { useShopping } from "./data/ShoppingDataProvider";
import type { Purchase } from "./lib/types";
import styles from "./components/Shopping.module.scss";

export function HistoryView() {
  const s = useShopping();
  const { label, icon } = getNavSubItem("shopping-history");
  const [del, setDel] = useState<Purchase | null>(null);
  const total = s.purchases.reduce((sum, p) => sum + p.total, 0);

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description={
          s.purchases.length
            ? `${s.purchases.length} ${s.purchases.length === 1 ? "compra finalizada" : "compras finalizadas"} · ${brl(total)} no total`
            : "Suas idas ao mercado finalizadas."
        }
      />

      {s.purchases.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma compra finalizada"
          description="Use “Finalizar compras” na lista do mês quando sair do mercado."
        />
      ) : (
        <Card padding="none">
          {s.purchases.map((p) => (
            <details className={styles.purchase} key={p.id}>
              <summary className={styles.row}>
                <span className={styles.rowIcon}>
                  <Store size={20} aria-hidden />
                </span>
                <div className={styles.main}>
                  <span className={styles.name}>
                    <span>{p.store}</span>
                  </span>
                  <span className={styles.meta}>
                    <CalendarDays size={13} aria-hidden /> {dateBR(p.date)} · {p.items.length} {p.items.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <strong className={styles.priceTag}>{brl(p.total)}</strong>
                <ChevronDown className={styles.chevron} size={18} aria-hidden />
              </summary>
              <ul className={styles.purchaseItems}>
                {p.items.map((i) => {
                  const label = (
                    <>
                      {i.name} {i.temp && <Badge>Avulso</Badge>}{" "}
                      {i.variant && <small className={styles.muted}>{i.variant} · </small>}
                      <small className={styles.muted}>
                        {i.price != null
                          ? `${i.quantity} ${i.unit} × ${brl(i.price)}${i.priceType === "wholesale" ? " (atacado)" : ""}`
                          : `${i.quantity} ${i.unit} · sem preço`}
                      </small>
                    </>
                  );
                  return (
                    <li key={i.productId}>
                      {/* Item avulso não tem página de produto. */}
                      {i.temp ? <span>{label}</span> : <Link href={`/compras/produtos/${i.productId}`}>{label}</Link>}
                      <span>{i.price != null ? brl(i.price * i.quantity) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.purchaseActions}>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDel(p)}>
                  Excluir compra
                </Button>
              </div>
            </details>
          ))}
        </Card>
      )}

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          if (del) await s.removePurchase(del.id);
          setDel(null);
        }}
        title="Excluir compra"
        text={del ? `Excluir a compra no ${del.store} de ${dateBR(del.date)}? Os preços dela saem do histórico.` : ""}
      />
    </>
  );
}

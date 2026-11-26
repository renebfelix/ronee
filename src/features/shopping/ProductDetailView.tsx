"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChartLine, ChartNoAxesColumn, PackageX, Pencil, Ruler, Trophy } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { brl, dateBR } from "@/features/finance/lib/format";
import { useShopping } from "./data/ShoppingDataProvider";
import { variantLabel } from "./lib/shopping";
import type { PricePoint, PriceRecord } from "./lib/types";
import { ProductForm } from "./components/ProductForm";
import { ProductThumb } from "./components/parts";
import styles from "./components/Shopping.module.scss";

const STORE_COLORS = ["#16a571", "#e0558f", "#5b5bf0", "#e8a317", "#0f8fd6", "#8e44ec"];

const AXIS = { stroke: "var(--color-text-subtle)", fontSize: 12 } as const;
const TOOLTIP = {
  contentStyle: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    color: "var(--color-text)",
  },
  formatter: (v: unknown) => brl(Number(v)),
} as const;

export function ProductDetailView() {
  const { id } = useParams<{ id: string }>();
  const s = useShopping();
  const product = s.products.find((p) => p.id === id);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [editing, setEditing] = useState(false);
  const { getPriceHistory } = s;

  useEffect(() => {
    getPriceHistory(id, 4).then(setHistory).catch(() => setHistory([]));
  }, [id, getPriceHistory]);

  const records = useMemo(() => s.priceRecords.filter((r) => r.productId === id), [s.priceRecords, id]);

  // Uma linha por mercado (preço de atacado em linha própria), um ponto por data de compra.
  const { stores, byDate, byStore } = useMemo(() => {
    const key = (r: PriceRecord) => (r.priceType === "wholesale" ? `${r.store} (atacado)` : r.store);
    const stores = [...new Set(records.map(key))];
    const dates = new Map<string, Record<string, number | string>>();
    records.forEach((r) => {
      const row = dates.get(r.date) ?? { date: dateBR(r.date).slice(0, 5) };
      row[key(r)] = r.price;
      dates.set(r.date, row);
    });
    const byStore = stores
      .map((store) => {
        const list = records.filter((r) => key(r) === store);
        const prices = list.map((r) => r.price);
        return { store, last: list[list.length - 1], min: Math.min(...prices), max: Math.max(...prices) };
      })
      .sort((a, b) => a.last.price - b.last.price);
    return { stores, byDate: [...dates.values()], byStore };
  }, [records]);

  const back = (
    <Link href="/compras/produtos" className={styles.back}>
      <ArrowLeft size={16} aria-hidden /> Voltar aos produtos
    </Link>
  );

  if (!product) {
    return (
      <>
        {back}
        <EmptyState icon={PackageX} title="Produto não encontrado" description="Ele pode ter sido excluído." />
      </>
    );
  }

  const hasLegacy = history.some((h) => h.price != null);
  const best = byStore[0];

  return (
    <>
      {back}
      <div className={styles.detailHead}>
        <ProductThumb src={product.imageUrl} alt={product.name} size="hero" zoom />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{product.name}</h1>
          <p className={styles.iconText}>
            <Ruler size={15} aria-hidden /> Unidade: {product.unit} · {s.categoryName(product.categoryId)}
          </p>
          {!!product.variants?.length && (
            <p className={styles.iconText}>Marcas: {product.variants.map(variantLabel).join(", ")}</p>
          )}
          {best && (
            <Badge tone="success" icon={Trophy}>
              Mais barato: {best.store} · {brl(best.last.price)}
            </Badge>
          )}
        </div>
        <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>

      {records.length > 0 ? (
        <>
          <h2 className={styles.sectionTitle}>
            <ChartLine size={20} aria-hidden /> Preço por mercado
          </h2>
          <Card>
            <div className={styles.chart}>
              <ResponsiveContainer>
                <LineChart data={byDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" {...AXIS} />
                  <YAxis tickFormatter={(v: number) => `R$${v}`} {...AXIS} width={56} />
                  <Tooltip {...TOOLTIP} />
                  {stores.length > 1 && <Legend />}
                  {stores.map((st, i) => (
                    <Line
                      key={st}
                      type="monotone"
                      dataKey={st}
                      stroke={STORE_COLORS[i % STORE_COLORS.length]}
                      strokeWidth={3}
                      connectNulls
                      dot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mercado</th>
                    <th>Último preço</th>
                    <th>Menor</th>
                    <th>Maior</th>
                  </tr>
                </thead>
                <tbody>
                  {byStore.map((st, i) => (
                    <tr key={st.store}>
                      <td className={i === 0 ? styles.best : undefined}>
                        {i === 0 && <Trophy size={14} aria-hidden />} {st.store}
                      </td>
                      <td className={i === 0 ? styles.best : undefined}>
                        {brl(st.last.price)} <small className={styles.muted}>em {dateBR(st.last.date)}</small>
                      </td>
                      <td>{brl(st.min)}</td>
                      <td>{brl(st.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : hasLegacy ? (
        <>
          <h2 className={styles.sectionTitle}>
            <ChartLine size={20} aria-hidden /> Preço nos últimos 4 meses
          </h2>
          <Card>
            <div className={styles.chart}>
              <ResponsiveContainer>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" {...AXIS} />
                  <YAxis tickFormatter={(v: number) => `R$${v}`} {...AXIS} width={56} />
                  <Tooltip {...TOOLTIP} />
                  <Line type="monotone" dataKey="price" name="Preço" stroke={STORE_COLORS[0]} strokeWidth={3} connectNulls dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={ChartNoAxesColumn}
          title="Sem preços registrados"
          description="Os preços aparecem quando você finaliza uma compra na lista do mês."
        />
      )}

      {editing && <ProductForm product={product} onClose={() => setEditing(false)} />}
    </>
  );
}

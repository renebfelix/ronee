"use client";

import { useId, useState, type ReactNode } from "react";
import {
  CheckCheck,
  CircleDollarSign,
  ClipboardPlus,
  ListPlus,
  PackageSearch,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Badge, Button, Card, EmptyState, IconButton, Modal, Spinner } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { ErrorText, Field, FieldGroup, MonthPicker, Segmented, ui } from "@/features/finance/components/kit";
import { brl } from "@/features/finance/lib/format";
import { useMonthItems, useShopping } from "./data/ShoppingDataProvider";
import { findVariant, matches, monthKey, PRICE_TYPES, shiftMonth, TEMP_GROUP, todayKey, UNITS, variantLabel } from "./lib/shopping";
import type { MonthItem, PriceType, Product, PurchaseItem } from "./lib/types";
import { ProductThumb, SearchInput, VariantSelect } from "./components/parts";
import styles from "./components/Shopping.module.scss";

export function ShoppingListView() {
  const s = useShopping();
  const { label, icon } = getNavSubItem("shopping-list");
  const [month, setMonth] = useState(monthKey());
  const loaded = useMonthItems(month);
  const prev = useMonthItems(shiftMonth(month, -1)) ?? [];
  const items = loaded ?? [];
  const [adding, setAdding] = useState(false);
  const [addingTemp, setAddingTemp] = useState(false);
  // `inCart` = valor inicial do "foi para o carrinho?".
  const [pricing, setPricing] = useState<{ product: Product; inCart: boolean } | null>(null);
  const [finishing, setFinishing] = useState(false);

  const itemOf = (id: string) => items.find((i) => i.id === id);
  // Itens avulsos viram "produtos" só para exibição (sem cadastro nem foto).
  const tempProducts: Product[] = items
    .filter((i) => i.temp)
    .map((i) => ({ id: i.id, name: i.name ?? "Item", unit: i.unit ?? UNITS[0], categoryId: TEMP_GROUP }));
  const inList = [...s.products.filter((p) => itemOf(p.id)), ...tempProducts];
  const available = s.products.filter((p) => !itemOf(p.id));

  const groupMap = new Map<string, Product[]>();
  inList.forEach((p) => {
    const k = p.categoryId ?? "none";
    groupMap.set(k, [...(groupMap.get(k) ?? []), p]);
  });
  const groups = [...groupMap.entries()].map(([k, list]) => ({
    key: k,
    name: k === TEMP_GROUP ? "Itens avulsos" : s.categoryName(k),
    list,
  }));

  const total = items.filter((i) => i.checked).reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 1), 0);
  const expected = items.reduce((sum, i) => {
    const old = prev.find((x) => x.id === i.id);
    // Item avulso não tem histórico: usa o preço informado nele.
    const price = i.temp ? (i.price ?? 0) : (s.lastPrice.get(i.id) ?? old?.price ?? 0);
    return sum + price * (i.quantity ?? old?.quantity ?? 1);
  }, 0);
  const inCart = inList.filter((p) => itemOf(p.id)?.checked);

  const add = (p: Product, quantity: number, variantId: string | null) =>
    s.setMonthItem(month, p.id, { checked: false, quantity, variantId });

  const toggle = async (p: Product) => {
    const it = itemOf(p.id)!;
    if (!it.checked && it.price == null) return setPricing({ product: p, inCart: true }); // pede o preço ao marcar
    await s.setMonthItem(month, p.id, { checked: !it.checked });
  };

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description="Monte a lista do mês, marque o que foi para o carrinho e acompanhe o total."
        actions={<MonthPicker value={month} onChange={setMonth} />}
      />

      <div className={styles.toolbar}>
        <Button icon={ListPlus} onClick={() => setAdding(true)}>
          Adicionar dos produtos
        </Button>
        <Button variant="outline" icon={ClipboardPlus} onClick={() => setAddingTemp(true)} title="Item comprado pontualmente, sem cadastro nos produtos">
          Item avulso
        </Button>
      </div>

      {loaded === null ? (
        <div className={styles.center}>
          <Spinner label="Carregando lista do mês" />
        </div>
      ) : inList.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Lista vazia"
          description="Nenhum item neste mês. Adicione produtos cadastrados ou um item avulso."
        />
      ) : (
        <>
          <Card className={styles.progressCard}>
            <span className={styles.progressText}>
              <CheckCheck size={18} aria-hidden />
              <span>
                <strong>{inCart.length}</strong> de <strong>{inList.length}</strong> no carrinho
              </span>
            </span>
            <div className={styles.progress}>
              <span style={{ width: `${(inCart.length / inList.length) * 100}%` }} />
            </div>
          </Card>

          {groups.map((g) => (
            <section className={styles.group} key={g.key}>
              <h3 className={styles.groupTitle}>
                <Tag size={14} aria-hidden /> {g.name}
                <span className={styles.count}>{g.list.length}</span>
              </h3>
              <Card padding="none">
                <ul className={styles.list}>
                  {g.list.map((p) => {
                    const it = itemOf(p.id)!;
                    const variant = findVariant(p, it.variantId);
                    return (
                      <li className={cn(styles.row, it.checked && styles.rowDone)} key={p.id}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={!!it.checked}
                          onChange={() => toggle(p)}
                          aria-label={`Marcar ${p.name} no carrinho`}
                        />
                        <ProductThumb src={p.imageUrl} alt={p.name} zoom />
                        <div className={styles.main}>
                          <span className={styles.name}>
                            <span>{p.name}</span>
                          </span>
                          {variant && <span className={styles.variantLabel}>{variantLabel(variant)}</span>}
                          <span className={styles.meta}>
                            {it.price != null ? (
                              <>
                                {`${it.quantity ?? 1} ${p.unit} × ${brl(it.price)}`}
                                {it.priceType === "wholesale" && <Badge tone="info">Atacado</Badge>}
                              </>
                            ) : (
                              <>
                                <Badge tone="warning">Preço pendente</Badge> {it.quantity ?? 1} {p.unit}
                              </>
                            )}
                          </span>
                        </div>
                        {it.checked && it.price != null && (
                          <strong className={styles.subtotal} title="Quanto este item somou no carrinho">
                            {brl(it.price * (it.quantity ?? 1))}
                          </strong>
                        )}
                        <div className={styles.actions}>
                          <IconButton
                            icon={CircleDollarSign}
                            size="sm"
                            label={`Preço e quantidade de ${p.name}`}
                            onClick={() => setPricing({ product: p, inCart: !!it.checked })}
                          />
                          <IconButton icon={X} size="sm" label={`Remover ${p.name} da lista`} onClick={() => s.removeMonthItem(month, p.id)} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}

      <footer className={styles.totals}>
        <div className={styles.stat}>
          <span className={styles.statIcon}>
            <ShoppingCart size={18} aria-hidden />
          </span>
          <div>
            <small>No carrinho</small>
            <strong>{brl(total)}</strong>
          </div>
        </div>
        <div className={styles.stat}>
          <span className={cn(styles.statIcon, styles.statIconAlt)}>
            <TrendingUp size={18} aria-hidden />
          </span>
          <div>
            <small>Previsão</small>
            <strong>{brl(expected)}</strong>
          </div>
        </div>
        <Button className={styles.totalsAction} icon={CheckCheck} disabled={inCart.length === 0} onClick={() => setFinishing(true)}>
          Finalizar compras
        </Button>
      </footer>

      {finishing && (
        <FinishModal
          bought={inCart.map((p): PurchaseItem => {
            const it = itemOf(p.id)!;
            const variant = findVariant(p, it.variantId);
            return {
              productId: p.id,
              name: p.name,
              unit: p.unit,
              price: it.price ?? null,
              priceType: it.priceType ?? "unit",
              quantity: it.quantity ?? 1,
              // O Firestore não aceita campos undefined.
              ...(variant && { variant: variantLabel(variant) }),
              ...(it.temp && { temp: true }),
            };
          })}
          pendingCount={inList.length - inCart.length}
          onClose={() => setFinishing(false)}
          onConfirm={async ({ store, date, bought, keepPending }) => {
            await s.finishPurchase({
              month,
              store,
              date,
              bought,
              keepPending,
              pendingIds: inList.filter((p) => !itemOf(p.id)?.checked).map((p) => p.id),
            });
            setFinishing(false);
          }}
        />
      )}

      {adding && <AddModal available={available} onAdd={add} onClose={() => setAdding(false)} />}

      {addingTemp && (
        <TempItemModal
          onClose={() => setAddingTemp(false)}
          onSave={async (data) => {
            await s.addTempItem(month, data);
            setAddingTemp(false);
          }}
        />
      )}

      {pricing && (
        <PriceModal
          product={pricing.product}
          item={itemOf(pricing.product.id)}
          initialInCart={pricing.inCart}
          onClose={() => setPricing(null)}
          onSave={async ({ price, priceType, quantity, variantId, inCart }) => {
            await s.setMonthItem(month, pricing.product.id, { price, priceType, quantity, variantId, checked: inCart });
            setPricing(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Modal com rodapé Cancelar/Salvar ligado a um <form> (Enter também envia). */
function FormModal({
  title,
  submitLabel,
  canSubmit,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  submitLabel: string;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(false);
    try {
      await onSubmit();
    } catch {
      setError(true);
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={ui.stack}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {children}
        {error && <ErrorText>Não foi possível salvar. Verifique sua conexão e tente de novo.</ErrorText>}
      </form>
    </Modal>
  );
}

const positive = (v: string) => v !== "" && Number.isFinite(Number(v)) && Number(v) > 0;

function AddModal({
  available,
  onAdd,
  onClose,
}: {
  available: Product[];
  onAdd: (p: Product, quantity: number, variantId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const s = useShopping();
  const [search, setSearch] = useState("");
  const found = available.filter((p) => matches(search, p.name, s.categoryName(p.categoryId)));
  return (
    <Modal open onClose={onClose} title="Adicionar ao mês" size="lg">
      {s.products.length === 0 ? (
        <p className={styles.muted}>Nenhum produto cadastrado ainda. Cadastre-os em Produtos.</p>
      ) : available.length === 0 ? (
        <p className={styles.muted}>Todos os produtos já estão na lista.</p>
      ) : (
        <>
          <SearchInput value={search} onChange={setSearch} autoFocus />
          {found.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Nada encontrado" description={`Nenhum produto encontrado para “${search}”.`} />
          ) : (
            <ul className={styles.list}>
              {found.map((p) => (
                <AddMonthRow key={p.id} product={p} onAdd={onAdd} />
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

function AddMonthRow({ product, onAdd }: { product: Product; onAdd: (p: Product, quantity: number, variantId: string | null) => Promise<void> }) {
  const [qty, setQty] = useState("1");
  const [variantId, setVariantId] = useState<string | null>(product.variants?.length === 1 ? product.variants[0].id : null);
  const [busy, setBusy] = useState(false);
  return (
    <li className={styles.row} style={{ paddingInline: 0 }}>
      <ProductThumb src={product.imageUrl} alt={product.name} />
      <div className={styles.main}>
        <span className={styles.name}>
          <span>{product.name}</span>
        </span>
        <span className={styles.meta}>{product.unit}</span>
        <VariantSelect className={styles.variantSelect} product={product} value={variantId} onChange={setVariantId} />
      </div>
      <input
        className={cn(ui.input, styles.qtyInline)}
        type="number"
        min="0"
        step="any"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label={`Quantidade de ${product.name}`}
      />
      <IconButton
        icon={Plus}
        variant="primary"
        label={`Adicionar ${product.name}`}
        disabled={!positive(qty) || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onAdd(product, Number(qty), variantId);
          } finally {
            setBusy(false);
          }
        }}
      />
    </li>
  );
}

/** Item comprado pontualmente: fica só na lista do mês, sem ir para os produtos. */
function TempItemModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; unit: string; quantity: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(UNITS[0]);
  const [qty, setQty] = useState("1");
  return (
    <FormModal
      title="Item avulso"
      submitLabel="Adicionar"
      canSubmit={!!name.trim() && positive(qty)}
      onClose={onClose}
      onSubmit={() => onSave({ name: name.trim(), unit, quantity: Number(qty) })}
    >
      <p className={styles.muted}>Fica só na lista deste mês: não é cadastrado nos produtos nem entra no histórico de preços.</p>
      <Field label="Nome">
        <input className={ui.input} autoFocus placeholder="Ex.: Vela de aniversário" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className={ui.grid2}>
        <Field label="Unidade">
          <select className={ui.select} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        <Field label="Quantidade">
          <input className={ui.input} type="number" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      </div>
    </FormModal>
  );
}

function PriceModal({
  product,
  item,
  initialInCart,
  onClose,
  onSave,
}: {
  product: Product;
  item?: MonthItem;
  initialInCart: boolean;
  onClose: () => void;
  onSave: (data: { price: number | null; priceType: PriceType; quantity: number; variantId: string | null; inCart: boolean }) => Promise<void>;
}) {
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");
  const [priceType, setPriceType] = useState<PriceType>(item?.priceType ?? "unit");
  const [qty, setQty] = useState(String(item?.quantity ?? 1));
  const [variantId, setVariantId] = useState<string | null>(findVariant(product, item?.variantId)?.id ?? null);
  const [inCart, setInCart] = useState(initialInCart);
  const priceOk = price === "" || (Number.isFinite(Number(price)) && Number(price) >= 0);
  return (
    <FormModal
      title={product.name}
      submitLabel="Salvar"
      canSubmit={positive(qty) && priceOk}
      onClose={onClose}
      onSubmit={() => onSave({ price: price === "" ? null : Number(price), priceType, quantity: Number(qty), variantId, inCart })}
    >
      {!!product.variants?.length && (
        <Field label="Marca e tamanho">
          <VariantSelect product={product} value={variantId} onChange={setVariantId} />
        </Field>
      )}
      <FieldGroup label="Tipo de preço">
        <Segmented
          value={priceType}
          onChange={setPriceType}
          label="Tipo de preço"
          options={(Object.keys(PRICE_TYPES) as PriceType[]).map((t) => ({ value: t, label: PRICE_TYPES[t] }))}
        />
      </FieldGroup>
      <div className={ui.grid2}>
        <Field label={`Preço por ${product.unit} (R$) · opcional`}>
          <input
            className={ui.input}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="Não informado"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Quantidade">
          <input className={ui.input} type="number" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      </div>
      <label className={ui.check}>
        <input type="checkbox" checked={inCart} onChange={(e) => setInCart(e.target.checked)} />
        Produto adicionado ao carrinho?
      </label>
    </FormModal>
  );
}

function FinishModal({
  bought,
  pendingCount,
  onClose,
  onConfirm,
}: {
  bought: PurchaseItem[];
  /** Itens da lista que não foram para o carrinho. */
  pendingCount: number;
  onClose: () => void;
  onConfirm: (data: { store: string; date: string; bought: PurchaseItem[]; keepPending: boolean }) => Promise<void>;
}) {
  const s = useShopping();
  const listId = useId();
  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayKey());
  const [keepPending, setKeepPending] = useState(true);
  const total = bought.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);

  return (
    <FormModal
      title="Finalizar compras"
      submitLabel="Concluir compras"
      canSubmit={!!store.trim() && !!date}
      onClose={onClose}
      onSubmit={() => onConfirm({ store: store.trim(), date, bought, keepPending })}
    >
      <p className={styles.summary}>
        <ShoppingCart size={16} aria-hidden /> {bought.length} {bought.length === 1 ? "item comprado" : "itens comprados"} ·{" "}
        <strong>{brl(total)}</strong>
      </p>
      <Field label="Mercado">
        <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Store size={16} style={{ position: "absolute", left: 12, color: "var(--color-text-subtle)" }} aria-hidden />
          <input
            className={ui.input}
            style={{ paddingLeft: 36 }}
            autoFocus
            list={listId}
            placeholder="Ex.: Atacadão"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />
        </span>
        <datalist id={listId}>
          {s.stores.map((st) => (
            <option key={st} value={st} />
          ))}
        </datalist>
      </Field>
      <Field label="Data da compra">
        <input className={ui.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {pendingCount > 0 && (
        <fieldset className={styles.radioGroup}>
          <legend>
            {pendingCount === 1
              ? "1 item não foi para o carrinho. O que fazer com ele?"
              : `${pendingCount} itens não foram para o carrinho. O que fazer com eles?`}
          </legend>
          <label>
            <input type="radio" name="pending" checked={keepPending} onChange={() => setKeepPending(true)} />
            Manter na lista do mês
          </label>
          <label>
            <input type="radio" name="pending" checked={!keepPending} onChange={() => setKeepPending(false)} />
            Remover da lista
          </label>
        </fieldset>
      )}
    </FormModal>
  );
}

export interface ShoppingCategory {
  id: string;
  name: string;
}

/** Marca e tamanho de um produto (ex.: "Camil - 5 kg"). */
export interface Variant {
  id: string;
  brand: string;
  /** null = tamanho não informado. */
  size: number | null;
  sizeUnit: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  categoryId: string;
  /** Foto hospedada no ImgBB. */
  imageUrl?: string;
  variants?: Variant[];
}

/** Preço de unidade (varejo) ou de atacado; ausente = unidade. */
export type PriceType = "unit" | "wholesale";

/** Item da lista do mês. O id é o do produto (ou aleatório, no item avulso). */
export interface MonthItem {
  id: string;
  checked: boolean;
  /** null = preço não informado. */
  price?: number | null;
  priceType?: PriceType;
  quantity?: number;
  /** Marca/tamanho escolhido do produto. */
  variantId?: string | null;
  /** Item avulso: comprado pontualmente, não existe nos produtos. */
  temp?: boolean;
  name?: string;
  unit?: string;
}

export interface PricePoint {
  month: string;
  price: number | null;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  unit: string;
  price: number | null;
  priceType?: PriceType;
  quantity: number;
  /** "Marca - tamanho" no momento da compra. */
  variant?: string;
  /** Item avulso (sem produto cadastrado). */
  temp?: boolean;
}

/** Uma ida ao mercado finalizada. */
export interface Purchase {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Lista de origem "YYYY-MM". */
  month: string;
  store: string;
  total: number;
  items: PurchaseItem[];
}

/** Preço de um produto em uma compra (permite comparar por mercado e data). */
export interface PriceRecord {
  id: string;
  productId: string;
  purchaseId: string;
  store: string;
  date: string;
  price: number;
  priceType?: PriceType;
  quantity: number;
  variant?: string;
}

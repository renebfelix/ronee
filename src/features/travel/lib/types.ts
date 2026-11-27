/** Categoria de lugar (Restaurantes, Pontos turísticos…). O marcador no mapa usa o ícone e a cor dela. */
export interface PlaceCategory {
  id: string;
  name: string;
  /** Chave em `PLACE_ICONS`. */
  icon: string;
  color: string;
  order: number;
}

export type PlaceCategoryInput = Pick<PlaceCategory, "name" | "icon" | "color">;

export interface Trip {
  id: string;
  name: string;
  /** Cidade/país, texto livre. */
  destination: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  endDate: string;
  /** Ids de Responsáveis do módulo de Finanças que viajam comigo. */
  companions: string[];
  /**
   * Categoria de despesa criada em Finanças para os gastos desta viagem. Os gastos são lançamentos
   * normais de Finanças com `categoryId` igual a este id.
   */
  financeCategoryId: string | null;
  /** Encerrada manualmente: deixa de ser "aberta" e a categoria em Finanças é desativada. */
  closed: boolean;
  createdAt: number;
}

export type TripInput = Pick<Trip, "name" | "destination" | "startDate" | "endDate" | "companions">;

export interface Place {
  id: string;
  tripId: string;
  name: string;
  categoryId: string;
  /** HTML do editor (Tiptap); "" quando vazio. */
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  /** Dia planejado ("YYYY-MM-DD"), opcional. */
  date: string | null;
  visited: boolean;
  createdAt: number;
}

export type PlaceInput = Omit<Place, "id" | "tripId" | "createdAt">;

/** Resultado da busca de endereço (/api/geocode). */
export interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

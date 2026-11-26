import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, getDocs, getFirestore, writeBatch, type DocumentData } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { monthKey, shiftMonth } from "./shopping";

/**
 * Importação única dos dados do app Store Leest (outro projeto Firebase) para a Lista de compras.
 *
 * Origem  (store-leest): users/{uid}/categories | products | purchases | priceRecords | lists/{YYYY-MM}/items
 * Destino (ronee):       users/{uid}/modules/shopping/... (mesma estrutura)
 *
 * Os ids são mantidos, então rodar de novo sobrescreve em vez de duplicar, e as referências
 * entre produtos, listas, compras e preços continuam valendo. As fotos (URLs do ImgBB) são as mesmas.
 */
const config = {
  apiKey: process.env.RONEE_NEXT_PUBLIC_STORE_LEEST_FIREBASE_API_KEY,
  authDomain: process.env.RONEE_NEXT_PUBLIC_STORE_LEEST_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.RONEE_NEXT_PUBLIC_STORE_LEEST_FIREBASE_PROJECT_ID,
  appId: process.env.RONEE_NEXT_PUBLIC_STORE_LEEST_FIREBASE_APP_ID,
};

export const isStoreLeestConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

const APP_NAME = "store-leest-import";
const sourceApp = (): FirebaseApp => (getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(config, APP_NAME));

const COLS = ["categories", "products", "purchases", "priceRecords"] as const;
type Col = (typeof COLS)[number];

interface Row {
  id: string;
  data: DocumentData;
}

export interface StoreLeestSnapshot {
  email: string | null;
  cols: Record<Col, Row[]>;
  /** Itens das listas mensais, por mês "YYYY-MM". */
  lists: Record<string, Row[]>;
}

export const snapshotCounts = (s: StoreLeestSnapshot) => ({
  categories: s.cols.categories.length,
  products: s.cols.products.length,
  purchases: s.cols.purchases.length,
  priceRecords: s.cols.priceRecords.length,
  months: Object.keys(s.lists).length,
  listItems: Object.values(s.lists).reduce((n, l) => n + l.length, 0),
});

/** Abre o login do Google no projeto Store Leest e lê todos os dados da lista de compras. */
export async function readStoreLeest(onProgress?: (msg: string) => void): Promise<StoreLeestSnapshot> {
  const app = sourceApp();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, provider);
  const db = getFirestore(app);
  const rows = async (...path: string[]) =>
    (await getDocs(collection(db, "users", user.uid, ...path))).docs.map((d) => ({ id: d.id, data: d.data() }));

  try {
    onProgress?.("Lendo produtos, categorias e compras…");
    const [categories, products, purchases, priceRecords] = await Promise.all(COLS.map((c) => rows(c)));

    // As listas ficam em lists/{mês}/items e o documento do mês não existe de fato, então não dá
    // para listá-los: varre os meses entre a compra mais antiga (ou 3 anos atrás) e 1 ano à frente.
    const now = monthKey();
    const dates = [...purchases, ...priceRecords].map((r) => String(r.data.date ?? "").slice(0, 7)).filter(Boolean);
    const first = [shiftMonth(now, -36), ...dates].sort()[0];
    const months: string[] = [];
    for (let m = first; m <= shiftMonth(now, 12); m = shiftMonth(m, 1)) months.push(m);

    onProgress?.(`Lendo listas de ${months.length} meses…`);
    const lists: Record<string, Row[]> = {};
    const found = await Promise.all(months.map((m) => rows("lists", m, "items")));
    months.forEach((m, i) => {
      if (found[i].length) lists[m] = found[i];
    });

    return { email: user.email, cols: { categories, products, purchases, priceRecords }, lists };
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}

/** Grava a leitura do Store Leest na Lista de compras do usuário atual do Ronee. */
export async function writeToRonee(uid: string, snap: StoreLeestSnapshot, onProgress?: (done: number, total: number) => void) {
  const db = getDb();
  const base = doc(db, "users", uid, "modules", "shopping");
  const ops: { path: string; data: DocumentData }[] = [
    ...COLS.flatMap((c) => snap.cols[c].map((r) => ({ path: `${c}/${r.id}`, data: r.data }))),
    ...Object.entries(snap.lists).flatMap(([m, items]) => items.map((r) => ({ path: `lists/${m}/items/${r.id}`, data: r.data }))),
  ];

  const CHUNK = 400; // limite do Firestore: 500 operações por lote
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((op) => batch.set(doc(base, op.path), op.data));
    await batch.commit();
    onProgress?.(Math.min(i + CHUNK, ops.length), ops.length);
  }
  return ops.length;
}

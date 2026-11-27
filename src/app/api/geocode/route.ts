import { NextResponse } from "next/server";
import type { GeoResult } from "@/features/travel/lib/types";

/**
 * Busca de endereços (e endereço de um ponto do mapa) no Nominatim / OpenStreetMap.
 *
 * Política de uso (operations.osmfoundation.org/policies/nominatim): no máximo 1 requisição por
 * segundo, identificação do aplicativo no User-Agent e cache dos resultados. Por isso a busca
 * passa por aqui: o servidor se identifica com um nome genérico do app (sem dados do usuário),
 * espaça as chamadas e guarda as respostas em memória. A tela só busca ao enviar (sem autocompletar).
 */
const BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Ronee/1.0 (aplicativo pessoal de organizacao; modulo Viagens)";
const TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE = 500;
const cache = new Map<string, { at: number; results: GeoResult[] }>();
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Garante ≥ 1,1 s entre chamadas ao Nominatim, mesmo com requisições simultâneas. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

interface NominatimItem {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
}

const toResult = (it: NominatimItem): GeoResult => {
  const address = it.display_name ?? "";
  return { name: it.name || address.split(",")[0] || "", address, lat: Number(it.lat), lng: Number(it.lon) };
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 200);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const reverse = !q && params.has("lat") && params.has("lng");

  if (!q && !reverse) return NextResponse.json({ error: "Informe o endereço." }, { status: 400 });
  if (reverse && !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  const url = reverse
    ? `${BASE}/reverse?${new URLSearchParams({ format: "jsonv2", lat: lat.toFixed(5), lon: lng.toFixed(5), zoom: "18" })}`
    : `${BASE}/search?${new URLSearchParams({ format: "jsonv2", q, limit: "6" })}`;
  const key = url.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ results: hit.results });

  let res: Response;
  try {
    res = await throttled(() =>
      fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5" }, cache: "no-store" }),
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível falar com o serviço de mapas." }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ error: `Serviço de mapas respondeu ${res.status}.` }, { status: 502 });

  const json = (await res.json().catch(() => null)) as NominatimItem[] | (NominatimItem & { error?: string }) | null;
  const items = Array.isArray(json) ? json : json && !json.error && json.lat ? [json] : [];
  const results = items.map(toResult).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), results });
  return NextResponse.json({ results });
}

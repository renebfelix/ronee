import { NextResponse } from "next/server";
import { parseHolidays, withSaoPauloHolidays, type Holiday } from "@/features/calendar/lib/holidays";

/**
 * Feriados nacionais, de SP e da cidade de São Paulo para um ano, via APIBrasil.pro.
 * A chave `RONEE_NEXT_PUBLIC_APIBRASIL_KEY` só existe no servidor. Cada ano fica em memória por 24 h
 * (o plano gratuito tem 1.000 requisições/mês).
 */
const API_URL = "https://feriados.apibrasil.pro/feriados";
const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<number, { at: number; holidays: Holiday[] }>();

export async function GET(req: Request) {
  const key = process.env.RONEE_NEXT_PUBLIC_APIBRASIL_KEY;
  if (!key) {
    return NextResponse.json({ error: "Chave da APIBrasil não configurada (RONEE_NEXT_PUBLIC_APIBRASIL_KEY)." }, { status: 503 });
  }

  const year = Number(new URL(req.url).searchParams.get("ano"));
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }

  const hit = cache.get(year);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ holidays: hit.holidays });

  const params = new URLSearchParams({ ano: String(year), uf: "SP", municipio: "SaoPaulo", tipo: "todos" });
  let res: Response;
  try {
    res = await fetch(`${API_URL}?${params}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Não foi possível falar com a API de feriados." }, { status: 502 });
  }
  const json = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  if (!res.ok) {
    return NextResponse.json({ error: json?.error ?? json?.message ?? `API de feriados respondeu ${res.status}.` }, { status: 502 });
  }

  const parsed = parseHolidays(json);
  if (!parsed.length) {
    console.warn("[feriados] resposta sem feriados reconhecíveis:", JSON.stringify(json).slice(0, 500));
    return NextResponse.json({ error: "Resposta da API de feriados em formato inesperado." }, { status: 502 });
  }
  const holidays = withSaoPauloHolidays(year, parsed);
  cache.set(year, { at: Date.now(), holidays });
  return NextResponse.json({ holidays });
}

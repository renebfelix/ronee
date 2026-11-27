"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Crosshair, MapPinOff, Search, Trash2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { ErrorText, Field, FieldGroup, Hint, ui } from "@/features/finance/components/kit";
import { DescriptionEditor } from "@/features/tasks/components/DescriptionEditor";
import { cn } from "@/lib/utils/cn";
import { useTravel } from "../data/TravelDataProvider";
import { placeCategoryOf } from "../lib/travel";
import type { GeoResult, Place, Trip } from "../lib/types";
import type { MapMarker } from "./TravelMap";
import { PlaceGlyph } from "./PlaceBadge";
import styles from "./Travel.module.scss";

// O Leaflet acessa `window`: o mapa só é carregado no navegador.
const TravelMap = dynamic(() => import("./TravelMap").then((m) => m.TravelMap), {
  ssr: false,
  loading: () => <div className={cn(styles.map, styles.mapSmall)} />,
});

const CURRENT = "__current";

async function geocode(params: Record<string, string>): Promise<GeoResult[]> {
  const res = await fetch(`/api/geocode?${new URLSearchParams(params)}`);
  const json = (await res.json().catch(() => ({}))) as { results?: GeoResult[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Falha na busca.");
  return json.results ?? [];
}

/** Criação/edição de um lugar da viagem: categoria, endereço (busca ou clique no mapa) e descrição. */
export function PlaceForm({ trip, editing, onClose }: { trip: Trip; editing: Place | null; onClose: () => void }) {
  const t = useTravel();
  const [name, setName] = useState(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? t.categories[0]?.id ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [lat, setLat] = useState<number | null>(editing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editing?.lng ?? null);
  const [date, setDate] = useState(editing?.date ?? "");
  const [visited, setVisited] = useState(editing?.visited ?? false);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [fitKey, setFitKey] = useState("init");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cat = placeCategoryOf(t.categoriesById, categoryId);
  const hasPoint = lat !== null && lng !== null;

  // Ponto atual (arrastável) + os outros lugares da viagem, esmaecidos, como referência.
  const markers = useMemo<MapMarker[]>(() => {
    const others = (t.placesByTrip[trip.id] ?? [])
      .filter((p) => p.id !== editing?.id && p.lat !== null && p.lng !== null)
      .map((p) => {
        const c = placeCategoryOf(t.categoriesById, p.categoryId);
        return { id: p.id, lat: p.lat!, lng: p.lng!, color: c.color, icon: c.icon, title: p.name, muted: true };
      });
    return hasPoint ? [...others, { id: CURRENT, lat: lat!, lng: lng!, color: cat.color, icon: cat.icon, title: name || "Novo lugar" }] : others;
  }, [t.placesByTrip, t.categoriesById, trip.id, editing?.id, hasPoint, lat, lng, cat.color, cat.icon, name]);

  const search = async () => {
    const q = address.trim();
    if (!q) return setSearchError("Digite um endereço ou nome de lugar para buscar.");
    setSearching(true);
    setSearchError("");
    try {
      const found = await geocode({ q });
      setResults(found);
      if (!found.length) setSearchError("Nada encontrado. Tente outro termo ou clique no mapa para marcar o ponto.");
    } catch (e) {
      setSearchError((e as Error).message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const choose = (r: GeoResult) => {
    setAddress(r.address);
    setLat(r.lat);
    setLng(r.lng);
    if (!name.trim()) setName(r.name);
    setResults(null);
    setSearchError("");
    setFitKey(`${r.lat},${r.lng}`);
  };

  // Clique no mapa: marca o ponto e, sem endereço digitado, busca o endereço daquele lugar.
  const pick = (la: number, ln: number) => {
    setLat(la);
    setLng(ln);
    setResults(null);
    if (!address.trim()) {
      geocode({ lat: String(la), lng: String(ln) })
        .then((r) => r[0] && setAddress((cur) => cur || r[0].address))
        .catch(() => {});
    }
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) return setError("Informe o nome do lugar.");
    if (!categoryId) return setError("Escolha uma categoria.");
    setSaving(true);
    setError("");
    const data = {
      name: n,
      categoryId,
      address: address.trim(),
      lat,
      lng,
      date: date || null,
      visited,
      description,
    };
    try {
      if (editing) await t.updatePlace(editing.id, data);
      else await t.addPlace(trip.id, data);
      onClose();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await t.removePlace(editing.id);
      onClose();
    } catch {
      setError("Não foi possível excluir. Verifique sua conexão e tente de novo.");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Editar lugar" : "Novo lugar"}
      footer={
        <>
          {editing &&
            (confirmDelete ? (
              <Button variant="danger" icon={Trash2} onClick={remove} disabled={saving} style={{ marginRight: "auto" }}>
                Confirmar exclusão
              </Button>
            ) : (
              <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)} style={{ marginRight: "auto" }}>
                Excluir
              </Button>
            ))}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className={ui.stack}>
        <Field label="Nome">
          <input
            className={ui.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Torre de Belém"
            maxLength={80}
            autoFocus
          />
        </Field>

        <FieldGroup label="Categoria">
          <div className={styles.catPick} role="radiogroup" aria-label="Categoria">
            {t.categories.map((c) => {
              const on = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cn(styles.filterChip, on && styles.filterChipOn)}
                  style={{ ["--chip" as string]: c.color }}
                  onClick={() => setCategoryId(c.id)}
                >
                  <span style={{ color: c.color, display: "inline-flex" }}>
                    <PlaceGlyph icon={c.icon} size={14} />
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup label="Endereço e localização">
          <div className={styles.searchRow}>
            <input
              className={ui.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="Endereço ou nome do lugar"
              maxLength={200}
              aria-label="Endereço"
            />
            <Button variant="outline" icon={Search} onClick={search} loading={searching}>
              Buscar
            </Button>
          </div>
          {searchError && <Hint warn>{searchError}</Hint>}
          {results && results.length > 0 && (
            <ul className={styles.results} aria-label="Resultados da busca">
              {results.map((r, i) => (
                <li key={`${r.lat},${r.lng},${i}`}>
                  <button type="button" onClick={() => choose(r)}>
                    <strong>{r.name}</strong>
                    <span>{r.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <TravelMap
            className={styles.mapSmall}
            markers={markers}
            fitKey={fitKey}
            onPick={pick}
            draggableId={CURRENT}
            selectedId={hasPoint ? CURRENT : null}
          />
          <div className={styles.coords}>
            <span>
              <Crosshair size={12} aria-hidden />{" "}
              {hasPoint ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}` : "Clique no mapa para marcar o ponto (ou busque o endereço)."}
            </span>
            {hasPoint && (
              <Button
                size="sm"
                variant="ghost"
                icon={MapPinOff}
                onClick={() => {
                  setLat(null);
                  setLng(null);
                }}
              >
                Remover ponto
              </Button>
            )}
          </div>
        </FieldGroup>

        <div className={ui.grid2}>
          <Field label="Dia planejado (opcional)">
            <input
              className={ui.input}
              type="date"
              value={date}
              min={trip.startDate}
              max={trip.endDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <FieldGroup label="Situação">
            <Button variant={visited ? "secondary" : "outline"} icon={Check} onClick={() => setVisited((v) => !v)} aria-pressed={visited}>
              {visited ? "Visitado" : "Marcar como visitado"}
            </Button>
          </FieldGroup>
        </div>

        <FieldGroup label="Descrição">
          <DescriptionEditor value={description} onChange={setDescription} placeholder="Dicas, horários, reservas, links..." />
        </FieldGroup>

        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}

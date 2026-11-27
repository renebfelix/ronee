"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PLACE_ICONS } from "../lib/travel";
import styles from "./Travel.module.scss";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  /** Chave em `PLACE_ICONS`. */
  icon: string;
  title: string;
  /** Marcador esmaecido (ex.: lugar já visitado, ou outros lugares ao escolher um ponto). */
  muted?: boolean;
}

interface Props {
  markers: MapMarker[];
  /** Quando muda, reenquadra o mapa em todos os marcadores. */
  fitKey?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Clique no mapa (e arrastar o marcador `draggableId`) devolve a coordenada. */
  onPick?: (lat: number, lng: number) => void;
  draggableId?: string;
  className?: string;
}

/**
 * Ícones usados pelos marcadores, renderizados pelo React num bloco oculto: o HTML do marcador
 * (divIcon do Leaflet) copia o SVG de lá.
 */
function Glyphs({ icons, boxRef }: { icons: string[]; boxRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={boxRef} hidden aria-hidden>
      {icons.map((icon) => {
        const Icon = PLACE_ICONS[icon] ?? MapPin;
        return (
          <span key={icon} data-icon={icon}>
            <Icon size={16} strokeWidth={2.25} color="#fff" />
          </span>
        );
      })}
    </div>
  );
}

/** Brasil inteiro, quando não há nenhum lugar com coordenadas. */
const DEFAULT_VIEW: [number, number, number] = [-14.5, -51, 4];

/**
 * Mapa Leaflet com tiles do OpenStreetMap. O Leaflet só é carregado no navegador (import dinâmico
 * dentro do efeito), então o componente pode ser usado em páginas renderizadas no servidor.
 */
export function TravelMap({ markers, fitKey, selectedId, onSelect, onPick, draggableId, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const glyphsRef = useRef<HTMLDivElement>(null);
  const icons = useMemo(() => [...new Set(markers.map((m) => m.icon))], [markers]);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onPickRef.current = onPick;
  });

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: typeof import("leaflet") }).default ?? mod;
      if (cancelled || !box.current) return;
      leaflet.current = L;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(
        [DEFAULT_VIEW[0], DEFAULT_VIEW[1]],
        DEFAULT_VIEW[2],
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Modais e abas mudam o tamanho do contêiner depois de montar.
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(box.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Marcadores.
  useEffect(() => {
    const L = leaflet.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    const glyphSvg = (icon: string) => glyphsRef.current?.querySelector(`[data-icon="${CSS.escape(icon)}"]`)?.innerHTML ?? "";
    for (const m of markers) {
      const selected = m.id === selectedId;
      const icon = L.divIcon({
        className: styles.pinWrap,
        html: `<span class="${cn(styles.pin, m.muted && styles.pinMuted, selected && styles.pinSelected)}" style="--pin:${m.color}">${glyphSvg(m.icon)}</span>`,
        iconSize: [34, 42],
        iconAnchor: [17, 40],
        tooltipAnchor: [0, -36],
      });
      const marker = L.marker([m.lat, m.lng], {
        icon,
        title: m.title,
        draggable: m.id === draggableId,
        zIndexOffset: selected ? 1000 : m.muted ? -100 : 0,
        keyboard: true,
      });
      marker.bindTooltip(m.title, { direction: "top" });
      marker.on("click", () => onSelectRef.current?.(m.id));
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onPickRef.current?.(p.lat, p.lng);
      });
      marker.addTo(layer);
    }
  }, [ready, markers, selectedId, draggableId]);

  // Enquadramento: em todos os marcadores quando `fitKey` muda.
  useEffect(() => {
    const L = leaflet.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    // Ao escolher um ponto, enquadra só o marcador arrastável (os outros são referência).
    const focus = draggableId ? markers.filter((m) => m.id === draggableId) : [];
    const pts = (focus.length ? focus : markers).map((m) => [m.lat, m.lng] as [number, number]);
    if (pts.length === 0) map.setView([DEFAULT_VIEW[0], DEFAULT_VIEW[1]], DEFAULT_VIEW[2]);
    else if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 15));
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  // Lugar selecionado na lista: centraliza nele.
  useEffect(() => {
    const map = mapRef.current;
    const m = markers.find((x) => x.id === selectedId);
    if (!ready || !map || !m) return;
    map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  return (
    <>
      <div ref={box} className={cn(styles.map, onPick && styles.mapPick, className)} role="region" aria-label="Mapa" />
      <Glyphs icons={icons} boxRef={glyphsRef} />
    </>
  );
}

import { MapPin } from "lucide-react";
import { PLACE_ICONS } from "../lib/travel";

/** Ícone de uma categoria de lugar pela chave salva no Firestore. */
export function PlaceGlyph({ icon, size = 16 }: { icon: string | undefined; size?: number }) {
  const C = (icon && PLACE_ICONS[icon]) || MapPin;
  return <C size={size} aria-hidden />;
}

/** Ícone da categoria sobre um fundo suave da própria cor. */
export function PlaceBadge({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
      aria-hidden
    >
      <PlaceGlyph icon={icon} size={Math.round(size * 0.45)} />
    </span>
  );
}

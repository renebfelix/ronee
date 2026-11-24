import {
  Baby, Banknote, BookOpen, Briefcase, Building2, Bus, Car, CircleDollarSign, Coffee, CreditCard, Dumbbell, Film, Fuel,
  Gamepad2, Gift, GraduationCap, HeartPulse, Home, Landmark, Music, PartyPopper, PawPrint, PiggyBank, Plane, Receipt,
  Shirt, ShoppingBag, ShoppingCart, Smartphone, Tag, TrendingUp, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

/** Ícones disponíveis para categorias, contas e cartões (o nome fica salvo no Firestore). */
export const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, landmark: Landmark, "piggy-bank": PiggyBank, banknote: Banknote, "credit-card": CreditCard,
  utensils: Utensils, home: Home, car: Car, bus: Bus, "heart-pulse": HeartPulse, "graduation-cap": GraduationCap,
  "gamepad-2": Gamepad2, "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart, plane: Plane, gift: Gift,
  briefcase: Briefcase, "trending-up": TrendingUp, receipt: Receipt, zap: Zap, wifi: Wifi, smartphone: Smartphone,
  shirt: Shirt, dumbbell: Dumbbell, "paw-print": PawPrint, baby: Baby, coffee: Coffee, music: Music, film: Film,
  tag: Tag, "circle-dollar-sign": CircleDollarSign, "building-2": Building2, fuel: Fuel, wrench: Wrench,
  "book-open": BookOpen, "party-popper": PartyPopper,
};

export function FinIcon({ name, size = 18 }: { name: string; size?: number }) {
  const C = ICONS[name] ?? Tag;
  return <C size={size} strokeWidth={2} aria-hidden />;
}

/** Ícone sobre um fundo suave da própria cor (categorias, contas, cartões). */
export function IconBadge({ name, color, size = 38 }: { name: string; color: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: `${color}22`,
        color,
      }}
    >
      <FinIcon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}

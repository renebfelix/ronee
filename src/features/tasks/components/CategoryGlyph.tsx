import { Tag } from "lucide-react";
import { CATEGORY_ICONS } from "../lib/tasks";

/** Ícone de uma categoria de tarefas pela chave salva no Firestore. */
export function CategoryGlyph({ icon, size = 14 }: { icon: string | undefined; size?: number }) {
  const C = (icon && CATEGORY_ICONS[icon]) || Tag;
  return <C size={size} aria-hidden />;
}

"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, EyeOff, GripVertical, LayoutDashboard, Plus, RotateCcw, Settings2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { PageHeader } from "@/components/layout";
import { Button, EmptyState, IconButton } from "@/components/ui";
import { useGreeting } from "@/hooks/useGreeting";
import { cn } from "@/lib/utils/cn";
import { FinanceDataProvider } from "@/features/finance";
import { TravelDataProvider } from "@/features/travel";
import { CalendarDataProvider } from "@/features/calendar";
import { TasksDataProvider } from "@/features/tasks";
import { NotesDataProvider } from "@/features/notes";
import { ShoppingDataProvider } from "@/features/shopping";
import { CardLoading, ModuleCard, ModuleIcon, moduleLabel } from "./components/ModuleCard";
import {
  CalendarSummary,
  FinanceSummary,
  NotesSummary,
  PasswordsSummary,
  ShoppingSummary,
  TasksSummary,
  TravelSummary,
} from "./components/summaries";
import { useDashboardLayout, type DashboardLayout } from "./data/useDashboardLayout";
import styles from "./Dashboard.module.scss";

interface CardDef {
  /** Id do módulo na navegação. */
  id: string;
  wide?: boolean;
  /** Cada card tem o próprio provider: carrega e falha sozinho. */
  render: () => ReactNode;
}

/** Cards disponíveis, na ordem padrão. */
const CARDS: CardDef[] = [
  {
    id: "finance",
    wide: true,
    render: () => (
      <FinanceDataProvider>
        <FinanceSummary />
      </FinanceDataProvider>
    ),
  },
  {
    id: "tasks",
    render: () => (
      <TasksDataProvider>
        <TasksSummary />
      </TasksDataProvider>
    ),
  },
  {
    id: "calendar",
    render: () => (
      <CalendarDataProvider>
        <CalendarSummary />
      </CalendarDataProvider>
    ),
  },
  {
    id: "travel",
    // Passivo: o card de Finanças (ou as páginas do módulo) já cria as categorias e sincroniza os links.
    render: () => (
      <FinanceDataProvider passive>
        <TravelDataProvider>
          <TravelSummary />
        </TravelDataProvider>
      </FinanceDataProvider>
    ),
  },
  {
    id: "shopping",
    render: () => (
      <ShoppingDataProvider>
        <ShoppingSummary />
      </ShoppingDataProvider>
    ),
  },
  {
    id: "notes",
    render: () => (
      <NotesDataProvider>
        <NotesSummary />
      </NotesDataProvider>
    ),
  },
  { id: "passwords", render: () => <PasswordsSummary /> },
];

const CARD_IDS = CARDS.map((c) => c.id);
const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Move `id` para a posição de `overId` (antes dele ao subir, depois ao descer). */
function moveTo(order: string[], id: string, overId: string) {
  const next = order.filter((x) => x !== id);
  next.splice(order.indexOf(overId), 0, id);
  return next;
}

export function DashboardView() {
  const { user } = useAuth();
  const greeting = useGreeting();
  const firstName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0];
  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const { layout, save, setDraft, reset } = useDashboardLayout(CARD_IDS);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const visible = layout ? layout.order.filter((id) => !layout.hidden.includes(id)) : [];
  const hidden = layout ? layout.order.filter((id) => layout.hidden.includes(id)) : [];

  const commit = (next: DashboardLayout) => void save(next).catch(() => {});

  /** Troca com o card visível anterior (-1) ou seguinte (+1). */
  const shift = (id: string, dir: -1 | 1) => {
    if (!layout) return;
    const other = visible[visible.indexOf(id) + dir];
    if (other) commit({ ...layout, order: moveTo(layout.order, id, other) });
  };
  const hide = (id: string) => layout && commit({ ...layout, hidden: [...layout.hidden, id] });
  const show = (id: string) => layout && commit({ ...layout, hidden: layout.hidden.filter((x) => x !== id) });

  const dragProps = (id: string) =>
    editing
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            setDragId(id);
          },
          onDragOver: (e: DragEvent) => {
            if (!dragId || !layout) return;
            e.preventDefault();
            if (dragId !== id) setDraft({ ...layout, order: moveTo(layout.order, dragId, id) });
          },
          onDrop: (e: DragEvent) => e.preventDefault(),
          onDragEnd: () => {
            setDragId(null);
            if (layout) commit(layout);
          },
        }
      : {};

  const toolbar = (id: string, index: number) => (
    <div className={styles.toolbar}>
      <span className={styles.grip} title="Arraste para mover" aria-hidden>
        <GripVertical size={16} />
      </span>
      <IconButton icon={ArrowUp} label="Mover para trás" size="sm" disabled={index === 0} onClick={() => shift(id, -1)} />
      <IconButton
        icon={ArrowDown}
        label="Mover para frente"
        size="sm"
        disabled={index === visible.length - 1}
        onClick={() => shift(id, 1)}
      />
      <IconButton icon={EyeOff} label={`Remover ${moduleLabel(id)} do dashboard`} size="sm" onClick={() => hide(id)} />
    </div>
  );

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title={firstName ? `${greeting}, ${firstName}!` : `${greeting}!`}
        description={`${todayLabel.charAt(0).toUpperCase()}${todayLabel.slice(1)} · um resumo de cada módulo.`}
        actions={
          layout &&
          (editing ? (
            <>
              <Button variant="ghost" icon={RotateCcw} onClick={() => void reset().catch(() => {})}>
                Restaurar padrão
              </Button>
              <Button icon={Check} onClick={() => setEditing(false)}>
                Concluir
              </Button>
            </>
          ) : (
            <Button variant="outline" icon={Settings2} onClick={() => setEditing(true)}>
              Organizar
            </Button>
          ))
        }
      />

      {!layout ? (
        <CardLoading label="Carregando dashboard" />
      ) : (
        <>
          {editing && (
            <div className={styles.tray}>
              <p className={styles.trayHint}>Arraste os cards (ou use as setas) para reordenar. Os removidos ficam aqui.</p>
              {hidden.length > 0 && (
                <div className={styles.trayItems}>
                  {hidden.map((id) => (
                    <button key={id} type="button" className={styles.trayItem} onClick={() => show(id)}>
                      <ModuleIcon id={id} size={16} />
                      {moduleLabel(id)}
                      <Plus size={16} aria-label="Adicionar" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="Nenhum card no dashboard"
              description="Adicione de volta os resumos dos módulos que quer acompanhar."
              action={
                !editing && (
                  <Button icon={Settings2} onClick={() => setEditing(true)}>
                    Organizar
                  </Button>
                )
              }
            />
          ) : (
            <div className={styles.grid}>
              {visible.map((id, i) => {
                const card = CARD_BY_ID[id];
                return (
                  <ModuleCard
                    key={id}
                    id={id}
                    wide={card.wide}
                    toolbar={editing ? toolbar(id, i) : undefined}
                    className={cn(dragId === id && styles.dragging)}
                    {...dragProps(id)}
                  >
                    {card.render()}
                  </ModuleCard>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

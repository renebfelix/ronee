"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, CalendarDays, Lock, LockOpen, MapPin, Pencil, Plane, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Alert, Badge, Button, Card, EmptyState, IconButton } from "@/components/ui";
import { useFinance } from "@/features/finance/data/FinanceDataProvider";
import { ConfirmModal, Person, Segmented } from "@/features/finance/components/kit";
import { IconBadge } from "@/features/finance/components/icons";
import { TransactionModal } from "@/features/finance/components/TransactionModal";
import { TxList, nextTxSort, sortTx, type TxSort } from "@/features/finance/components/TxList";
import { DeleteTransactionModal, PayBoletoModal, ReceiveChargeModal } from "@/features/finance/components/OccurrenceModals";
import { MoveTransactionModal } from "@/features/finance/components/MoveTransactionModal";
import { monthOf } from "@/features/finance/lib/finance";
import { brl, dateShort } from "@/features/finance/lib/format";
import { ME_ID, type Occurrence, type Transaction } from "@/features/finance/lib/types";
import { sanitizeHtml } from "@/features/tasks/lib/sanitize";
import tasksStyles from "@/features/tasks/components/Tasks.module.scss";
import { cn } from "@/lib/utils/cn";
import { PlaceBadge, PlaceGlyph } from "./components/PlaceBadge";
import { PlaceForm } from "./components/PlaceForm";
import { TripForm } from "./components/TripForm";
import type { MapMarker } from "./components/TravelMap";
import { useTravel } from "./data/TravelDataProvider";
import { PHASE_LABEL, placeCategoryOf, tripDays, tripPhase, tripRangeLabel } from "./lib/travel";
import type { Place, Trip } from "./lib/types";
import { PHASE_TONE } from "./TripsView";
import styles from "./components/Travel.module.scss";

const TravelMap = dynamic(() => import("./components/TravelMap").then((m) => m.TravelMap), {
  ssr: false,
  loading: () => <div className={styles.map} />,
});

type Tab = "places" | "expenses";

/** Tabela em telas largas; lista em cards no celular (mesma regra de Lançamentos). */
function useWide(query = "(min-width: 900px)") {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return wide;
}

// ───────── Lugares e mapa ─────────

function PlacesTab({ trip }: { trip: Trip }) {
  const t = useTravel();
  const places = useMemo(() => t.placesByTrip[trip.id] ?? [], [t.placesByTrip, trip.id]);
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; editing: Place | null }>({ open: false, editing: null });
  const listRef = useRef<HTMLUListElement>(null);

  const usedCats = t.categories.filter((c) => places.some((p) => p.categoryId === c.id));
  const shown = filter ? places.filter((p) => p.categoryId === filter) : places;
  const withPoint = shown.filter((p) => p.lat !== null && p.lng !== null);
  const markers = useMemo<MapMarker[]>(
    () =>
      withPoint.map((p) => {
        const c = placeCategoryOf(t.categoriesById, p.categoryId);
        return { id: p.id, lat: p.lat!, lng: p.lng!, color: c.color, icon: c.icon, title: p.name, muted: p.visited };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, t.categoriesById],
  );
  // Reenquadra quando a seleção de lugares visíveis muda (filtro, novo lugar, ponto movido).
  const fitKey = withPoint.map((p) => `${p.id}:${p.lat},${p.lng}`).join("|");

  const selectFromMap = (id: string) => {
    setSelected(id);
    listRef.current?.querySelector(`[data-place="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <>
      <div className={styles.toolbar}>
        <Button icon={Plus} onClick={() => setForm({ open: true, editing: null })}>
          Lugar
        </Button>
        {usedCats.length > 1 && (
          <div className={styles.filterChips} role="group" aria-label="Filtrar por categoria">
            <button type="button" className={cn(styles.filterChip, !filter && styles.filterChipOn)} onClick={() => setFilter(null)}>
              Todos
            </button>
            {usedCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(styles.filterChip, filter === c.id && styles.filterChipOn)}
                style={{ ["--chip" as string]: c.color }}
                onClick={() => setFilter(filter === c.id ? null : c.id)}
                aria-pressed={filter === c.id}
              >
                <span style={{ color: c.color, display: "inline-flex" }}>
                  <PlaceGlyph icon={c.icon} size={14} />
                </span>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.layout}>
        <Card padding="none">
          {shown.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Nenhum lugar ainda"
              description="Adicione restaurantes, pontos turísticos, hospedagem… Busque o endereço ou clique no mapa para marcar."
            />
          ) : (
            <ul className={styles.places} ref={listRef}>
              {shown.map((p) => {
                const c = placeCategoryOf(t.categoriesById, p.categoryId);
                const meta = [c.name, p.date && dateShort(p.date), p.address].filter(Boolean).join(" · ");
                return (
                  <li
                    key={p.id}
                    data-place={p.id}
                    className={cn(styles.place, selected === p.id && styles.placeOn)}
                    onClick={() => setSelected(p.id)}
                  >
                    <button
                      type="button"
                      className={cn(styles.visitBtn, p.visited && styles.visitOn)}
                      onClick={(e) => {
                        e.stopPropagation();
                        t.updatePlace(p.id, { visited: !p.visited });
                      }}
                      aria-pressed={p.visited}
                      aria-label={p.visited ? `Desmarcar ${p.name} como visitado` : `Marcar ${p.name} como visitado`}
                      title={p.visited ? "Visitado" : "Marcar como visitado"}
                    >
                      <Check size={14} aria-hidden />
                    </button>
                    <PlaceBadge icon={c.icon} color={c.color} size={36} />
                    <div className={styles.placeMain}>
                      <span className={cn(styles.placeName, p.visited && styles.placeVisited)}>{p.name}</span>
                      <span className={styles.muted}>
                        {meta}
                        {p.lat === null && " · sem ponto no mapa"}
                      </span>
                      {p.description && (
                        <div
                          className={cn(styles.placeDesc, tasksStyles.richText)}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.description) }}
                        />
                      )}
                    </div>
                    <div className={styles.placeActions}>
                      <IconButton
                        icon={Pencil}
                        size="sm"
                        label={`Editar ${p.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm({ open: true, editing: p });
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className={styles.stickyMap}>
          <TravelMap markers={markers} fitKey={fitKey} selectedId={selected} onSelect={selectFromMap} />
          {usedCats.length > 0 && (
            <div className={styles.legend}>
              {usedCats.map((c) => (
                <span key={c.id}>
                  <span className={styles.dot} style={{ background: c.color }} /> {c.name}
                </span>
              ))}
              {places.length > withPoint.length && !filter && <span>{places.length - withPoint.length} sem ponto no mapa</span>}
            </div>
          )}
        </div>
      </div>

      {form.open && (
        <PlaceForm
          key={form.editing?.id ?? "new"}
          trip={trip}
          editing={form.editing}
          onClose={() => setForm({ open: false, editing: null })}
        />
      )}
    </>
  );
}

// ───────── Gastos (lançamentos de Finanças) ─────────

function ExpensesTab({ trip }: { trip: Trip }) {
  const t = useTravel();
  const d = useFinance();
  const wide = useWide();
  const category = trip.financeCategoryId ? d.catById(trip.financeCategoryId) : undefined;
  const [sort, setSort] = useState<TxSort>({ key: "date", dir: "desc" });
  const [modal, setModal] = useState<{ open: boolean; editing: Transaction | null; month?: string }>({ open: false, editing: null });
  const [toDelete, setToDelete] = useState<Occurrence | null>(null);
  const [moving, setMoving] = useState<Occurrence | null>(null);
  const [paying, setPaying] = useState<Occurrence | null>(null);
  const [receiving, setReceiving] = useState<Occurrence | null>(null);
  const [fixing, setFixing] = useState(false);

  // Todas as ocorrências da categoria da viagem (em qualquer mês). Fixas param no mês do fim da viagem.
  const endYm = monthOf(trip.endDate);
  const items = useMemo(
    () =>
      sortTx(
        category
          ? d.occurrences.filter((o) => o.tx.categoryId === category.id && (o.tx.frequency !== "FIXED" || o.monthYear <= endYm))
          : [],
        sort,
      ),
    [d.occurrences, category, endYm, sort],
  );

  const total = items.reduce((s, o) => s + (o.tx.type === "INCOME" ? -o.amount : o.amount), 0);
  const partOf = (id: string) =>
    items.reduce((s, o) => s + o.splits.filter((sp) => sp.responsibleId === id).reduce((a, sp) => a + sp.amount, 0), 0);
  const people = [ME_ID, ...trip.companions.filter((id) => id !== ME_ID)];

  if (!category) {
    return (
      <Alert tone="warning" title="Categoria de despesa não encontrada">
        <p>A categoria desta viagem foi excluída em Finanças. Recrie-a para lançar e acompanhar os gastos aqui.</p>
        <Button
          size="sm"
          loading={fixing}
          onClick={async () => {
            setFixing(true);
            try {
              await t.ensureFinanceCategory(trip);
            } finally {
              setFixing(false);
            }
          }}
          style={{ marginTop: 8 }}
        >
          Recriar categoria
        </Button>
      </Alert>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Button icon={Plus} onClick={() => setModal({ open: true, editing: null })}>
          Gasto
        </Button>
        <Link href="/financas/lancamentos" className={styles.catLink}>
          <IconBadge name={category.icon} color={category.color} size={26} />
          Lançamentos na categoria “{category.name}”{!category.isActive && " (desativada)"}
        </Link>
      </div>

      <div className={styles.totals}>
        <div className={styles.stat}>
          <span className={styles.muted}>Total da viagem</span>
          <strong>{brl(total)}</strong>
        </div>
        {people.map((id) => (
          <div key={id} className={styles.stat}>
            <span className={styles.muted}>{id === ME_ID ? "Minha parte" : `Parte de ${d.respName(id)}`}</span>
            <strong>{brl(partOf(id))}</strong>
          </div>
        ))}
        <div className={styles.stat}>
          <span className={styles.muted}>Lançamentos</span>
          <strong>{items.length}</strong>
        </div>
      </div>

      <Card padding="lg">
        <TxList
          items={items}
          mode={wide ? "table" : "list"}
          sort={sort}
          onSort={(k) => setSort((s) => nextTxSort(s, k))}
          onEdit={(o) => setModal({ open: true, editing: o.tx, month: o.baseMonth })}
          onDelete={setToDelete}
          onMove={setMoving}
          onTogglePaid={(o, paid) => (paid ? setPaying(o) : d.setOccPaid(o, false))}
          onToggleReceived={(o, received) =>
            received
              ? setReceiving(o)
              : d.settleSplits(
                  o.splits.filter((s) => s.responsibleId !== ME_ID).map((s) => ({ occ: o, responsibleId: s.responsibleId })),
                  null,
                  false,
                )
          }
          emptyText="Nenhum gasto lançado. Os gastos são lançamentos de Finanças na categoria da viagem."
        />
      </Card>

      <TransactionModal
        open={modal.open}
        editing={modal.editing}
        editingMonth={modal.month}
        initialType="EXPENSE"
        initialCategoryId={category.id}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
      />
      <DeleteTransactionModal occ={toDelete} onClose={() => setToDelete(null)} />
      <MoveTransactionModal occ={moving} onClose={() => setMoving(null)} />
      <PayBoletoModal occ={paying} onClose={() => setPaying(null)} />
      <ReceiveChargeModal occ={receiving} onClose={() => setReceiving(null)} />
    </>
  );
}

// ───────── Página ─────────

export function TripDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTravel();
  const fin = useFinance();
  const trip = t.tripsById[id];
  const [tab, setTab] = useState<Tab>("places");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!trip) {
    return (
      <>
        <Link href="/viagens/lista" className={styles.back}>
          <ArrowLeft size={16} aria-hidden /> Viagens
        </Link>
        <EmptyState icon={Plane} title="Viagem não encontrada" description="Ela pode ter sido excluída." />
      </>
    );
  }

  const phase = tripPhase(trip);
  const days = tripDays(trip.startDate, trip.endDate);
  const hasExpenses = !!trip.financeCategoryId && fin.transactions.some((x) => x.categoryId === trip.financeCategoryId);

  const toggleClosed = async () => {
    setBusy(true);
    try {
      await t.setTripClosed(trip, !trip.closed);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setDeleting(false);
    await t.removeTrip(trip);
    router.push("/viagens/lista");
  };

  return (
    <>
      <Link href="/viagens/lista" className={styles.back}>
        <ArrowLeft size={16} aria-hidden /> Viagens
      </Link>
      <PageHeader
        icon={Plane}
        title={trip.name}
        description={trip.destination || undefined}
        actions={
          <>
            <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="outline" icon={trip.closed ? LockOpen : Lock} loading={busy} onClick={toggleClosed}>
              {trip.closed ? "Reabrir" : "Encerrar"}
            </Button>
            <IconButton icon={Trash2} label="Excluir viagem" variant="outline" onClick={() => setDeleting(true)} />
          </>
        }
      />

      <div className={styles.summary}>
        <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
        <span className={styles.metaRow}>
          <span>
            <CalendarDays size={14} aria-hidden /> {tripRangeLabel(trip.startDate, trip.endDate)} · {days} {days === 1 ? "dia" : "dias"}
          </span>
        </span>
        {trip.companions.length > 0 && (
          <span className={styles.metaRow}>
            <span className={styles.avatars}>
              {trip.companions.map((cid) => (
                <Person key={cid} name={fin.respName(cid)} url={fin.respById(cid)?.avatarUrl} />
              ))}
            </span>
            <span>Com {trip.companions.map(fin.respName).join(", ")}</span>
          </span>
        )}
      </div>

      {phase === "past" && (
        <Alert tone="info" className={styles.tabs}>
          A viagem já terminou. Encerre-a quando os gastos estiverem lançados: a categoria em Finanças é desativada para novos
          lançamentos (os existentes continuam lá).
        </Alert>
      )}

      <div className={styles.tabs}>
        <Segmented
          label="Seção da viagem"
          value={tab}
          onChange={setTab}
          options={[
            { value: "places", label: `Lugares e mapa (${(t.placesByTrip[trip.id] ?? []).length})` },
            { value: "expenses", label: "Gastos" },
          ]}
        />
      </div>

      {tab === "places" ? <PlacesTab trip={trip} /> : <ExpensesTab trip={trip} />}

      {editing && <TripForm editing={trip} onClose={() => setEditing(false)} />}
      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        title="Excluir viagem"
        text={
          hasExpenses
            ? `Excluir “${trip.name}” e todos os lugares dela? Os gastos continuam em Finanças, na categoria da viagem (que será desativada).`
            : `Excluir “${trip.name}” e todos os lugares dela? A categoria da viagem em Finanças também será excluída. Essa ação não pode ser desfeita.`
        }
      />
    </>
  );
}

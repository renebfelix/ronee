"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Plane, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Badge, Button, EmptyState, type BadgeTone } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { useFinance } from "@/features/finance/data/FinanceDataProvider";
import { Person } from "@/features/finance/components/kit";
import { brl } from "@/features/finance/lib/format";
import { TripForm } from "./components/TripForm";
import { useTravel } from "./data/TravelDataProvider";
import { PHASE_LABEL, tripDays, tripPhase, tripRangeLabel, type TripPhase } from "./lib/travel";
import type { Trip } from "./lib/types";
import styles from "./components/Travel.module.scss";

export const PHASE_TONE: Record<TripPhase, BadgeTone> = {
  upcoming: "info",
  ongoing: "success",
  past: "warning",
  closed: "neutral",
};

function TripCard({ trip, spent }: { trip: Trip; spent: number }) {
  const t = useTravel();
  const fin = useFinance();
  const phase = tripPhase(trip);
  const places = t.placesByTrip[trip.id] ?? [];
  const visited = places.filter((p) => p.visited).length;
  const days = tripDays(trip.startDate, trip.endDate);

  return (
    <Link href={`/viagens/lista/${trip.id}`} className={styles.tripCard}>
      <div className={styles.tripCardHead}>
        <div>
          <div className={styles.tripName}>{trip.name}</div>
          {trip.destination && <div className={styles.muted}>{trip.destination}</div>}
        </div>
        <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
      </div>
      <div className={styles.metaRow}>
        <span>
          <CalendarDays size={14} aria-hidden /> {tripRangeLabel(trip.startDate, trip.endDate)} · {days} {days === 1 ? "dia" : "dias"}
        </span>
      </div>
      <div className={styles.metaRow}>
        <span>
          <MapPin size={14} aria-hidden /> {places.length === 0 ? "Nenhum lugar" : `${visited}/${places.length} lugares visitados`}
        </span>
        <span>
          <Wallet size={14} aria-hidden /> {brl(spent)}
        </span>
        {trip.companions.length > 0 && (
          <span className={styles.avatars} title={trip.companions.map(fin.respName).join(", ")}>
            {trip.companions.map((id) => (
              <Person key={id} name={fin.respName(id)} url={fin.respById(id)?.avatarUrl} />
            ))}
          </span>
        )}
      </div>
    </Link>
  );
}

export function TripsView() {
  const t = useTravel();
  const fin = useFinance();
  const router = useRouter();
  const { label, icon } = getNavSubItem("travel-trips");
  const [creating, setCreating] = useState(false);

  // Total gasto por categoria de viagem (soma das ocorrências de despesa; estornos já vêm negativos).
  const spentByCat = useMemo(() => {
    const map: Record<string, number> = {};
    fin.occurrences.forEach((o) => {
      if (o.tx.type === "EXPENSE") map[o.tx.categoryId] = (map[o.tx.categoryId] ?? 0) + o.amount;
    });
    return map;
  }, [fin.occurrences]);
  const spentOf = (trip: Trip) => (trip.financeCategoryId ? (spentByCat[trip.financeCategoryId] ?? 0) : 0);

  const open = t.trips.filter((x) => !x.closed).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const closed = t.trips.filter((x) => x.closed);

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description="Planeje lugares para visitar, veja tudo no mapa e acompanhe os gastos em Finanças."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Nova viagem
          </Button>
        }
      />

      {t.trips.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Nenhuma viagem"
          description="Crie uma viagem com as datas de ida e volta para começar a planejar."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Nova viagem
            </Button>
          }
        />
      ) : (
        <>
          {open.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Abertas</h2>
              <div className={styles.tripGrid}>
                {open.map((trip) => (
                  <TripCard key={trip.id} trip={trip} spent={spentOf(trip)} />
                ))}
              </div>
            </section>
          )}
          {closed.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Encerradas</h2>
              <div className={styles.tripGrid}>
                {closed.map((trip) => (
                  <TripCard key={trip.id} trip={trip} spent={spentOf(trip)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {creating && (
        <TripForm editing={null} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/viagens/lista/${id}`)} />
      )}
    </>
  );
}

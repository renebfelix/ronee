"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Bell, BellOff, CalendarClock, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, List, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Button, Card, EmptyState, IconButton } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { ConfirmModal, Segmented } from "@/features/finance/components/kit";
import { CategoryGlyph } from "@/features/tasks/components/CategoryGlyph";
import { cn } from "@/lib/utils/cn";
import { useCalendar } from "./data/CalendarDataProvider";
import { useHolidays } from "./data/useHolidays";
import { CalendarNotifications } from "./components/CalendarNotifications";
import { EventDetails, ScopeModal } from "./components/EventDetails";
import { EventForm, type EventFormProps } from "./components/EventForm";
import { MonthGrid } from "./components/MonthGrid";
import { OccurrenceItem } from "./components/OccurrenceItem";
import { compareOccurrences, groupByDay, normalize } from "./lib/calendar";
import { addDays, addMonthsYm, longDateLabel, monthGrid, monthLabel, monthOf, today } from "./lib/dates";
import { expandAll } from "./lib/recurrence";
import { enableCalendarPush, loadCalendarPush, type CalendarPush } from "./lib/notifications";
import { isValidDate } from "./lib/recurrence";
import type { EditScope, Occurrence } from "./lib/types";
import styles from "./components/Calendar.module.scss";

type ViewMode = "month" | "list";

type FormState = Omit<EventFormProps, "onClose" | "defaultDate"> | null;

export function CalendarView() {
  const s = useCalendar();
  const { label, icon } = getNavSubItem("calendar-month");
  const now = today();
  // Vindo de uma notificação: abre no dia do evento (?dia=AAAA-MM-DD).
  const [initialDay] = useState(() => {
    const dia = new URLSearchParams(window.location.search).get("dia");
    return dia && isValidDate(dia) ? dia : now;
  });
  const [ym, setYm] = useState(monthOf(initialDay));
  const [selected, setSelected] = useState(initialDay);
  const [view, setView] = useState<ViewMode>("month");
  const [hidden, setHidden] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [details, setDetails] = useState<Occurrence | null>(null);
  const [scopeAsk, setScopeAsk] = useState<{ mode: "edit" | "delete"; occ: Occurrence } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Occurrence | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [push, setPush] = useState<CalendarPush | null>(() => loadCalendarPush());
  const [managingPush, setManagingPush] = useState(false);

  // Push ativo neste aparelho: renova o token e o fuso horário a cada abertura.
  useEffect(() => {
    if (loadCalendarPush() && "Notification" in window && Notification.permission === "granted") {
      enableCalendarPush(s.uid).then(setPush).catch(() => {});
    }
  }, [s.uid]);

  const days = useMemo(() => monthGrid(ym), [ym]);
  const from = days[0];
  const to = days[days.length - 1];
  // Anos do mês exibido e dos próximos 60 dias (o painel lateral).
  const holidays = useHolidays([from, to, now, addDays(now, 60)].map((d) => Number(d.slice(0, 4))));
  const allEvents = useMemo(() => [...s.events, ...holidays.events], [s.events, holidays.events]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return allEvents.filter(
      (e) =>
        !hidden.includes(e.category) &&
        (!q || normalize(`${e.title} ${e.location ?? ""}`).includes(q)),
    );
  }, [allEvents, hidden, search]);

  const byDay = useMemo(() => groupByDay(expandAll(filtered, from, to), from, to), [filtered, from, to]);

  // Visão em lista: só o mês exibido.
  const monthStart = `${ym}-01`;
  const monthEnd = addDays(`${addMonthsYm(ym, 1)}-01`, -1);
  const monthDays = days.filter((d) => d >= monthStart && d <= monthEnd && byDay[d]?.length);

  const upcoming = useMemo(
    () =>
      expandAll(filtered, now, addDays(now, 60))
        .filter((o) => o.startDate >= now)
        .sort(compareOccurrences)
        .slice(0, 6),
    [filtered, now],
  );

  const selectedList = byDay[selected] ?? [];

  const goMonth = (delta: number) => {
    const next = addMonthsYm(ym, delta);
    setYm(next);
    setSelected(monthOf(now) === next ? now : `${next}-01`);
  };
  const goToday = () => {
    setYm(monthOf(now));
    setSelected(now);
  };
  const selectDay = (day: string) => {
    setSelected(day);
    if (monthOf(day) !== ym) setYm(monthOf(day));
  };

  const toggleCategory = (id: string) => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));

  // ───── Criação, edição e exclusão ─────

  const newEvent = (day = selected) => {
    setSelected(day);
    setForm({ title: "Novo evento", initial: null, onSubmit: s.addEvent });
  };

  const openEdit = (occ: Occurrence, scope: EditScope) => {
    const e = occ.event;
    const series = {
      title: e.title,
      description: e.description,
      location: e.location,
      category: e.category,
      allDay: e.allDay,
      startDate: e.startDate,
      startTime: e.startTime,
      endDate: e.endDate,
      endTime: e.endTime,
      recurrence: e.recurrence,
      reminders: e.reminders ?? [],
    };
    const initial = scope === "all" ? series : { ...series, startDate: occ.startDate, endDate: occ.endDate };
    setForm({
      title: scope === "this" ? "Editar esta ocorrência" : "Editar evento",
      initial,
      lockRecurrence: scope === "this" && !!e.recurrence,
      onSubmit: (data) => s.saveOccurrence(occ, scope, data),
    });
  };

  const askEdit = (occ: Occurrence) => {
    setDetails(null);
    if (occ.event.recurrence) setScopeAsk({ mode: "edit", occ });
    else openEdit(occ, "all");
  };
  const askDelete = (occ: Occurrence) => {
    setDetails(null);
    if (occ.event.recurrence) setScopeAsk({ mode: "delete", occ });
    else setConfirmDelete(occ);
  };
  const pickScope = (scope: EditScope) => {
    if (!scopeAsk) return;
    const { mode, occ } = scopeAsk;
    setScopeAsk(null);
    if (mode === "edit") openEdit(occ, scope);
    else s.removeOccurrence(occ, scope);
  };

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description="Seus compromissos, com categorias, locais e repetições."
        actions={
          <>
            <Button variant="outline" icon={push ? Bell : BellOff} onClick={() => setManagingPush(true)}>
              Notificações
            </Button>
            <Button icon={Plus} onClick={() => newEvent()}>
              Novo evento
            </Button>
          </>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <IconButton icon={ChevronLeft} label="Mês anterior" size="sm" onClick={() => goMonth(-1)} />
          <strong>{monthLabel(ym)}</strong>
          <IconButton icon={ChevronRight} label="Próximo mês" size="sm" onClick={() => goMonth(1)} />
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Hoje
        </Button>
        <label className={styles.search}>
          <Search size={16} aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar eventos" aria-label="Buscar eventos" />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        <div className={styles.viewToggle}>
          <Segmented<ViewMode>
            value={view}
            onChange={setView}
            label="Visualização"
            options={[
              { value: "month", label: "Mês" },
              { value: "list", label: "Lista" },
            ]}
          />
        </div>
      </div>

      <div className={styles.filters} role="group" aria-label="Filtrar por categoria">
        {s.categories.map((c) => {
          const on = !hidden.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={cn(styles.catChip, on && styles.catChipOn)}
              style={{ "--cat": c.color } as CSSProperties}
              onClick={() => toggleCategory(c.id)}
              aria-pressed={on}
              title={on ? `Ocultar ${c.name}` : `Mostrar ${c.name}`}
            >
              <CategoryGlyph icon={c.icon} size={14} />
              {c.name}
            </button>
          );
        })}
      </div>

      {holidays.status === "unavailable" && (
        <p className={styles.notice}>Não foi possível carregar os feriados agora.</p>
      )}

      <div className={styles.layout}>
        <Card padding="none" className={styles.main}>
          {view === "month" ? (
            <MonthGrid
              ym={ym}
              days={days}
              byDay={byDay}
              selected={selected}
              onSelect={selectDay}
              onCreate={newEvent}
              onOpen={setDetails}
            />
          ) : monthDays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nada neste mês"
              description={search || hidden.length ? "Nenhum evento com os filtros atuais." : "Adicione um evento para começar."}
              action={
                <Button icon={Plus} onClick={() => newEvent(monthOf(now) === ym ? now : `${ym}-01`)}>
                  Novo evento
                </Button>
              }
            />
          ) : (
            <div className={styles.listView}>
              {monthDays.map((d) => (
                <section key={d} className={styles.listDay}>
                  <h3 className={cn(d === now && styles.listToday)}>{longDateLabel(d)}</h3>
                  <ul className={styles.items}>
                    {byDay[d].map((o) => (
                      <OccurrenceItem key={o.key} occurrence={o} day={d} onOpen={setDetails} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>

        <aside className={styles.side}>
          <Card padding="none" className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <span className={styles.panelKicker}>{selected === now ? "Hoje" : "Dia selecionado"}</span>
                <h2>{longDateLabel(selected)}</h2>
              </div>
              <IconButton icon={CalendarPlus} label="Novo evento neste dia" onClick={() => newEvent(selected)} />
            </div>
            {selectedList.length ? (
              <ul className={styles.items}>
                {selectedList.map((o) => (
                  <OccurrenceItem key={o.key} occurrence={o} day={selected} onOpen={setDetails} />
                ))}
              </ul>
            ) : (
              <p className={styles.panelEmpty}>
                Nenhum evento.{" "}
                <button type="button" className={styles.addLink} onClick={() => newEvent(selected)}>
                  Adicionar
                </button>
              </p>
            )}
          </Card>

          <Card padding="none" className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <span className={styles.panelKicker}>
                  <CalendarClock size={12} aria-hidden /> Próximos 60 dias
                </span>
                <h2>Próximos eventos</h2>
              </div>
              <IconButton icon={List} label="Ver em lista" onClick={() => setView("list")} />
            </div>
            {upcoming.length ? (
              <ul className={styles.items}>
                {upcoming.map((o) => (
                  <li key={o.key} className={styles.upcoming}>
                    <button type="button" className={styles.upcomingDate} onClick={() => selectDay(o.startDate)}>
                      {o.startDate === now ? "Hoje" : longDateLabel(o.startDate)}
                    </button>
                    <ul className={styles.items}>
                      <OccurrenceItem occurrence={o} onOpen={setDetails} />
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.panelEmpty}>Nada agendado por enquanto.</p>
            )}
          </Card>
        </aside>
      </div>

      {details && (
        <EventDetails occurrence={details} onClose={() => setDetails(null)} onEdit={() => askEdit(details)} onDelete={() => askDelete(details)} />
      )}
      {scopeAsk && <ScopeModal mode={scopeAsk.mode} onClose={() => setScopeAsk(null)} onPick={pickScope} />}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) s.removeOccurrence(confirmDelete, "all");
          setConfirmDelete(null);
        }}
        title="Excluir evento"
        text={`Excluir “${confirmDelete?.event.title}”? Essa ação não pode ser desfeita.`}
      />
      {form && <EventForm {...form} defaultDate={selected} onClose={() => setForm(null)} />}
      {managingPush && (
        <CalendarNotifications uid={s.uid} settings={push} onChange={setPush} onClose={() => setManagingPush(false)} />
      )}
    </>
  );
}

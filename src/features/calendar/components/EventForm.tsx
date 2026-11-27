"use client";

import { useState, type CSSProperties } from "react";
import { AlignLeft, Bell, MapPin, Repeat, X } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { ErrorText, Field, FieldGroup, Segmented, ui } from "@/features/finance/components/kit";
import { DescriptionEditor } from "@/features/tasks/components/DescriptionEditor";
import { CategoryGlyph } from "@/features/tasks/components/CategoryGlyph";
import { cn } from "@/lib/utils/cn";
import { useCalendar } from "../data/CalendarDataProvider";
import { addDays, addMinutesToTime, defaultTimes, diffDays, minutesBetween, WEEKDAYS_MIN, WEEKDAYS_LONG, weekday } from "../lib/dates";
import { describeRecurrence, FREQUENCIES, isValidDate } from "../lib/recurrence";
import { HOLIDAY_CATEGORY } from "../lib/holidays";
import { loadCalendarPush } from "../lib/notifications";
import {
  ALL_DAY_REMINDERS,
  DEFAULT_ALL_DAY_REMINDERS,
  DEFAULT_TIMED_REMINDERS,
  MAX_REMINDERS,
  reminderLabel,
  TIMED_REMINDERS,
} from "../lib/reminders";
import type { CalendarEvent, EventInput, Frequency, RecurrenceRule } from "../lib/types";
import styles from "./Calendar.module.scss";

type EndMode = "never" | "until" | "count";

export interface EventFormProps {
  title: string;
  /** Valores iniciais (edição) ou null para um evento novo. */
  initial: Omit<CalendarEvent, "id" | "createdAt" | "exceptions"> | null;
  /** Dia sugerido para um evento novo. */
  defaultDate: string;
  /** Edição de "só esta ocorrência": não dá para mudar a repetição. */
  lockRecurrence?: boolean;
  onClose: () => void;
  onSubmit: (data: EventInput) => Promise<void>;
}

export function EventForm({ title: modalTitle, initial, defaultDate, lockRecurrence, onClose, onSubmit }: EventFormProps) {
  const s = useCalendar();
  const times = defaultTimes();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? times.start);
  const [endDate, setEndDate] = useState(initial?.endDate ?? defaultDate);
  const [endTime, setEndTime] = useState(initial?.endTime ?? times.end);
  // Feriados vêm da API: novos eventos começam na primeira categoria do usuário.
  const fallbackCategory = (s.categories.find((c) => c.id !== HOLIDAY_CATEGORY.id) ?? s.categories[0])?.id ?? "";
  const [selectedCategory, setCategory] = useState(initial?.category ?? fallbackCategory);
  const category = s.categoriesById[selectedCategory] ? selectedCategory : fallbackCategory;
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [showDescription, setShowDescription] = useState(Boolean(initial?.description));

  const rule = initial?.recurrence;
  const [repeat, setRepeat] = useState<Frequency | "none">(rule?.freq ?? "none");
  const [every, setEvery] = useState(String(rule?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays?.length ? rule.weekdays : [weekday(startDate)]);
  const [endMode, setEndMode] = useState<EndMode>(rule?.until ? "until" : rule?.count ? "count" : "never");
  const [until, setUntil] = useState(rule?.until ?? addDays(startDate, 30));
  const [count, setCount] = useState(String(rule?.count ?? 10));

  const [reminders, setReminders] = useState<number[]>(
    initial?.reminders ?? (initial?.allDay ? DEFAULT_ALL_DAY_REMINDERS : DEFAULT_TIMED_REMINDERS),
  );
  const reminderOptions = allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS;
  const [pushOn] = useState(() => Boolean(loadCalendarPush()));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Dia inteiro e com horário têm opções de lembrete diferentes.
  const changeAllDay = (value: boolean) => {
    setAllDay(value);
    const [fromDefault, toDefault, allowed] = value
      ? [DEFAULT_TIMED_REMINDERS, DEFAULT_ALL_DAY_REMINDERS, ALL_DAY_REMINDERS]
      : [DEFAULT_ALL_DAY_REMINDERS, DEFAULT_TIMED_REMINDERS, TIMED_REMINDERS];
    setReminders((prev) =>
      prev.join() === fromDefault.join() ? toDefault : prev.filter((m) => allowed.includes(m)),
    );
  };
  const addReminder = (min: number) => setReminders((prev) => [...new Set([...prev, min])].sort((a, b) => a - b));
  const removeReminder = (min: number) => setReminders((prev) => prev.filter((m) => m !== min));

  // Mudar o início arrasta o fim junto, mantendo a duração.
  const changeStartDate = (value: string) => {
    if (isValidDate(value) && isValidDate(startDate)) setEndDate(addDays(endDate, diffDays(startDate, value)));
    setStartDate(value);
    if (repeat === "weekly" && weekdays.length === 1 && isValidDate(value)) setWeekdays([weekday(value)]);
  };
  const changeStartTime = (value: string) => {
    if (value && startTime && endTime && startDate === endDate) {
      const len = Math.max(minutesBetween(startTime, endTime), 0);
      setEndTime(addMinutesToTime(value, len || 60));
    }
    setStartTime(value);
  };

  const toggleWeekday = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort()));

  const recurrence: RecurrenceRule | null =
    repeat === "none"
      ? null
      : {
          freq: repeat,
          interval: Math.max(1, Math.min(99, parseInt(every, 10) || 1)),
          weekdays: repeat === "weekly" ? weekdays : [],
          until: endMode === "until" ? until : null,
          count: endMode === "count" ? Math.max(1, Math.min(999, parseInt(count, 10) || 1)) : null,
        };

  const submit = async () => {
    setError("");
    const t = title.trim();
    if (!t) return setError("Informe o título do evento.");
    if (!isValidDate(startDate) || !isValidDate(endDate)) return setError("Informe datas válidas.");
    if (!allDay && (!startTime || !endTime)) return setError("Informe os horários de início e fim.");
    if (endDate < startDate || (!allDay && endDate === startDate && endTime < startTime)) {
      return setError("O fim precisa ser depois do início.");
    }
    if (recurrence?.until && (!isValidDate(recurrence.until) || recurrence.until < startDate)) {
      return setError("A data final da repetição precisa ser depois do início.");
    }
    if (!category) return setError("Crie uma categoria antes de adicionar eventos.");

    setSaving(true);
    try {
      await onSubmit({
        title: t,
        description: description || null,
        location: location.trim() || null,
        category,
        allDay,
        startDate,
        startTime: allDay ? null : startTime,
        endDate,
        endTime: allDay ? null : endTime,
        recurrence: lockRecurrence ? null : recurrence,
        reminders: reminders.filter((m) => reminderOptions.includes(m)),
      });
      onClose();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const unit = repeat !== "none" ? FREQUENCIES[repeat].unit : null;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={modalTitle}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className={ui.stack}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Título">
          <input
            className={ui.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Consulta no dentista"
            maxLength={120}
            autoFocus
          />
        </Field>

        <label className={styles.switchRow}>
          <input type="checkbox" checked={allDay} onChange={(e) => changeAllDay(e.target.checked)} />
          <span className={styles.switch} aria-hidden />
          Dia inteiro
        </label>

        <div className={styles.whenGrid}>
          <Field label="Início">
            <div className={styles.dateTime}>
              <input type="date" className={ui.input} value={startDate} onChange={(e) => changeStartDate(e.target.value)} />
              {!allDay && (
                <input
                  type="time"
                  className={ui.input}
                  value={startTime}
                  onChange={(e) => changeStartTime(e.target.value)}
                  aria-label="Hora de início"
                />
              )}
            </div>
          </Field>
          <Field label="Fim">
            <div className={styles.dateTime}>
              <input type="date" className={ui.input} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              {!allDay && (
                <input
                  type="time"
                  className={ui.input}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-label="Hora de fim"
                />
              )}
            </div>
          </Field>
        </div>

        <FieldGroup label="Categoria">
          <div className={styles.catPick}>
            {s.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(styles.catChip, c.id === category && styles.catChipOn)}
                style={{ "--cat": c.color } as CSSProperties}
                onClick={() => setCategory(c.id)}
                aria-pressed={c.id === category}
              >
                <CategoryGlyph icon={c.icon} size={14} />
                {c.name}
              </button>
            ))}
          </div>
        </FieldGroup>

        <Field label="Local">
          <div className={styles.withIcon}>
            <MapPin size={18} aria-hidden />
            <input
              className={ui.input}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Endereço, sala ou link da reunião"
              maxLength={200}
            />
          </div>
        </Field>

        <FieldGroup
          label="Lembretes"
          warn={!pushOn && reminders.length > 0}
          hint={
            !pushOn && reminders.length > 0
              ? "As notificações estão desligadas neste aparelho — ative em “Notificações” no topo da Agenda."
              : undefined
          }
        >
          <div className={styles.reminders}>
            {reminders
              .filter((m) => reminderOptions.includes(m))
              .map((m) => (
                <span key={m} className={styles.reminderChip}>
                  <Bell size={13} aria-hidden />
                  {reminderLabel(m, allDay)}
                  <button type="button" onClick={() => removeReminder(m)} aria-label={`Remover lembrete: ${reminderLabel(m, allDay)}`}>
                    <X size={13} aria-hidden />
                  </button>
                </span>
              ))}
            {reminders.length < MAX_REMINDERS && (
              <select
                className={cn(ui.select, styles.reminderAdd)}
                value=""
                onChange={(e) => e.target.value && addReminder(Number(e.target.value))}
                aria-label="Adicionar lembrete"
              >
                <option value="">{reminders.length ? "+ Outro lembrete" : "+ Adicionar lembrete"}</option>
                {reminderOptions
                  .filter((m) => !reminders.includes(m))
                  .map((m) => (
                    <option key={m} value={m}>
                      {reminderLabel(m, allDay)}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </FieldGroup>

        {lockRecurrence ? (
          <p className={styles.note}>
            <Repeat size={14} aria-hidden /> Editando só esta ocorrência — ela vira um evento avulso.
          </p>
        ) : (
          <FieldGroup label="Repetição" hint={recurrence ? describeRecurrence(recurrence) : undefined}>
            <select className={ui.select} value={repeat} onChange={(e) => setRepeat(e.target.value as Frequency | "none")}>
              <option value="none">Não se repete</option>
              {Object.entries(FREQUENCIES).map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                </option>
              ))}
            </select>

            {unit && (
              <div className={styles.repeatBox}>
                <div className={styles.inline}>
                  <span>A cada</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className={cn(ui.input, styles.small)}
                    value={every}
                    onChange={(e) => setEvery(e.target.value)}
                    aria-label="Intervalo"
                  />
                  <span>{(parseInt(every, 10) || 1) === 1 ? unit[0] : unit[1]}</span>
                </div>

                {repeat === "weekly" && (
                  <div className={styles.weekdayPick} role="group" aria-label="Dias da semana">
                    {WEEKDAYS_MIN.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        className={cn(styles.weekdayBtn, weekdays.includes(i) && styles.weekdayOn)}
                        onClick={() => toggleWeekday(i)}
                        aria-pressed={weekdays.includes(i)}
                        aria-label={WEEKDAYS_LONG[i]}
                        title={WEEKDAYS_LONG[i]}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.inline}>
                  <span>Termina</span>
                  <Segmented<EndMode>
                    value={endMode}
                    onChange={setEndMode}
                    label="Fim da repetição"
                    options={[
                      { value: "never", label: "Nunca" },
                      { value: "until", label: "Em uma data" },
                      { value: "count", label: "Após" },
                    ]}
                  />
                  {endMode === "until" && (
                    <input
                      type="date"
                      className={cn(ui.input, styles.medium)}
                      value={until}
                      min={startDate}
                      onChange={(e) => setUntil(e.target.value)}
                      aria-label="Repetir até"
                    />
                  )}
                  {endMode === "count" && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        className={cn(ui.input, styles.small)}
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                        aria-label="Número de ocorrências"
                      />
                      <span>{(parseInt(count, 10) || 1) === 1 ? "vez" : "vezes"}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </FieldGroup>
        )}

        {showDescription ? (
          <FieldGroup label="Descrição">
            <DescriptionEditor value={description} onChange={setDescription} placeholder="Pauta, observações, links..." />
          </FieldGroup>
        ) : (
          <button type="button" className={styles.addLink} onClick={() => setShowDescription(true)}>
            <AlignLeft size={15} aria-hidden /> Adicionar descrição
          </button>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

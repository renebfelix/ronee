"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CircleCheck,
  Clock,
  Inbox,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  TrendingUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Alert, Button, Card, EmptyState } from "@/components/ui";
import { getNavSubItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "./data/TasksDataProvider";
import { CategoryGlyph } from "./components/CategoryGlyph";
import { NotificationSettings } from "./components/NotificationSettings";
import { SortMenu } from "./components/SortMenu";
import { TaskForm } from "./components/TaskForm";
import { TaskItem } from "./components/TaskItem";
import { enablePush, loadPushSettings, type PushSettings } from "./lib/notifications";
import { DEFAULT_SORT, isSortKey, normalize, sortTasks } from "./lib/tasks";
import type { NewTask, SortKey, StatusFilter } from "./lib/types";
import styles from "./components/Tasks.module.scss";

const SORT_KEY = "ronee:tasks:sort";

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: LucideIcon }[] = [
  { key: "pending", label: "Pendentes", icon: Clock },
  { key: "done", label: "Concluídas", icon: CircleCheck },
  { key: "all", label: "Todas", icon: List },
];

export function TasksView() {
  const s = useTasks();
  const { label, icon } = getNavSubItem("tasks-list");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Só renderiza no cliente (o provedor mostra o carregamento até os dados chegarem).
  const [sort, setSort] = useState<SortKey>(() => {
    const saved = localStorage.getItem(SORT_KEY);
    return isSortKey(saved) ? saved : DEFAULT_SORT;
  });
  const [push, setPush] = useState<PushSettings | null>(() => loadPushSettings());
  const [managingPush, setManagingPush] = useState(false);

  // Push ativo neste aparelho: renova o token e o fuso horário a cada abertura.
  useEffect(() => {
    const saved = loadPushSettings();
    if (saved && "Notification" in window && Notification.permission === "granted") {
      enablePush(s.uid, saved.hour).then(setPush).catch(() => {});
    }
  }, [s.uid]);

  // Se a categoria filtrada for excluída, volta para "Todas".
  const category = categoryFilter === "all" || s.categoriesById[categoryFilter] ? categoryFilter : "all";

  const stats = useMemo(() => {
    const done = s.tasks.filter((t) => t.done).length;
    return {
      total: s.tasks.length,
      done,
      pending: s.tasks.length - done,
      urgent: s.tasks.filter((t) => !t.done && t.priority === "high").length,
      progress: s.tasks.length ? Math.round((done / s.tasks.length) * 100) : 0,
    };
  }, [s.tasks]);

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    const filtered = s.tasks.filter(
      (t) =>
        (status === "all" || (status === "done") === t.done) &&
        (category === "all" || t.category === category) &&
        (!term || normalize(t.title).includes(term)),
    );
    return sortTasks(filtered, sort);
  }, [s.tasks, status, category, search, sort]);

  const changeSort = (key: SortKey) => {
    setSort(key);
    try {
      localStorage.setItem(SORT_KEY, key);
    } catch {}
  };

  const run = (action: Promise<unknown>) => {
    action.catch(() => setError("Algo deu errado ao salvar. Tente novamente."));
  };

  async function handleAdd(task: NewTask) {
    setError(null);
    try {
      await s.addTask(task);
    } catch {
      setError("Não foi possível adicionar a tarefa.");
    }
  }

  const statCards = [
    { label: "Total", value: stats.total, icon: Inbox, tone: "primary" },
    { label: "Pendentes", value: stats.pending, icon: Clock, tone: "warning" },
    { label: "Concluídas", value: stats.done, icon: CircleCheck, tone: "success" },
    { label: "Urgentes", value: stats.urgent, icon: TriangleAlert, tone: "danger" },
  ];

  return (
    <>
      <PageHeader
        icon={icon}
        title={label}
        description={
          stats.pending === 0
            ? "Nenhuma tarefa pendente. Aproveite!"
            : `Você tem ${stats.pending} ${stats.pending === 1 ? "tarefa pendente" : "tarefas pendentes"}.`
        }
        actions={
          <Button variant="outline" icon={push ? Bell : BellOff} onClick={() => setManagingPush(true)}>
            Resumo diário
          </Button>
        }
      />

      <div className={styles.page}>
        <section className={styles.stats}>
          {statCards.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} padding="sm" className={styles.stat}>
              <span className={cn(styles.statIcon, styles[`tone-${tone}`])}>
                <Icon size={20} aria-hidden />
              </span>
              <div>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            </Card>
          ))}
          <Card padding="sm" className={cn(styles.stat, styles.progressCard)}>
            <span className={cn(styles.statIcon, styles["tone-primary"])}>
              <TrendingUp size={20} aria-hidden />
            </span>
            <div className={styles.progress}>
              <div className={styles.bar} role="progressbar" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${stats.progress}%` }} />
              </div>
              <small>{stats.progress}% concluído</small>
            </div>
          </Card>
        </section>

        <TaskForm categories={s.categories} onAdd={handleAdd} />

        {error && <Alert tone="danger">{error}</Alert>}

        <section className={styles.filters}>
          <div className={styles.tabs} role="tablist" aria-label="Situação">
            {STATUS_FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={status === key}
                className={cn(styles.tab, status === key && styles.tabOn)}
                onClick={() => setStatus(key)}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={16} aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefa..." aria-label="Buscar tarefa" />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">
                  <X size={14} aria-hidden />
                </button>
              )}
            </label>
            <SortMenu value={sort} onChange={changeSort} />
          </div>
        </section>

        <div className={styles.catFilter}>
          <button type="button" className={cn(styles.chip, category === "all" && styles.chipOn)} onClick={() => setCategoryFilter("all")}>
            <LayoutGrid size={14} aria-hidden /> Todas
          </button>
          {s.categories.map((c) => {
            return (
              <button
                key={c.id}
                type="button"
                className={cn(styles.chip, styles.chipCat, category === c.id && styles.chipOn)}
                style={{ "--cat": c.color } as CSSProperties}
                onClick={() => setCategoryFilter(c.id)}
              >
                <CategoryGlyph icon={c.icon} /> {c.name}
              </button>
            );
          })}
          <Link href="/tarefas/categorias" className={cn(styles.chip, styles.chipManage)}>
            <SlidersHorizontal size={14} aria-hidden /> Editar categorias
          </Link>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={s.tasks.length === 0 ? Inbox : Search}
            title={s.tasks.length === 0 ? "Sua lista está vazia" : "Nenhuma tarefa encontrada"}
            description={s.tasks.length === 0 ? "Adicione sua primeira tarefa no campo acima." : "Tente mudar os filtros ou a busca."}
          />
        ) : (
          <ul className={styles.list}>
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                category={s.categoriesById[task.category]}
                categories={s.categories}
                onToggle={() => run(s.toggleTask(task))}
                onUpdate={(data) => run(s.updateTask(task.id, data))}
                onDelete={() => run(s.removeTask(task.id))}
              />
            ))}
          </ul>
        )}
      </div>

      {managingPush && (
        <NotificationSettings uid={s.uid} settings={push} onChange={setPush} onClose={() => setManagingPush(false)} />
      )}
    </>
  );
}

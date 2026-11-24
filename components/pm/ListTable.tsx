"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { updateTaskAction } from "@/lib/pm/actions";
import { endOfWeek } from "@/lib/pm/dates";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/pm/types";
import { DueDate, LabelChip } from "./Badges";
import EmptyState from "./EmptyState";
import { useSyncedState, useTaskHref } from "./hooks";
import { usePm } from "./PmShell";
import { useMutation } from "./Toast";
import { btnGhost, btnPrimary, selectCls } from "./ui";

type SortKey = "board" | "title" | "status" | "priority" | "due";
type Sort = { key: SortKey; dir: "asc" | "desc" };
type DueFilter = "all" | "overdue" | "week" | "none";
type Filters = { status: TaskStatus | "all"; priority: Priority | "all"; label: string; due: DueFilter };

const NO_FILTERS: Filters = { status: "all", priority: "all", label: "all", due: "all" };
const STATUS_RANK = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, i])) as Record<TaskStatus, number>;
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const SORT_LABELS: Record<SortKey, string> = {
  board: "Board order",
  title: "Title",
  status: "Status",
  priority: "Priority",
  due: "Due date",
};

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];
const DUE_FILTERS: DueFilter[] = ["all", "overdue", "week", "none"];

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Filters and sort live in the URL so they survive reloads and can be shared. */
function readView(params: URLSearchParams): { filters: Filters; sort: Sort } {
  return {
    filters: {
      status: oneOf(params.get("status"), ["all", ...TASK_STATUSES], "all"),
      priority: oneOf(params.get("priority"), ["all", ...PRIORITIES], "all"),
      label: params.get("label") || "all",
      due: oneOf(params.get("due"), DUE_FILTERS, "all"),
    },
    sort: {
      key: oneOf(params.get("sort"), SORT_KEYS, "board"),
      dir: oneOf(params.get("dir"), ["asc", "desc"], "asc"),
    },
  };
}

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case "due":
      return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
    case "board":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.position - b.position;
  }
}

function matches(task: Task, f: Filters, today: string): boolean {
  if (f.status !== "all" && task.status !== f.status) return false;
  if (f.priority !== "all" && task.priority !== f.priority) return false;
  if (f.label !== "all" && !task.labels.includes(f.label)) return false;
  if (f.due === "none") return task.dueDate === null;
  if (f.due === "overdue") return task.dueDate !== null && task.dueDate < today && task.status !== "done";
  if (f.due === "week") return task.dueDate !== null && task.dueDate >= today && task.dueDate <= endOfWeek(today);
  return true;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 text-left font-medium ${className}`}
    >
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        <span aria-hidden="true" className={active ? "text-ink" : "text-line"}>
          {active && sort.dir === "desc" ? "↓" : "↑"}
        </span>
      </button>
    </th>
  );
}

export default function ListTable({ tasks: serverTasks, today }: { tasks: Task[]; today: string }) {
  const [tasks, setTasks] = useSyncedState(serverTasks);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mutate = useMutation();
  const taskHref = useTaskHref();
  const { openQuickAdd } = usePm();

  const labels = useMemo(() => Array.from(new Set(tasks.flatMap((t) => t.labels))).sort(), [tasks]);
  const { filters, sort } = useMemo(() => {
    const view = readView(new URLSearchParams(searchParams.toString()));
    // A label that no longer exists (renamed, or a stale link) filters nothing.
    if (!labels.includes(view.filters.label)) view.filters.label = "all";
    return view;
  }, [searchParams, labels]);

  // Writes the view to the query string without a server round trip. Defaults
  // are omitted to keep URLs short; other params (such as ?task=) are kept.
  function writeView(next: { filters?: Filters; sort?: Sort }) {
    const params = new URLSearchParams(searchParams.toString());
    const f = next.filters ?? filters;
    const so = next.sort ?? sort;
    const entries: [string, string, string][] = [
      ["status", f.status, "all"],
      ["priority", f.priority, "all"],
      ["label", f.label, "all"],
      ["due", f.due, "all"],
      ["sort", so.key, "board"],
      ["dir", so.dir, "asc"],
    ];
    for (const [key, value, fallback] of entries) {
      if (value === fallback) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }
  const setFilters = (next: Filters) => writeView({ filters: next });
  const setSort = (next: Sort) => writeView({ sort: next });
  const rows = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1;
    return tasks
      .filter((t) => matches(t, filters, today))
      .sort((a, b) => sign * compare(a, b, sort.key) || compare(a, b, "board"));
  }, [tasks, filters, sort, today]);

  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const onSort = (key: SortKey) =>
    setSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  // Optimistic inline edit: change locally, roll back if the server rejects it.
  function patchTask(id: string, patch: { status?: TaskStatus; priority?: Priority }) {
    const previous = tasks;
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    void mutate(
      () => updateTaskAction({ id, ...patch }),
      () => setTasks(previous),
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks yet"
        action={
          <button type="button" className={btnPrimary} onClick={() => openQuickAdd()}>
            Add the first task
          </button>
        }
      >
        Tasks you add to this project show up here, where you can sort and filter them.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by status"
          className={selectCls}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters["status"] })}
        >
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          className={selectCls}
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value as Filters["priority"] })}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by label"
          className={selectCls}
          value={filters.label}
          onChange={(e) => setFilters({ ...filters, label: e.target.value })}
        >
          <option value="all">All labels</option>
          {labels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by due date"
          className={selectCls}
          value={filters.due}
          onChange={(e) => setFilters({ ...filters, due: e.target.value as DueFilter })}
        >
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due this week</option>
          <option value="none">No due date</option>
        </select>
        <select
          aria-label="Sort by"
          className={`${selectCls} sm:hidden`}
          value={sort.key}
          onChange={(e) => setSort({ key: e.target.value as SortKey, dir: "asc" })}
        >
          {SORT_KEYS.map((k) => (
            <option key={k} value={k}>
              Sort: {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        {filtered && (
          <button type="button" className={btnGhost} onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        )}
        <span className="ml-auto font-mono text-xs text-graphite" aria-live="polite">
          {rows.length} of {tasks.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          action={
            <button type="button" className={btnGhost} onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-line bg-paper text-xs text-graphite">
              <tr>
                <SortHeader label="Title" sortKey="title" sort={sort} onSort={onSort} />
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} className="w-32 sm:w-36" />
                <SortHeader label="Priority" sortKey="priority" sort={sort} onSort={onSort} className="w-[5.75rem] sm:w-32" />
                <th scope="col" className="hidden w-56 px-3 py-2 text-left font-medium md:table-cell">
                  Labels
                </th>
                <SortHeader label="Due" sortKey="due" sort={sort} onSort={onSort} className="hidden w-28 sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((task) => (
                <tr key={task.id} className="hover:bg-line/20">
                  <td className="px-3 py-2">
                    <Link
                      href={taskHref(task.id)}
                      scroll={false}
                      className={`block break-words hover:underline ${
                        task.status === "done" ? "text-graphite line-through" : "text-ink"
                      }`}
                    >
                      {task.title}
                    </Link>
                    {task.dueDate && (
                      <span className="mt-0.5 block sm:hidden">
                        <DueDate date={task.dueDate} today={today} done={task.status === "done"} />
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-2 sm:px-3">
                    <select
                      aria-label={`Status of ${task.title}`}
                      className={`${selectCls} w-full !px-1 !text-sm sm:!px-1.5`}
                      value={task.status}
                      onChange={(e) => patchTask(task.id, { status: e.target.value as TaskStatus })}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1.5 py-2 sm:px-3">
                    <select
                      aria-label={`Priority of ${task.title}`}
                      className={`${selectCls} w-full !px-1 !text-sm sm:!px-1.5 ${task.priority === "high" ? "font-medium text-warn" : ""}`}
                      value={task.priority}
                      onChange={(e) => patchTask(task.id, { priority: e.target.value as Priority })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((name) => (
                        <LabelChip key={name} name={name} />
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    {task.dueDate ? (
                      <DueDate date={task.dueDate} today={today} done={task.status === "done"} />
                    ) : (
                      <span className="text-xs text-graphite/60">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

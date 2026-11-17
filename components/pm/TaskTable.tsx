"use client";

// List view: a sortable, filterable table with inline status and priority
// editing. On phones each row stacks into a card and sorting moves to a select.
import { useMemo, useState } from "react";
import { updateTaskAction } from "@/lib/pm/actions";
import { endOfWeek } from "@/lib/pm/dates";
import { moveItem } from "@/lib/pm/reorder";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type DateString,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { STATUS_DOT, btnPrimary, btnSecondary, selectClass } from "./styles";
import TaskLink from "./TaskLink";
import { DueDate, EmptyState, Kbd, LabelChip } from "./ui";
import { useOptimisticState } from "./useOptimisticState";

type SortKey = "status" | "title" | "priority" | "dueDate";
type Sort = { key: SortKey; dir: "asc" | "desc" };
type DueFilter = "any" | "overdue" | "week" | "none";
type Filters = { status: TaskStatus | "all"; priority: Priority | "all"; label: string; due: DueFilter };

const NO_FILTERS: Filters = { status: "all", priority: "all", label: "all", due: "any" };
const SORT_LABELS: Record<SortKey, string> = { status: "Status", title: "Title", priority: "Priority", dueDate: "Due date" };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case "dueDate":
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    case "status":
      return TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status) || a.order - b.order;
  }
}

function sortTasks(tasks: Task[], sort: Sort): Task[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    // Tasks without a due date always sort last, in either direction.
    if (sort.key === "dueDate" && !a.dueDate !== !b.dueDate) return a.dueDate ? -1 : 1;
    return sign * compare(a, b, sort.key) || compare(a, b, "status") || a.title.localeCompare(b.title);
  });
}

function matches(task: Task, f: Filters, today: DateString): boolean {
  if (f.status !== "all" && task.status !== f.status) return false;
  if (f.priority !== "all" && task.priority !== f.priority) return false;
  if (f.label !== "all" && !task.labels.includes(f.label)) return false;
  if (f.due === "none") return task.dueDate === null;
  if (f.due === "overdue") return task.dueDate !== null && task.dueDate < today && task.status !== "done";
  if (f.due === "week") return task.dueDate !== null && task.dueDate >= today && task.dueDate <= endOfWeek(today);
  return true;
}

export default function TaskTable({ tasks: serverTasks, today }: { tasks: Task[]; today: DateString }) {
  const { openQuickAdd } = usePm();
  const { value: tasks, mutate } = useOptimisticState(serverTasks);
  const [sort, setSort] = useState<Sort>({ key: "status", dir: "asc" });
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const labels = useMemo(() => Array.from(new Set(tasks.flatMap((t) => t.labels))).sort(), [tasks]);
  // A label filter can outlive its label (the last task using it was edited).
  const active = useMemo<Filters>(
    () => (filters.label !== "all" && !labels.includes(filters.label) ? { ...filters, label: "all" } : filters),
    [filters, labels],
  );
  const visible = useMemo(
    () => sortTasks(tasks.filter((t) => matches(t, active, today)), sort),
    [tasks, active, sort, today],
  );
  const filtered = JSON.stringify(active) !== JSON.stringify(NO_FILTERS);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function changeStatus(task: Task, status: TaskStatus) {
    void mutate(
      (list) => moveItem(list, task.id, status, Number.MAX_SAFE_INTEGER),
      () => updateTaskAction({ id: task.id, status }),
    );
  }

  function changePriority(task: Task, priority: Priority) {
    void mutate(
      (list) => list.map((t) => (t.id === task.id ? { ...t, priority } : t)),
      () => updateTaskAction({ id: task.id, priority }),
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks in this project yet"
        body={
          <>
            Add the first one, or press <Kbd>n</Kbd> from any view.
          </>
        }
        action={
          <button type="button" className={btnPrimary} onClick={() => openQuickAdd()}>
            Add a task
          </button>
        }
      />
    );
  }

  const header = (key: SortKey, extra = "") => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 text-left font-medium ${extra}`}
    >
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-ink">
        {SORT_LABELS[key]}
        <span aria-hidden className={sort.key === key ? "text-ink" : "text-transparent"}>
          {sort.dir === "asc" ? "↑" : "↓"}
        </span>
      </button>
    </th>
  );

  const filterSelect = `${selectClass} w-full min-w-0 sm:w-auto`;

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <select
          aria-label="Filter by status"
          className={filterSelect}
          value={active.status}
          onChange={(e) => setFilters({ ...active, status: e.target.value as Filters["status"] })}
        >
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          className={filterSelect}
          value={active.priority}
          onChange={(e) => setFilters({ ...active, priority: e.target.value as Filters["priority"] })}
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
          className={filterSelect}
          value={active.label}
          onChange={(e) => setFilters({ ...active, label: e.target.value })}
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
          className={filterSelect}
          value={active.due}
          onChange={(e) => setFilters({ ...active, due: e.target.value as DueFilter })}
        >
          <option value="any">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due this week</option>
          <option value="none">No due date</option>
        </select>
        <select
          aria-label="Sort by"
          className={`${filterSelect} sm:hidden`}
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [SortKey, Sort["dir"]];
            setSort({ key, dir });
          }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).flatMap((key) => [
            <option key={`${key}:asc`} value={`${key}:asc`}>
              Sort: {SORT_LABELS[key]} ↑
            </option>,
            <option key={`${key}:desc`} value={`${key}:desc`}>
              Sort: {SORT_LABELS[key]} ↓
            </option>,
          ])}
        </select>
        {filtered && (
          <button type="button" className={btnSecondary} onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        )}
        <span className="col-span-2 text-xs text-graphite sm:ml-auto" aria-live="polite">
          {visible.length} of {tasks.length} tasks
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          action={
            <button type="button" className={btnSecondary} onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          }
        />
      ) : (
        <table className="block w-full text-sm sm:table sm:overflow-hidden sm:rounded-lg sm:border sm:border-line sm:bg-white">
          <thead className="hidden border-b border-line bg-paper text-xs text-graphite sm:table-header-group">
            <tr>
              {header("title")}
              {header("status")}
              {header("priority")}
              {header("dueDate")}
              <th scope="col" className="hidden px-3 py-2 text-left font-medium md:table-cell">
                Labels
              </th>
            </tr>
          </thead>
          <tbody className="block space-y-2 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-line">
            {visible.map((task) => (
              <tr
                key={task.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-line bg-white p-3 sm:table-row sm:rounded-none sm:border-0 sm:p-0"
              >
                <td className="block w-full sm:table-cell sm:w-auto sm:px-3 sm:py-2">
                  <TaskLink taskId={task.id} className="text-ink hover:underline">
                    {task.title}
                  </TaskLink>
                </td>
                <td className="block sm:table-cell sm:px-3 sm:py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} aria-hidden />
                    <select
                      aria-label={`Status of ${task.title}`}
                      className={selectClass}
                      value={task.status}
                      onChange={(e) => changeStatus(task, e.target.value as TaskStatus)}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </span>
                </td>
                <td className="block sm:table-cell sm:px-3 sm:py-2">
                  <select
                    aria-label={`Priority of ${task.title}`}
                    className={`${selectClass} ${task.priority === "high" ? "text-warn" : ""}`}
                    value={task.priority}
                    onChange={(e) => changePriority(task, e.target.value as Priority)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="ml-auto block sm:ml-0 sm:table-cell sm:px-3 sm:py-2">
                  {task.dueDate ? (
                    <DueDate date={task.dueDate} today={today} done={task.status === "done"} />
                  ) : (
                    <span className="text-xs text-graphite/70">No date</span>
                  )}
                </td>
                <td className={`w-full sm:w-auto sm:px-3 sm:py-2 ${task.labels.length ? "block" : "hidden"} sm:hidden md:table-cell`}>
                  <span className="flex flex-wrap gap-1">
                    {task.labels.map((l) => (
                      <LabelChip key={l} name={l} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

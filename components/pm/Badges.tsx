import { diffDays, formatDate } from "@/lib/pm/dates";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  STATUS_LABELS,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/pm/types";

const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

const STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: "bg-line/60 text-graphite",
  todo: "bg-ink/10 text-ink",
  in_progress: "bg-accent/15 text-accentDark",
  done: "bg-accent text-paper",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "text-graphite/70",
  medium: "text-graphite",
  high: "text-warn",
};

const PRIORITY_BARS: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${pill} ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const style =
    status === "active" ? "bg-accent/15 text-accentDark" : status === "done" ? "bg-accent text-paper" : "bg-line/60 text-graphite";
  return <span className={`${pill} ${style}`}>{PROJECT_STATUS_LABELS[status]}</span>;
}

/** Priority as three bars plus text, so it never relies on color alone. */
export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
      <span className="flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`w-1 rounded-sm ${n <= PRIORITY_BARS[priority] ? "bg-current" : "bg-line"}`}
            style={{ height: 3 + n * 3 }}
          />
        ))}
      </span>
      <span className={compact ? "sr-only" : undefined}>{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

export function LabelChip({ name }: { name: string }) {
  return <span className="inline-block max-w-[10rem] truncate rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] text-graphite">{name}</span>;
}

/** A due date, flagged when it is in the past and the task is not done. */
export function DueDate({ date, today, done = false }: { date: string; today: string; done?: boolean }) {
  const delta = diffDays(today, date);
  const overdue = delta < 0 && !done;
  const relative = delta === 0 ? "Today" : delta === 1 ? "Tomorrow" : delta === -1 ? "Yesterday" : formatDate(date);
  return (
    <time
      dateTime={date}
      title={formatDate(date, { year: true })}
      className={`whitespace-nowrap font-mono text-xs ${overdue ? "font-semibold text-warn" : "text-graphite"}`}
    >
      {overdue && <span className="sr-only">Overdue: </span>}
      {relative}
    </time>
  );
}

"use client";

// Small shared building blocks for the /pm tool: class names for controls,
// badges, the empty state, and a modal dialog.
import { useEffect, useRef, type ReactNode } from "react";
import { diffDays, formatDate } from "@/lib/pm/dates";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type DateString,
  type Priority,
  type TaskStatus,
} from "@/lib/pm/types";
import { STATUS_DOT } from "./styles";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-graphite">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "text-warn border-warn/40 bg-warn/5",
  medium: "text-ink border-line bg-white",
  low: "text-graphite border-line bg-paper",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${PRIORITY_STYLE[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function LabelChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-line/60 px-2 py-0.5 text-[11px] leading-none text-graphite">
      {name}
    </span>
  );
}

/** A due date, flagged in the warning colour when it has passed and the task is not done. */
export function DueDate({ date, today, done }: { date: DateString; today: DateString; done?: boolean }) {
  const delta = diffDays(today, date);
  const overdue = !done && delta < 0;
  const text = delta === 0 ? "Today" : delta === 1 ? "Tomorrow" : formatDate(date);
  return (
    <span className={`whitespace-nowrap text-xs ${overdue ? "font-medium text-warn" : "text-graphite"}`}>
      {overdue ? `Overdue · ${formatDate(date)}` : text}
    </span>
  );
}

export function ProgressBar({ done, total, color }: { done: number; total: number; color?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${done} of ${total} tasks done`}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-graphite">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] leading-none text-graphite">
      {children}
    </kbd>
  );
}

/**
 * Modal dialog. Closes on Escape and backdrop click, and returns focus to
 * whatever was focused when it opened. The data attributes let the global
 * keyboard shortcuts and the task panel know a dialog is open.
 */
export function Modal({
  title,
  onClose,
  children,
  position = "center",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  position?: "center" | "top";
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      data-pm-overlay
      data-pm-modal
      className={`fixed inset-0 z-[60] flex justify-center bg-ink/30 p-4 ${
        position === "top" ? "items-start pt-[12vh]" : "items-end sm:items-center"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-paper shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

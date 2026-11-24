"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createMilestoneAction, deleteMilestoneAction, updateMilestoneAction } from "@/lib/pm/actions";
import { addDays, diffDays, formatDate, monthLabel, startOfWeek, weekdayIndex } from "@/lib/pm/dates";
import type { Milestone, Task } from "@/lib/pm/types";
import ConfirmButton from "./ConfirmButton";
import EmptyState from "./EmptyState";
import { useTaskHref } from "./hooks";
import { useMutation, useToast } from "./Toast";
import { btnGhost, btnPrimary, btnSecondary, inputCls, selectCls } from "./ui";

const ROW = 34; // px per task row
const LABEL_ROOM = 340; // px kept free on the right so the last task's title fits

type Group = { key: string; milestone: Milestone | null; dated: Task[]; undated: Task[] };

function dayWidth(days: number): number {
  if (days <= 120) return 28;
  if (days <= 240) return 16;
  if (days <= 720) return 8;
  return 4;
}

function MilestoneForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: {
  initial: { name: string; targetDate: string };
  submitLabel: string;
  onSubmit: (values: { name: string; targetDate: string }) => Promise<boolean>;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const [name, setName] = useState(initial.name);
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await onSubmit({ name, targetDate });
        setBusy(false);
        if (ok) onCancel();
      }}
    >
      <input
        aria-label="Milestone name"
        className={`${inputCls} !w-48 !py-1.5`}
        placeholder="Milestone name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        required
        autoFocus
      />
      <input
        aria-label="Target date"
        type="date"
        className={selectCls}
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        required
      />
      <button type="submit" className={btnPrimary} disabled={busy || !name.trim() || !targetDate}>
        {submitLabel}
      </button>
      <button type="button" className={btnSecondary} onClick={onCancel}>
        Cancel
      </button>
      {children}
    </form>
  );
}

export default function Timeline({
  projectId,
  tasks,
  milestones,
  today,
}: {
  projectId: string;
  tasks: Task[];
  milestones: Milestone[];
  today: string;
}) {
  const taskHref = useTaskHref();
  const mutate = useMutation();
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    const byDue = (a: Task, b: Task) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.title.localeCompare(b.title);
    const make = (key: string, milestone: Milestone | null): Group => {
      const mine = tasks.filter((t) => t.milestoneId === (milestone?.id ?? null));
      return {
        key,
        milestone,
        dated: mine.filter((t) => t.dueDate).sort(byDue),
        undated: mine.filter((t) => !t.dueDate),
      };
    };
    const list = milestones.map((m) => make(m.id, m));
    const loose = make("none", null);
    if (loose.dated.length > 0 || loose.undated.length > 0) list.push(loose);
    return list;
  }, [tasks, milestones]);

  const scale = useMemo(() => {
    const dates = [today, ...milestones.map((m) => m.targetDate), ...tasks.flatMap((t) => (t.dueDate ? [t.dueDate] : []))].sort();
    const start = startOfWeek(addDays(dates[0], -3));
    const end = addDays(dates[dates.length - 1], 7);
    const days = diffDays(start, end) + 1;
    const w = dayWidth(days);
    const months: { label: string; left: number }[] = [];
    const weeks: { label: string; left: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      if (i === 0 || date.endsWith("-01")) months.push({ label: monthLabel(date), left: i * w });
      if (weekdayIndex(date) === 0) weeks.push({ label: String(Number(date.slice(8))), left: i * w });
    }
    return { start, w, width: days * w + LABEL_ROOM, months, weeks };
  }, [tasks, milestones, today]);

  const x = (date: string) => diffDays(scale.start, date) * scale.w + scale.w / 2;
  const todayX = x(today);

  // If today is far to the right of the oldest date, start scrolled to it.
  useEffect(() => {
    const el = scroller.current;
    if (el && todayX > el.clientWidth / 2) el.scrollLeft = todayX - 96;
  }, [todayX]);

  const hasAnything = milestones.length > 0 || tasks.some((t) => t.dueDate);

  const addForm = adding ? (
    <MilestoneForm
      initial={{ name: "", targetDate: "" }}
      submitLabel="Add milestone"
      onCancel={() => setAdding(false)}
      onSubmit={async (values) => {
        const result = await mutate(() => createMilestoneAction({ projectId, ...values }));
        if (result.ok) toast.success("Milestone added");
        return result.ok;
      }}
    />
  ) : (
    <button type="button" className={hasAnything ? btnSecondary : btnPrimary} onClick={() => setAdding(true)}>
      Add milestone
    </button>
  );

  if (!hasAnything) {
    return (
      <EmptyState title="Nothing on the timeline yet" action={addForm}>
        Add a milestone, or give a task a due date, and it will appear here.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {addForm}
        <ul className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-graphite" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 bg-ink" aria-hidden="true" /> Milestone
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-white" aria-hidden="true" /> Open
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" /> Done
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warn" aria-hidden="true" /> Overdue
          </li>
        </ul>
      </div>

      <div ref={scroller} className="overflow-x-auto rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Timeline, scrolls horizontally">
        <div className="relative" style={{ width: scale.width }}>
          {/* Date axis */}
          <div className="relative h-12 border-b border-line bg-paper text-xs text-graphite">
            {scale.months.map((m) => (
              <span key={m.left} className="absolute top-1 whitespace-nowrap border-l border-line pl-1.5 font-medium text-ink" style={{ left: m.left }}>
                {m.label}
              </span>
            ))}
            {scale.w >= 8 &&
              scale.weeks.map((wk) => (
                <span key={wk.left} className="absolute bottom-1 pl-1.5 font-mono" style={{ left: wk.left }}>
                  {wk.label}
                </span>
              ))}
          </div>

          {/* Week grid and today marker, behind the rows */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-12" aria-hidden="true">
            {scale.weeks.map((wk) => (
              <span key={wk.left} className="absolute inset-y-0 w-px bg-line/60" style={{ left: wk.left }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 bg-accent/70" style={{ left: todayX - 1 }} />
          </div>
          <span
            className="absolute top-12 z-10 -translate-x-1/2 rounded-b bg-accent px-1.5 py-0.5 text-[10px] font-medium text-paper"
            style={{ left: todayX }}
          >
            Today
          </span>

          <div className="relative pt-6">
            {groups.map((group) => {
              const m = group.milestone;
              const total = group.dated.length + group.undated.length;
              return (
                <section key={group.key} aria-label={m ? `Milestone ${m.name}` : "No milestone"} className="border-b border-line last:border-b-0">
                  <div className="relative" style={{ minHeight: ROW + 6 }}>
                    {m && (
                      <span
                        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink"
                        style={{ left: x(m.targetDate) }}
                        title={`${m.name}: ${formatDate(m.targetDate, { year: true })}`}
                        aria-hidden="true"
                      />
                    )}
                    <div className="sticky left-0 z-10 inline-flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-r-md bg-white/95 py-1.5 pl-3 pr-2 sm:max-w-xl">
                      {m && editingId === m.id ? (
                        <MilestoneForm
                          initial={{ name: m.name, targetDate: m.targetDate }}
                          submitLabel="Save"
                          onCancel={() => setEditingId(null)}
                          onSubmit={async (values) => (await mutate(() => updateMilestoneAction({ id: m.id, ...values }))).ok}
                        >
                          <ConfirmButton
                            label="Delete"
                            question="Delete this milestone? Its tasks are kept."
                            className={`${btnGhost} !text-warn`}
                            onConfirm={async () => {
                              const result = await mutate(() => deleteMilestoneAction({ id: m.id }));
                              if (result.ok) {
                                toast.success("Milestone deleted");
                                setEditingId(null);
                              }
                            }}
                          />
                        </MilestoneForm>
                      ) : (
                        <>
                          <h2 className="truncate text-sm font-medium text-ink">{m ? m.name : "No milestone"}</h2>
                          {m && (
                            <time dateTime={m.targetDate} className={`font-mono text-xs ${m.targetDate < today ? "text-warn" : "text-graphite"}`}>
                              {formatDate(m.targetDate, { year: true })}
                            </time>
                          )}
                          <span className="text-xs text-graphite">
                            {total} {total === 1 ? "task" : "tasks"}
                          </span>
                          {m && (
                            <button type="button" className={`${btnGhost} !px-1.5 !py-0.5 !text-xs`} onClick={() => setEditingId(m.id)}>
                              Edit
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <ul>
                    {group.dated.map((task) => {
                      const done = task.status === "done";
                      const overdue = !done && task.dueDate! < today;
                      return (
                        <li key={task.id} className="relative" style={{ height: ROW }}>
                          <Link
                            href={taskHref(task.id)}
                            scroll={false}
                            className="group absolute top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full pr-2"
                            style={{ left: x(task.dueDate!) - 7, maxWidth: LABEL_ROOM + 40 }}
                            title={`${task.title} (due ${formatDate(task.dueDate!, { year: true })})`}
                          >
                            <span
                              className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                                done ? "border-accent bg-accent" : overdue ? "border-warn bg-warn" : "border-ink bg-white"
                              }`}
                              aria-hidden="true"
                            />
                            <span
                              className={`truncate rounded bg-white/90 px-1 text-sm group-hover:underline ${
                                done ? "text-graphite line-through" : overdue ? "text-warn" : "text-ink"
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-graphite">
                              {overdue && <span className="sr-only">overdue, </span>}
                              {formatDate(task.dueDate!)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {group.undated.length > 0 && (
                    <div className="sticky left-0 inline-flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2 pt-1 text-xs text-graphite sm:max-w-xl">
                      <span>No due date:</span>
                      {group.undated.map((task) => (
                        <Link key={task.id} href={taskHref(task.id)} scroll={false} className="rounded border border-line bg-paper px-1.5 py-0.5 text-ink hover:border-graphite">
                          {task.title}
                        </Link>
                      ))}
                    </div>
                  )}
                  {total === 0 && <p className="sticky left-0 inline-block px-3 pb-2 text-xs text-graphite">No tasks assigned to this milestone yet.</p>}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

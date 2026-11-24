"use client";

// Timeline view: a horizontally scrolling calendar with one group per
// milestone. Milestones are diamonds on their target date; tasks are markers
// on their due date.
import { useEffect, useRef } from "react";
import { addDays, diffDays, formatDate, fromDateString } from "@/lib/pm/dates";
import { TASK_STATUS_LABELS, type DateString, type Milestone, type Task } from "@/lib/pm/types";
import { STATUS_DOT } from "./styles";
import TaskLink from "./TaskLink";
import { EmptyState } from "./ui";

/** Pixels per day, chosen so a few weeks and a few years are both readable. */
function dayWidth(spanDays: number): number {
  if (spanDays <= 150) return 22;
  if (spanDays <= 500) return 8;
  return 3;
}
const LABEL_W = "w-36 sm:w-60"; // sticky left column

type Group = { key: string; milestone: Milestone | null; tasks: Task[] };

function buildGroups(tasks: Task[], milestones: Milestone[]): Group[] {
  const byDue = (a: Task, b: Task) =>
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title);
  const groups: Group[] = milestones.map((m) => ({
    key: m.id,
    milestone: m,
    tasks: tasks.filter((t) => t.milestoneId === m.id).sort(byDue),
  }));
  const known = new Set(milestones.map((m) => m.id));
  // Tasks outside any milestone only belong on a timeline if they have a date.
  const loose = tasks.filter((t) => (!t.milestoneId || !known.has(t.milestoneId)) && t.dueDate).sort(byDue);
  if (loose.length) groups.push({ key: "none", milestone: null, tasks: loose });
  return groups;
}

/** Monday on or before the given date. */
function weekStart(date: DateString): DateString {
  const weekday = fromDateString(date).getUTCDay();
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

export default function Timeline({
  tasks,
  milestones,
  today,
  color,
}: {
  tasks: Task[];
  milestones: Milestone[];
  today: DateString;
  color: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const groups = buildGroups(tasks, milestones);

  const dates = [today, ...milestones.map((m) => m.targetDate), ...groups.flatMap((g) => g.tasks.map((t) => t.dueDate))]
    .filter((d): d is DateString => Boolean(d))
    .sort();
  const start = weekStart(addDays(dates[0], -7));
  const totalDays = diffDays(start, addDays(dates[dates.length - 1], 21)) + 1;
  const DAY_W = dayWidth(totalDays);
  // Label every week when zoomed in, otherwise every 4 or 13 weeks.
  const labelEvery = DAY_W >= 22 ? 1 : DAY_W >= 8 ? 4 : 13;
  const marker = Math.max(10, DAY_W - 6);
  const width = totalDays * DAY_W;
  const x = (date: DateString) => diffDays(start, date) * DAY_W;
  const todayX = x(today);

  // Start with today in view rather than the far-left edge of the range.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Show up to a week of history, less on narrow screens where the track is short.
    const labelWidth = el.querySelector<HTMLElement>("[data-label]")?.offsetWidth ?? 0;
    const lead = Math.min(7 * DAY_W, (el.clientWidth - labelWidth) / 4);
    el.scrollLeft = Math.max(0, todayX - lead);
  }, [todayX, DAY_W]);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="Nothing on the timeline yet"
        body="Add a milestone below, or give tasks a due date, and they will show up here."
      />
    );
  }

  const weeks = Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => addDays(start, i * 7));
  const grid = {
    width,
    backgroundImage: "linear-gradient(to right, #E4E4E1 1px, transparent 1px)",
    backgroundSize: `${7 * labelEvery * DAY_W}px 100%`,
  };
  const todayLine = <span className="absolute inset-y-0 w-px bg-warn/70" style={{ left: todayX + DAY_W / 2 }} aria-hidden />;
  const labelCell = `sticky left-0 z-10 ${LABEL_W} shrink-0 border-r border-line px-3 py-2`;

  return (
    <div>
      <div
        ref={scroller}
        className="overflow-x-auto rounded-lg border border-line bg-white"
        role="region"
        aria-label="Project timeline"
        tabIndex={0}
      >
        <div className="min-w-max">
          <div className="flex border-b border-line bg-paper text-xs text-graphite">
            <div data-label className={`${labelCell} bg-paper font-medium`}>
              Milestone / task
            </div>
            <div className="relative h-12" style={{ width }}>
              {weeks.map((week, i) =>
                i % labelEvery !== 0 ? null : (
                <span
                  key={week}
                  className="absolute top-0 flex h-8 items-center whitespace-nowrap border-l border-line pl-1.5"
                  style={{ left: i * 7 * DAY_W }}
                >
                  {formatDate(week, { year: labelEvery > 1 })}
                </span>
                ),
              )}
              <span
                className="absolute bottom-0 -translate-x-1/2 rounded-t bg-warn px-1 text-[10px] font-medium leading-4 text-white"
                style={{ left: todayX + DAY_W / 2 }}
              >
                Today
              </span>
            </div>
          </div>

          {groups.map((group) => {
            const done = group.tasks.filter((t) => t.status === "done").length;
            return (
              <div key={group.key} className="border-b border-line last:border-b-0">
                <div className="flex bg-paper/60">
                  <div className={`${labelCell} bg-paper`}>
                    <p className="truncate text-sm font-medium text-ink">{group.milestone?.name ?? "No milestone"}</p>
                    <p className="text-xs text-graphite">
                      {group.milestone ? `${formatDate(group.milestone.targetDate)} · ` : ""}
                      {group.tasks.length === 0 ? "no tasks" : `${done}/${group.tasks.length} done`}
                    </p>
                  </div>
                  <div className="relative" style={grid}>
                    {todayLine}
                    {group.milestone && (
                      <span
                        className="absolute top-1/2 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap text-xs font-medium text-ink"
                        style={{ left: x(group.milestone.targetDate) + DAY_W / 2 - 7 }}
                      >
                        <span className="h-3.5 w-3.5 rotate-45 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden />
                        {group.milestone.name}
                      </span>
                    )}
                  </div>
                </div>

                {group.tasks.map((task) => {
                  const overdue = task.dueDate !== null && task.dueDate < today && task.status !== "done";
                  return (
                    <div key={task.id} className="flex border-t border-line/60">
                      <div className={`${labelCell} bg-white`}>
                        <TaskLink taskId={task.id} className="block truncate text-sm text-ink hover:underline">
                          {task.title}
                        </TaskLink>
                        <p className="flex items-center gap-1.5 text-xs text-graphite">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} aria-hidden />
                          <span className="truncate">{TASK_STATUS_LABELS[task.status]}</span>
                        </p>
                      </div>
                      <div className="relative" style={grid}>
                        {todayLine}
                        {task.dueDate ? (
                          <TaskLink
                            taskId={task.id}
                            className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap text-xs ${
                              overdue ? "font-medium text-warn" : "text-graphite"
                            }`}
                          >
                            <span
                              className={`block h-4 rounded-full ${overdue ? "bg-warn" : STATUS_DOT[task.status]}`}
                              style={{ marginLeft: x(task.dueDate) + DAY_W / 2 - marker / 2, width: marker }}
                              aria-hidden
                            />
                            {overdue ? "Overdue · " : "Due "}
                            {formatDate(task.dueDate)}
                          </TaskLink>
                        ) : (
                          <span className="sticky left-40 top-0 inline-block px-3 py-3 text-xs text-graphite/70 sm:left-64">
                            No due date
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-graphite">
        Diamonds are milestone target dates; markers are task due dates. Scroll sideways to move through time.
      </p>
    </div>
  );
}

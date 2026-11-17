"use client";

import type { DateString, Task } from "@/lib/pm/types";
import TaskLink from "./TaskLink";
import { DueDate, LabelChip, PriorityBadge } from "./ui";

/** The card shown on the board. The whole card is a link to the task panel. */
export default function TaskCard({ task, today, overlay }: { task: Task; today: DateString; overlay?: boolean }) {
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  return (
    <div
      className={`relative rounded-md border border-line bg-white p-3 text-left ${
        overlay ? "rotate-1 shadow-lg" : "hover:border-graphite"
      }`}
    >
      <TaskLink taskId={task.id} className="block text-sm leading-snug text-ink after:absolute after:inset-0">
        {task.title}
      </TaskLink>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && <DueDate date={task.dueDate} today={today} done={task.status === "done"} />}
        {task.subtasks.length > 0 && (
          <span className="text-xs text-graphite" aria-label={`${doneSubtasks} of ${task.subtasks.length} subtasks done`}>
            ☑ {doneSubtasks}/{task.subtasks.length}
          </span>
        )}
      </div>
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <LabelChip key={l} name={l} />
          ))}
        </div>
      )}
    </div>
  );
}

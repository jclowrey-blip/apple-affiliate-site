"use client";

import Link from "next/link";
import type { TaskWithProject } from "@/lib/pm/types";
import { DueDate, PriorityBadge } from "./Badges";
import { useTaskHref } from "./hooks";

/** One task in a dashboard list; opens the task panel. */
export default function TaskRow({ task, today }: { task: TaskWithProject; today: string }) {
  const taskHref = useTaskHref();
  return (
    <li>
      <Link
        href={taskHref(task.id)}
        scroll={false}
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-line/30 transition-colors"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{task.title}</span>
          <span className="block truncate text-xs text-graphite">{task.project.name}</span>
        </span>
        <PriorityBadge priority={task.priority} compact />
        {task.dueDate && <DueDate date={task.dueDate} today={today} />}
      </Link>
    </li>
  );
}

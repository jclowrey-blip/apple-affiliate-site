"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import type { Task } from "@/lib/pm/types";
import { DueDate, LabelChip, PriorityBadge } from "./Badges";

/** The visual card, shared by the sortable item and the drag overlay. */
export function TaskCardBody({ task, today, href, overlay = false }: { task: Task; today: string; href?: string; overlay?: boolean }) {
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  return (
    <div
      className={`relative rounded-lg border bg-white p-3 text-left ${
        overlay ? "rotate-1 border-graphite shadow-xl" : "border-line shadow-sm hover:border-graphite"
      }`}
    >
      {href ? (
        <Link
          href={href}
          scroll={false}
          draggable={false}
          className="block break-words text-sm text-ink after:absolute after:inset-0 after:rounded-lg"
        >
          {task.title}
        </Link>
      ) : (
        <span className="block break-words text-sm text-ink">{task.title}</span>
      )}
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((name) => (
            <LabelChip key={name} name={name} />
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-3">
        <PriorityBadge priority={task.priority} compact />
        {task.subtasks.length > 0 && (
          <span className="font-mono text-xs text-graphite" title="Subtasks done">
            <span aria-hidden="true">☑ </span>
            {doneSubtasks}/{task.subtasks.length}
            <span className="sr-only"> subtasks done</span>
          </span>
        )}
        <span className="flex-1" />
        {task.dueDate && <DueDate date={task.dueDate} today={today} done={task.status === "done"} />}
      </div>
    </div>
  );
}

export default function TaskCard({ task, today, href }: { task: Task; today: string; href: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`touch-manipulation select-none rounded-lg [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isDragging ? "opacity-40" : ""
      }`}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
    >
      <TaskCardBody task={task} today={today} href={href} />
    </li>
  );
}

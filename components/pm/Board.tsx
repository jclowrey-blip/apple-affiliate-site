"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useRef, useState } from "react";
import { moveTaskAction } from "@/lib/pm/actions";
import { applyMove, placementOf, sortColumn } from "@/lib/pm/ordering";
import { STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from "@/lib/pm/types";
import EmptyState from "./EmptyState";
import { useSyncedState, useTaskHref } from "./hooks";
import { usePm } from "./PmShell";
import TaskCard, { TaskCardBody } from "./TaskCard";
import { useMutation } from "./Toast";
import { btnPrimary } from "./ui";

const columnId = (status: TaskStatus) => `column:${status}`;
const statusFromColumnId = (id: string): TaskStatus | null =>
  id.startsWith("column:") ? (id.slice("column:".length) as TaskStatus) : null;

function Column({
  status,
  tasks,
  today,
  taskHref,
  onAdd,
}: {
  status: TaskStatus;
  tasks: Task[];
  today: string;
  taskHref: (id: string) => string;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  return (
    <section
      aria-label={`${STATUS_LABELS[status]}, ${tasks.length} tasks`}
      className="flex w-[82vw] max-w-xs shrink-0 snap-start flex-col rounded-xl bg-line/40 sm:w-72 lg:w-auto lg:max-w-none lg:min-w-0 lg:flex-1"
    >
      <header className="flex items-center gap-2 px-3 pb-1 pt-3">
        <h2 className="text-sm font-medium text-ink">{STATUS_LABELS[status]}</h2>
        <span className="font-mono text-xs text-graphite">{tasks.length}</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add task to ${STATUS_LABELS[status]}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-lg leading-none text-graphite hover:bg-line hover:text-ink"
        >
          +
        </button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`flex min-h-[6rem] flex-1 flex-col gap-2 rounded-b-xl p-2 transition-colors ${isOver ? "bg-accent/10" : ""}`}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} today={today} href={taskHref(task.id)} />
          ))}
          {tasks.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-graphite">
              No tasks. Drop one here.
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export default function Board({ tasks: serverTasks, today }: { tasks: Task[]; today: string }) {
  const [tasks, setTasks] = useSyncedState(serverTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const beforeDrag = useRef<Task[] | null>(null);
  const mutate = useMutation();
  const taskHref = useTaskHref();
  const { openQuickAdd } = usePm();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press to drag on touch screens so the board still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Space picks up and drops; Enter is left alone so it still opens the task.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] },
    }),
  );

  function onDragStart({ active }: DragStartEvent) {
    beforeDrag.current = tasks;
    setActiveId(String(active.id));
  }

  // While dragging over another column, move the card there so the column
  // makes room. Reordering inside one column is resolved on drop.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    setTasks((current) => {
      const moving = current.find((t) => t.id === id);
      if (!moving) return current;
      const overColumn = statusFromColumnId(overId);
      const overTask = overColumn ? null : current.find((t) => t.id === overId);
      const toStatus = overColumn ?? overTask?.status;
      if (!toStatus || toStatus === moving.status) return current;

      const destination = sortColumn(current, toStatus);
      let index = destination.length;
      if (overTask) {
        const overIndex = destination.findIndex((t) => t.id === overTask.id);
        const draggedRect = active.rect.current.translated;
        const below = draggedRect ? draggedRect.top > over.rect.top + over.rect.height / 2 : false;
        index = overIndex + (below ? 1 : 0);
      }
      return applyMove(current, id, toStatus, index);
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const snapshot = beforeDrag.current ?? tasks;
    beforeDrag.current = null;
    setActiveId(null);

    let next = tasks;
    const moving = tasks.find((t) => t.id === id);
    const overTask = over ? tasks.find((t) => t.id === String(over.id)) : null;
    if (moving && overTask && overTask.id !== id && overTask.status === moving.status) {
      const index = sortColumn(tasks, moving.status).findIndex((t) => t.id === overTask.id);
      next = applyMove(tasks, id, moving.status, index);
    }

    const from = placementOf(snapshot, id);
    const to = placementOf(next, id);
    if (!from || !to || (from.status === to.status && from.index === to.index)) {
      setTasks(snapshot);
      return;
    }
    setTasks(next); // optimistic
    void mutate(
      () => moveTaskAction({ id, status: to.status, index: to.index }),
      () => setTasks(snapshot),
    );
  }

  function onDragCancel() {
    if (beforeDrag.current) setTasks(beforeDrag.current);
    beforeDrag.current = null;
    setActiveId(null);
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
        Press N anywhere to add a task, then drag it between columns as work moves along.
      </EmptyState>
    );
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      id="pm-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:snap-none lg:items-stretch">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={sortColumn(tasks, status)}
            today={today}
            taskHref={taskHref}
            onAdd={() => openQuickAdd(status)}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCardBody task={activeTask} today={today} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

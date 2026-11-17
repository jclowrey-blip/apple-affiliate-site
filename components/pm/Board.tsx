"use client";

// Kanban board: one column per status, drag and drop within and between
// columns. Moves are applied locally first and rolled back if saving fails.
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import { moveTaskAction } from "@/lib/pm/actions";
import { columnOf, moveItem } from "@/lib/pm/reorder";
import { TASK_STATUSES, TASK_STATUS_LABELS, type DateString, type Task, type TaskStatus } from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { STATUS_DOT, btnPrimary } from "./styles";
import TaskCard from "./TaskCard";
import { EmptyState, Kbd } from "./ui";
import { useOptimisticState } from "./useOptimisticState";

function isStatus(id: unknown): id is TaskStatus {
  return (TASK_STATUSES as readonly unknown[]).includes(id);
}

function SortableCard({ task, today }: { task: Task; today: DateString }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`cursor-grab touch-manipulation rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isDragging ? "opacity-40" : ""
      }`}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
    >
      <TaskCard task={task} today={today} />
    </li>
  );
}

function Column({ status, tasks, today }: { status: TaskStatus; tasks: Task[]; today: DateString }) {
  const { openQuickAdd } = usePm();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      aria-label={TASK_STATUS_LABELS[status]}
      className="flex w-[80vw] max-w-xs shrink-0 snap-start flex-col rounded-lg bg-line/40 p-2 md:w-auto md:max-w-none md:shrink"
    >
      <header className="flex items-center justify-between px-1 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
          {TASK_STATUS_LABELS[status]}
          <span className="font-normal text-graphite">{tasks.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => openQuickAdd({ status })}
          className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-graphite hover:bg-line hover:text-ink"
          aria-label={`Add task to ${TASK_STATUS_LABELS[status]}`}
        >
          +
        </button>
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`flex min-h-[5rem] flex-1 flex-col gap-2 rounded-md transition-colors ${
            isOver && tasks.length === 0 ? "bg-accent/10" : ""
          }`}
        >
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} today={today} />
          ))}
          {tasks.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line px-2 py-6 text-xs text-graphite">
              No tasks
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export default function Board({ tasks: serverTasks, today }: { tasks: Task[]; today: DateString }) {
  const { openQuickAdd } = usePm();
  const { value: tasks, setValue: setTasks, commit } = useOptimisticState(serverTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef<Task[]>(serverTasks);

  const sensors = useSensors(
    // A small movement threshold keeps plain clicks opening the task panel.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold to drag on touch screens, so swiping still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const statusOf = (id: string | number): TaskStatus | undefined =>
    isStatus(id) ? id : tasks.find((t) => t.id === id)?.status;

  function onDragStart({ active }: DragStartEvent) {
    snapshot.current = tasks;
    setActiveId(String(active.id));
  }

  // While dragging over another column, move the card there right away so the
  // column makes room for it.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = statusOf(active.id);
    const to = statusOf(over.id);
    if (!from || !to || from === to) return;
    const overIndex = isStatus(over.id)
      ? Number.MAX_SAFE_INTEGER
      : columnOf(tasks, to).findIndex((t) => t.id === over.id);
    setTasks(moveItem(tasks, String(active.id), to, overIndex));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    setActiveId(null);

    let next = tasks;
    if (over && !isStatus(over.id) && over.id !== active.id) {
      const status = statusOf(id);
      if (status && status === statusOf(over.id)) {
        const overIndex = columnOf(tasks, status).findIndex((t) => t.id === over.id);
        next = moveItem(tasks, id, status, overIndex);
        setTasks(next);
      }
    }

    const before = snapshot.current.find((t) => t.id === id);
    const after = next.find((t) => t.id === id);
    if (!before || !after || (before.status === after.status && before.order === after.order)) return;
    void commit(snapshot.current, () => moveTaskAction({ id, status: after.status, index: after.order }));
  }

  function onDragCancel() {
    setActiveId(null);
    setTasks(snapshot.current);
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

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : undefined;

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
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-4 md:overflow-visible md:px-0">
        {TASK_STATUSES.map((status) => (
          <Column key={status} status={status} tasks={columnOf(tasks, status)} today={today} />
        ))}
      </div>
      <DragOverlay>{activeTask && <TaskCard task={activeTask} today={today} overlay />}</DragOverlay>
    </DndContext>
  );
}

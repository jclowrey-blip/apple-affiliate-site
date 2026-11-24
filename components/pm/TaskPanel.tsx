"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createSubtaskAction,
  deleteSubtaskAction,
  deleteTaskAction,
  updateSubtaskAction,
  updateTaskAction,
} from "@/lib/pm/actions";
import { formatDate } from "@/lib/pm/dates";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_STATUSES,
  type Milestone,
  type Priority,
  type Subtask,
  type Task,
  type TaskStatus,
  type TaskWithProject,
} from "@/lib/pm/types";
import ConfirmButton from "./ConfirmButton";
import EmptyState from "./EmptyState";
import { useSyncedState, useTaskHref } from "./hooks";
import Markdown from "./Markdown";
import { useMutation, useToast } from "./Toast";
import { btnGhost, btnPrimary, btnSecondary, inputCls, labelCls, selectCls } from "./ui";

type TaskPatch = Partial<Pick<Task, "title" | "description" | "status" | "priority" | "dueDate" | "milestoneId" | "labels">>;

/** Grows a textarea to fit its content so long titles wrap instead of clipping. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}

function useClosePanel() {
  const router = useRouter();
  const taskHref = useTaskHref();
  return () => router.push(taskHref(null), { scroll: false });
}

/** The sliding container: backdrop, Escape to close, full width on phones. */
function PanelFrame({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // A dialog stacked above the panel (search, quick-add) handles its own Escape.
      if (e.key === "Escape" && !document.querySelector("[data-pm-dialog]")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-paper shadow-2xl outline-none sm:max-w-lg"
      >
        {children}
      </aside>
    </div>
  );
}

export function MissingTaskPanel() {
  const close = useClosePanel();
  return (
    <PanelFrame label="Task not found" onClose={close}>
      <div className="p-5">
        <EmptyState
          title="Task not found"
          action={
            <button type="button" className={btnSecondary} onClick={close}>
              Close
            </button>
          }
        >
          It may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    </PanelFrame>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TaskPanel({
  task: serverTask,
  milestones,
  labelOptions,
  today,
}: {
  task: TaskWithProject;
  milestones: Milestone[];
  labelOptions: string[];
  today: string;
}) {
  const [task, setTask] = useSyncedState(serverTask);
  const [editingDescription, setEditingDescription] = useState(false);
  const [draft, setDraft] = useState(task.description);
  const [newLabel, setNewLabel] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const mutate = useMutation();
  const toast = useToast();
  const close = useClosePanel();

  // Optimistic field save: show the change now, roll back if the server rejects it.
  function save(patch: TaskPatch) {
    const previous = task;
    setTask({ ...task, ...patch });
    return mutate(
      () => updateTaskAction({ id: task.id, ...patch }),
      () => setTask(previous),
    );
  }

  function patchSubtasks(next: Subtask[], action: Parameters<typeof mutate>[0]) {
    const previous = task;
    setTask({ ...task, subtasks: next });
    return mutate(action, () => setTask(previous));
  }

  function addLabel() {
    const name = newLabel.trim().replace(/,$/, "").trim();
    setNewLabel("");
    if (!name || task.labels.includes(name)) return;
    void save({ labels: [...task.labels, name].sort() });
  }

  async function addSubtask() {
    const title = newSubtask.trim();
    if (!title || addingSubtask) return;
    setAddingSubtask(true);
    const result = await mutate(() => createSubtaskAction({ taskId: task.id, title }));
    setAddingSubtask(false);
    if (result.ok) setNewSubtask("");
  }

  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const overdue = task.dueDate !== null && task.dueDate < today && task.status !== "done";

  return (
    <PanelFrame label={`Task: ${task.title}`} onClose={close}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-graphite">{task.project.name}</span>
        <button
          type="button"
          className={btnGhost}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied");
            } catch {
              toast.error("Could not copy. Copy the address from the browser instead.");
            }
          }}
        >
          Copy link
        </button>
        <button type="button" className={btnGhost} onClick={close} aria-label="Close task">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        <textarea
          key={task.title}
          aria-label="Title"
          defaultValue={task.title}
          maxLength={200}
          rows={1}
          ref={autoGrow}
          onInput={(e) => autoGrow(e.currentTarget)}
          className="block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-xl text-ink hover:border-line focus:border-line focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const title = e.currentTarget.value.replace(/\s+/g, " ").trim();
            if (!title) e.currentTarget.value = task.title;
            else if (title !== task.title) void save({ title });
          }}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status" htmlFor="task-status">
            <select
              id="task-status"
              className={`${selectCls} w-full`}
              value={task.status}
              onChange={(e) => void save({ status: e.target.value as TaskStatus })}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="task-priority">
            <select
              id="task-priority"
              className={`${selectCls} w-full`}
              value={task.priority}
              onChange={(e) => void save({ priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={overdue ? "Due date (overdue)" : "Due date"} htmlFor="task-due">
            <div className="flex gap-1">
              <input
                id="task-due"
                type="date"
                className={`${selectCls} min-w-0 flex-1 ${overdue ? "!border-warn text-warn" : ""}`}
                value={task.dueDate ?? ""}
                onChange={(e) => void save({ dueDate: e.target.value || null })}
              />
              {task.dueDate && (
                <button type="button" className={btnGhost} onClick={() => void save({ dueDate: null })} aria-label="Clear due date">
                  ✕
                </button>
              )}
            </div>
          </Field>
          <Field label="Milestone" htmlFor="task-milestone">
            <select
              id="task-milestone"
              className={`${selectCls} w-full`}
              value={task.milestoneId ?? ""}
              onChange={(e) => void save({ milestoneId: e.target.value || null })}
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatDate(m.targetDate)})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <label htmlFor="task-new-label" className={labelCls}>
            Labels
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {task.labels.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded border border-line bg-white py-0.5 pl-2 pr-1 text-xs text-ink">
                {name}
                <button
                  type="button"
                  aria-label={`Remove label ${name}`}
                  className="flex h-5 w-5 items-center justify-center rounded text-graphite hover:bg-line hover:text-ink"
                  onClick={() => void save({ labels: task.labels.filter((l) => l !== name) })}
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              id="task-new-label"
              list="task-label-options"
              className={`${inputCls} !w-32 !py-1`}
              placeholder="Add label"
              value={newLabel}
              maxLength={40}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addLabel();
                }
              }}
              onBlur={addLabel}
            />
            <datalist id="task-label-options">
              {labelOptions
                .filter((l) => !task.labels.includes(l))
                .map((l) => (
                  <option key={l} value={l} />
                ))}
            </datalist>
          </div>
        </div>

        <section aria-labelledby="task-description-heading">
          <div className="mb-1 flex items-center justify-between">
            <h3 id="task-description-heading" className={`${labelCls} !mb-0`}>
              Description
            </h3>
            {!editingDescription && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setDraft(task.description);
                  setEditingDescription(true);
                }}
              >
                {task.description ? "Edit" : "Add description"}
              </button>
            )}
          </div>
          {editingDescription ? (
            <div className="space-y-2">
              <textarea
                aria-label="Description (markdown)"
                className={`${inputCls} font-mono !text-sm`}
                rows={8}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    setEditingDescription(false);
                    if (draft !== task.description) void save({ description: draft });
                  }
                }}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    setEditingDescription(false);
                    if (draft !== task.description) void save({ description: draft });
                  }}
                >
                  Save
                </button>
                <button type="button" className={btnSecondary} onClick={() => setEditingDescription(false)}>
                  Cancel
                </button>
                <span className="ml-auto text-xs text-graphite">Markdown supported</span>
              </div>
            </div>
          ) : task.description ? (
            <div className="rounded-md border border-line bg-white p-3">
              <Markdown>{task.description}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-graphite">No description.</p>
          )}
        </section>

        <section aria-labelledby="task-subtasks-heading">
          <h3 id="task-subtasks-heading" className={labelCls}>
            Subtasks{" "}
            {task.subtasks.length > 0 && (
              <span className="font-mono normal-case">
                {doneSubtasks}/{task.subtasks.length}
              </span>
            )}
          </h3>
          {task.subtasks.length === 0 ? (
            <p className="mb-2 text-sm text-graphite">No subtasks yet.</p>
          ) : (
            <ul className="mb-2 divide-y divide-line rounded-md border border-line bg-white">
              {task.subtasks.map((subtask) => (
                <li key={subtask.id} className="flex items-center gap-2 px-2 py-1">
                  <input
                    type="checkbox"
                    aria-label={`${subtask.title} done`}
                    className="h-4 w-4 shrink-0 accent-accent"
                    checked={subtask.done}
                    onChange={(e) => {
                      const done = e.target.checked;
                      void patchSubtasks(
                        task.subtasks.map((s) => (s.id === subtask.id ? { ...s, done } : s)),
                        () => updateSubtaskAction({ id: subtask.id, done }),
                      );
                    }}
                  />
                  <input
                    key={subtask.title}
                    aria-label="Subtask title"
                    defaultValue={subtask.title}
                    maxLength={200}
                    className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-base focus:border-line focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm ${
                      subtask.done ? "text-graphite line-through" : "text-ink"
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                      const title = e.currentTarget.value.trim();
                      if (!title) e.currentTarget.value = subtask.title;
                      else if (title !== subtask.title) {
                        void patchSubtasks(
                          task.subtasks.map((s) => (s.id === subtask.id ? { ...s, title } : s)),
                          () => updateSubtaskAction({ id: subtask.id, title }),
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Delete subtask ${subtask.title}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-graphite hover:bg-line hover:text-ink"
                    onClick={() =>
                      void patchSubtasks(
                        task.subtasks.filter((s) => s.id !== subtask.id),
                        () => deleteSubtaskAction({ id: subtask.id }),
                      )
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addSubtask();
            }}
          >
            <input
              aria-label="New subtask"
              className={inputCls}
              placeholder="Add a subtask"
              value={newSubtask}
              maxLength={200}
              onChange={(e) => setNewSubtask(e.target.value)}
            />
            <button type="submit" className={btnSecondary} disabled={!newSubtask.trim() || addingSubtask}>
              Add
            </button>
          </form>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
        <span className="text-xs text-graphite">
          Created {formatDate(task.createdAt.slice(0, 10), { year: true })}
        </span>
        <ConfirmButton
          label="Delete task"
          question="Delete this task?"
          className={`${btnGhost} !text-warn`}
          onConfirm={async () => {
            const result = await mutate(() => deleteTaskAction({ id: task.id }));
            if (result.ok) {
              toast.success("Task deleted");
              close();
            }
          }}
        />
      </footer>
    </PanelFrame>
  );
}

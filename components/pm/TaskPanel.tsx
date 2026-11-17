"use client";

// Task detail side panel. Opens over any view when the URL has ?task=<id>.
// Every field saves on its own; status and subtask toggles update instantly
// and roll back if the save fails.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  createSubtaskAction,
  deleteSubtaskAction,
  deleteTaskAction,
  updateSubtaskAction,
  updateTaskAction,
} from "@/lib/pm/actions";
import type { UpdateTaskInput } from "@/lib/pm/schemas";
import { formatDate } from "@/lib/pm/dates";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type DateString,
  type Milestone,
  type Priority,
  type Subtask,
  type TaskStatus,
  type TaskWithProject,
} from "@/lib/pm/types";
import Markdown from "./Markdown";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass, selectClass } from "./styles";
import { DueDate } from "./ui";
import { useOptimisticState } from "./useOptimisticState";

/** Local editable copy of a server value that follows the server when it changes. */
function useDraft<T>(serverValue: T): [T, (next: T) => void] {
  const [draft, setDraft] = useState(serverValue);
  useEffect(() => setDraft(serverValue), [serverValue]);
  return [draft, setDraft];
}

function useClosePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
}

function PanelFrame({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      // Dialogs stacked above the panel (quick add, search) handle Escape themselves.
      if (e.key === "Escape" && !document.querySelector("[data-pm-modal]")) closeRef.current();
    };
    document.addEventListener("keydown", onKey as EventListener);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey as EventListener);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div data-pm-overlay className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto border-l border-line bg-paper shadow-xl focus:outline-none sm:max-w-md lg:max-w-lg"
      >
        {children}
      </aside>
    </div>
  );
}

export function TaskPanelMissing() {
  const close = useClosePanel();
  return (
    <PanelFrame label="Task not found" onClose={close}>
      <div className="p-6 text-center">
        <p className="font-display text-base text-ink">Task not found</p>
        <p className="mt-1 text-sm text-graphite">It may have been deleted, or the link is wrong.</p>
        <button type="button" className={`${btnSecondary} mt-4`} onClick={close}>
          Close
        </button>
      </div>
    </PanelFrame>
  );
}

export default function TaskPanel({
  task,
  milestones,
  today,
}: {
  task: TaskWithProject;
  milestones: Milestone[];
  today: DateString;
}) {
  const { showError } = usePm();
  const close = useClosePanel();

  const [title, setTitle] = useDraft(task.title);
  const [status, setStatus] = useDraft<TaskStatus>(task.status);
  const [priority, setPriority] = useDraft<Priority>(task.priority);
  const [dueDate, setDueDate] = useDraft(task.dueDate);
  const [milestoneId, setMilestoneId] = useDraft(task.milestoneId);
  const [labels, setLabels] = useDraft(task.labels);
  const [labelInput, setLabelInput] = useState("");
  const [description, setDescription] = useDraft(task.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Saves a field. `revert` puts the control back if the save fails. */
  async function save(patch: Omit<UpdateTaskInput, "id">, revert: () => void) {
    const result = await runAction(() => updateTaskAction({ id: task.id, ...patch }));
    if (!result.ok) {
      revert();
      showError(result.error);
    }
    return result.ok;
  }

  function commitTitle() {
    const next = title.trim();
    if (!next) return setTitle(task.title);
    if (next !== task.title) void save({ title: next }, () => setTitle(task.title));
  }

  function changeLabels(next: string[]) {
    setLabels(next);
    void save({ labels: next }, () => setLabels(task.labels));
  }

  function addLabel() {
    const name = labelInput.trim().toLowerCase().replace(/,/g, "");
    setLabelInput("");
    if (name && !labels.includes(name)) changeLabels([...labels, name]);
  }

  async function saveDescription() {
    if (description === task.description) return setEditingDescription(false);
    if (await save({ description }, () => {})) setEditingDescription(false);
  }

  async function remove() {
    setDeleting(true);
    const result = await runAction(() => deleteTaskAction({ id: task.id }));
    if (!result.ok) {
      setDeleting(false);
      setConfirmDelete(false);
      return showError(result.error);
    }
    close();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Couldn't copy the link. Copy it from the address bar instead.");
    }
  }

  return (
    <PanelFrame label={`Task: ${task.title}`} onClose={close}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <Link
          href={`/pm/${task.project.slug}/board`}
          className="flex min-w-0 items-center gap-1.5 text-xs text-graphite hover:text-ink"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden />
          <span className="truncate">{task.project.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className={btnGhost} onClick={copyLink}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button type="button" className={btnGhost} onClick={close} aria-label="Close task">
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-4">
        <div>
          <label className="sr-only" htmlFor="pm-task-title">
            Title
          </label>
          <input
            id="pm-task-title"
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-lg text-ink hover:border-line focus:border-line focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <div>
            <label className={labelClass} htmlFor="pm-task-status">
              Status
            </label>
            <select
              id="pm-task-status"
              className={`${selectClass} w-full py-2`}
              value={status}
              onChange={(e) => {
                const next = e.target.value as TaskStatus;
                setStatus(next);
                void save({ status: next }, () => setStatus(task.status));
              }}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-task-priority">
              Priority
            </label>
            <select
              id="pm-task-priority"
              className={`${selectClass} w-full py-2`}
              value={priority}
              onChange={(e) => {
                const next = e.target.value as Priority;
                setPriority(next);
                void save({ priority: next }, () => setPriority(task.priority));
              }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-task-due">
              Due date
            </label>
            <input
              id="pm-task-due"
              type="date"
              className={fieldClass}
              value={dueDate ?? ""}
              onChange={(e) => {
                const next = e.target.value || null;
                setDueDate(next);
                void save({ dueDate: next }, () => setDueDate(task.dueDate));
              }}
            />
            {dueDate && status !== "done" && dueDate < today && (
              <p className="mt-1">
                <DueDate date={dueDate} today={today} />
              </p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-task-milestone">
              Milestone
            </label>
            <select
              id="pm-task-milestone"
              className={`${selectClass} w-full py-2`}
              value={milestoneId ?? ""}
              onChange={(e) => {
                const next = e.target.value || null;
                setMilestoneId(next);
                void save({ milestoneId: next }, () => setMilestoneId(task.milestoneId));
              }}
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {formatDate(m.targetDate)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="pm-task-label-input">
            Labels
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 rounded-full bg-line/60 py-0.5 pl-2.5 pr-1 text-xs text-graphite">
                {l}
                <button
                  type="button"
                  onClick={() => changeLabels(labels.filter((x) => x !== l))}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-line hover:text-ink"
                  aria-label={`Remove label ${l}`}
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              id="pm-task-label-input"
              className="min-w-[7rem] flex-1 rounded-md border border-line bg-white px-2 py-1 text-base text-ink placeholder:text-graphite/70 focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
              placeholder="Add a label"
              value={labelInput}
              maxLength={30}
              onChange={(e) => setLabelInput(e.target.value)}
              onBlur={addLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addLabel();
                }
              }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className={`${labelClass} mb-0`} htmlFor="pm-task-description">
              Description
            </label>
            {!editingDescription && (
              <button type="button" className={btnGhost} onClick={() => setEditingDescription(true)}>
                {task.description ? "Edit" : "Add"}
              </button>
            )}
          </div>
          {editingDescription ? (
            <div>
              <textarea
                id="pm-task-description"
                className={`${fieldClass} font-mono`}
                rows={8}
                autoFocus
                value={description}
                placeholder="Markdown is supported"
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveDescription();
                }}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setDescription(task.description);
                    setEditingDescription(false);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className={btnPrimary} onClick={saveDescription}>
                  Save description
                </button>
              </div>
            </div>
          ) : task.description ? (
            <div className="rounded-md border border-line bg-white p-3">
              <Markdown source={task.description} />
            </div>
          ) : (
            <p className="text-sm text-graphite">No description.</p>
          )}
        </div>

        <Subtasks taskId={task.id} subtasks={task.subtasks} />
      </div>

      <footer className="border-t border-line px-4 py-3">
        {confirmDelete ? (
          <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
            <p className="text-sm text-ink">Delete this task and its subtasks? This can&apos;t be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Keep task
              </button>
              <button type="button" className={btnDanger} onClick={remove} disabled={deleting}>
                Delete task
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-graphite">Created {formatDate(task.createdAt.slice(0, 10), { year: true })}</span>
            <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirmDelete(true)}>
              Delete task
            </button>
          </div>
        )}
      </footer>
    </PanelFrame>
  );
}

function Subtasks({ taskId, subtasks: serverSubtasks }: { taskId: string; subtasks: Subtask[] }) {
  const { showError } = usePm();
  const { value: subtasks, mutate } = useOptimisticState(serverSubtasks);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const done = subtasks.filter((s) => s.done).length;

  function toggle(subtask: Subtask) {
    void mutate(
      (list) => list.map((s) => (s.id === subtask.id ? { ...s, done: !s.done } : s)),
      () => updateSubtaskAction({ id: subtask.id, done: !subtask.done }),
    );
  }

  function remove(subtask: Subtask) {
    void mutate(
      (list) => list.filter((s) => s.id !== subtask.id),
      () => deleteSubtaskAction({ id: subtask.id }),
    );
  }

  async function add() {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    const result = await runAction(() => createSubtaskAction({ taskId, title }));
    setAdding(false);
    if (!result.ok) return showError(result.error);
    setNewTitle("");
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className={`${labelClass} mb-0`}>Subtasks</h3>
        {subtasks.length > 0 && (
          <span className="text-xs text-graphite">
            {done} of {subtasks.length} done
          </span>
        )}
      </div>
      {subtasks.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-md border border-line bg-white">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2">
              <input
                id={`pm-subtask-${s.id}`}
                type="checkbox"
                checked={s.done}
                onChange={() => toggle(s)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
              <label
                htmlFor={`pm-subtask-${s.id}`}
                className={`min-w-0 flex-1 cursor-pointer text-sm ${s.done ? "text-graphite line-through" : "text-ink"}`}
              >
                {s.title}
              </label>
              <button
                type="button"
                onClick={() => remove(s)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-graphite hover:bg-line hover:text-ink"
                aria-label={`Delete subtask ${s.title}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className={fieldClass}
        placeholder={subtasks.length ? "Add another subtask" : "Add a subtask and press Enter"}
        aria-label="New subtask"
        value={newTitle}
        maxLength={200}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          }
        }}
      />
    </div>
  );
}

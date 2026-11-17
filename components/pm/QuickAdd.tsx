"use client";

import { useState, type FormEvent } from "react";
import { createTaskAction } from "@/lib/pm/actions";
import { TASK_STATUSES, TASK_STATUS_LABELS, type ProjectWithProgress, type TaskStatus } from "@/lib/pm/types";
import { runAction } from "./runAction";
import { btnPrimary, btnSecondary, fieldClass, selectClass } from "./styles";
import { Kbd, Modal } from "./ui";

/** Quick-add dialog: type a title, press Enter. Opened with "n" from any view. */
export default function QuickAdd({
  projects,
  defaultProjectId,
  defaultStatus,
  onClose,
}: {
  projects: ProjectWithProgress[];
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus ?? "backlog");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await runAction(() => createTaskAction({ projectId, title, status }));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
  }

  if (projects.length === 0) {
    return (
      <Modal title="New task" onClose={onClose} position="top">
        <div className="p-5 text-center">
          <p className="font-display text-base text-ink">Create a project first</p>
          <p className="mt-1 text-sm text-graphite">Tasks live inside projects. Add one from the dashboard.</p>
          <button type="button" className={`${btnSecondary} mt-4`} onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New task" onClose={onClose} position="top">
      <form onSubmit={submit} className="space-y-3 p-4">
        <input
          className={fieldClass}
          placeholder="What needs doing?"
          aria-label="Task title"
          value={title}
          maxLength={200}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Project"
            className={`${selectClass} min-w-0 max-w-full`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Status"
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <span className="ml-auto hidden items-center gap-1 text-xs text-graphite sm:flex">
            <Kbd>Enter</Kbd> to save
          </span>
          <button type="submit" className={`${btnPrimary} ml-auto sm:ml-0`} disabled={busy || !title.trim()}>
            Add task
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

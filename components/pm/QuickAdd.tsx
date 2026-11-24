"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { createTaskAction } from "@/lib/pm/actions";
import { STATUS_LABELS, TASK_STATUSES, type ProjectRef, type TaskStatus } from "@/lib/pm/types";
import Modal from "./Modal";
import { useMutation, useToast } from "./Toast";
import { btnPrimary, btnSecondary, inputCls, kbdCls, selectCls } from "./ui";

/** Quick-add dialog: type a title, press Enter. Defaults to the project being viewed. */
export default function QuickAdd({
  projects,
  initialStatus = "todo",
  onClose,
}: {
  projects: ProjectRef[];
  initialStatus?: TaskStatus;
  onClose: () => void;
}) {
  const params = useParams<{ project?: string }>();
  const current = projects.find((p) => p.slug === params.project) ?? projects[0];
  const mutate = useMutation();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(current?.id ?? "");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  if (projects.length === 0) {
    return (
      <Modal label="New task" onClose={onClose}>
        <div className="space-y-3 p-5">
          <p className="font-display text-base text-ink">Create a project first</p>
          <p className="text-sm text-graphite">Tasks live inside projects. Add one from the dashboard, then press N again.</p>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal label="New task" onClose={onClose}>
      <form
        className="space-y-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || busy) return;
          setBusy(true);
          const result = await mutate(() => createTaskAction({ projectId, title, status }));
          setBusy(false);
          if (result.ok) {
            toast.success("Task added");
            onClose();
          }
        }}
      >
        <input
          aria-label="Task title"
          className={`${inputCls} !text-base`}
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Project" className={`${selectCls} min-w-0 max-w-full`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <button type="submit" className={btnPrimary} disabled={busy || !title.trim()}>
            Add task <kbd className={`${kbdCls} !border-paper/40 !bg-transparent !text-paper`}>Enter</kbd>
          </button>
        </div>
      </form>
    </Modal>
  );
}

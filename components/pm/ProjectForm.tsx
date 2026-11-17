"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createProjectAction, deleteProjectAction, updateProjectAction } from "@/lib/pm/actions";
import {
  PROJECT_COLORS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/lib/pm/types";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass, selectClass } from "./styles";
import { Modal } from "./ui";

/** Create (no `project`) or edit a project in a dialog. */
export default function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState<string>(project?.color ?? PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fields = { name, description, color, status };
    const result = project
      ? await updateProjectAction({ id: project.id, ...fields })
      : await createProjectAction(fields);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (!project) router.push(`/pm/${result.data.slug}/board`);
    onClose();
  }

  async function remove() {
    if (!project) return;
    setBusy(true);
    // On success the action redirects to the dashboard and never returns here.
    const result = await deleteProjectAction({ id: project.id });
    setBusy(false);
    if (result && !result.ok) setError(result.error);
  }

  return (
    <Modal title={project ? "Edit project" : "New project"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <h2 className="font-display text-lg text-ink">{project ? "Edit project" : "New project"}</h2>
        <div>
          <label className={labelClass} htmlFor="pm-project-name">
            Name
          </label>
          <input
            id="pm-project-name"
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            maxLength={80}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-project-description">
            Description
          </label>
          <textarea
            id="pm-project-description"
            className={fieldClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <fieldset>
            <legend className={labelClass}>Color</legend>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="pm-project-color"
                    value={c}
                    checked={color === c}
                    onChange={() => setColor(c)}
                    className="peer sr-only"
                  />
                  <span
                    className="block h-7 w-7 rounded-full ring-offset-2 ring-offset-paper peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
                    style={{ backgroundColor: c }}
                  />
                  <span className="sr-only">{c}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className={labelClass} htmlFor="pm-project-status">
              Status
            </label>
            <select
              id="pm-project-status"
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}

        {confirmDelete ? (
          <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
            <p className="text-sm text-ink">
              Delete <strong>{project?.name}</strong> and all of its tasks and milestones? This can&apos;t be undone.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(false)}>
                Keep project
              </button>
              <button type="button" className={btnDanger} onClick={remove} disabled={busy}>
                Delete project
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {project ? (
              <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirmDelete(true)}>
                Delete project
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={busy || !name.trim()}>
                {project ? "Save" : "Create project"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

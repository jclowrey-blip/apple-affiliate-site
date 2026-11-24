"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProjectAction, updateProjectAction } from "@/lib/pm/actions";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from "@/lib/pm/types";
import ConfirmButton from "./ConfirmButton";
import Modal from "./Modal";
import { ColorPicker } from "./NewProjectForm";
import { useMutation, useToast } from "./Toast";
import { btnGhost, btnPrimary, btnSecondary, inputCls, labelCls, selectCls } from "./ui";

export default function ProjectSettings({ project }: { project: Project }) {
  const router = useRouter();
  const mutate = useMutation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [busy, setBusy] = useState(false);

  function show() {
    setName(project.name);
    setDescription(project.description);
    setColor(project.color);
    setStatus(project.status);
    setOpen(true);
  }

  return (
    <>
      <button type="button" className={btnGhost} onClick={show}>
        Edit project
      </button>
      {open && (
        <Modal label="Edit project" onClose={() => setOpen(false)} align="center">
          <form
            className="space-y-4 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const result = await mutate(() => updateProjectAction({ id: project.id, name, description, color, status }));
              setBusy(false);
              if (result.ok) {
                toast.success("Project saved");
                setOpen(false);
              }
            }}
          >
            <h2 className="font-display text-lg text-ink">Edit project</h2>
            <div>
              <label htmlFor="project-name" className={labelCls}>
                Name
              </label>
              <input id="project-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <div>
              <label htmlFor="project-description" className={labelCls}>
                Description
              </label>
              <textarea id="project-description" className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className={labelCls}>Color</span>
                <ColorPicker value={color} onChange={setColor} />
              </div>
              <div>
                <label htmlFor="project-status" className={labelCls}>
                  Status
                </label>
                <select id="project-status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={busy || !name.trim()}>
                Save
              </button>
              <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
            <div className="border-t border-line pt-4">
              <ConfirmButton
                label="Delete project…"
                question="Delete this project and all of its tasks?"
                className={`${btnGhost} !text-warn`}
                onConfirm={async () => {
                  const result = await mutate(() => deleteProjectAction({ id: project.id }));
                  if (result.ok) {
                    toast.success("Project deleted");
                    router.push("/pm");
                  }
                }}
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

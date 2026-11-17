"use client";

import { useState, type FormEvent } from "react";
import { createMilestoneAction, deleteMilestoneAction, updateMilestoneAction } from "@/lib/pm/actions";
import type { Milestone, Task } from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from "./styles";

function MilestoneRow({ milestone, taskCount }: { milestone: Milestone; taskCount: number }) {
  const { showError } = usePm();
  const [name, setName] = useState(milestone.name);
  const [targetDate, setTargetDate] = useState(milestone.targetDate);
  const [confirming, setConfirming] = useState(false);

  async function save(patch: { name?: string; targetDate?: string }) {
    const result = await runAction(() => updateMilestoneAction({ id: milestone.id, ...patch }));
    if (!result.ok) {
      setName(milestone.name);
      setTargetDate(milestone.targetDate);
      showError(result.error);
    }
  }

  async function remove() {
    const result = await runAction(() => deleteMilestoneAction({ id: milestone.id }));
    if (!result.ok) {
      setConfirming(false);
      showError(result.error);
    }
  }

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Milestone name"
          className={`${fieldClass} min-w-0 flex-1 basis-40`}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (!next) return setName(milestone.name);
            if (next !== milestone.name) void save({ name: next });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <input
          aria-label={`Target date for ${milestone.name}`}
          type="date"
          className={`${fieldClass} w-auto`}
          value={targetDate}
          onChange={(e) => {
            if (!e.target.value) return;
            setTargetDate(e.target.value);
            void save({ targetDate: e.target.value });
          }}
        />
        <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirming(true)}>
          Delete
        </button>
      </div>
      {confirming && (
        <div className="mt-2 rounded-md border border-warn/40 bg-warn/5 p-3">
          <p className="text-sm text-ink">
            Delete <strong>{milestone.name}</strong>?{" "}
            {taskCount > 0
              ? `Its ${taskCount} ${taskCount === 1 ? "task stays" : "tasks stay"} in the project without a milestone.`
              : "No tasks are assigned to it."}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>
              Keep milestone
            </button>
            <button type="button" className={btnDanger} onClick={remove}>
              Delete milestone
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Add, rename, reschedule and delete a project's milestones. */
export default function MilestoneManager({
  projectId,
  milestones,
  tasks,
}: {
  projectId: string;
  milestones: Milestone[];
  tasks: Task[];
}) {
  const { showError } = usePm();
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await runAction(() => createMilestoneAction({ projectId, name, targetDate }));
    setBusy(false);
    if (!result.ok) return showError(result.error);
    setName("");
    setTargetDate("");
  }

  return (
    <section aria-labelledby="pm-milestones-heading" className="mt-8">
      <h2 id="pm-milestones-heading" className="mb-2 font-display text-base text-ink">
        Milestones
      </h2>
      {milestones.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-lg border border-line bg-white">
          {milestones.map((m) => (
            <MilestoneRow
              key={`${m.id}:${m.name}:${m.targetDate}`}
              milestone={m}
              taskCount={tasks.filter((t) => t.milestoneId === m.id).length}
            />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-3">
        <div className="min-w-0 flex-1 basis-40">
          <label className={labelClass} htmlFor="pm-milestone-name">
            New milestone
          </label>
          <input
            id="pm-milestone-name"
            className={fieldClass}
            placeholder="Name"
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-milestone-date">
            Target date
          </label>
          <input
            id="pm-milestone-date"
            type="date"
            className={`${fieldClass} w-auto`}
            value={targetDate}
            required
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <button type="submit" className={btnPrimary} disabled={busy || !name.trim() || !targetDate}>
          Add milestone
        </button>
      </form>
    </section>
  );
}

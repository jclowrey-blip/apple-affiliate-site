"use client";

import { useState, type FormEvent } from "react";
import { createMilestoneAction, deleteMilestoneAction, updateMilestoneAction } from "@/lib/pm/actions";
import { diffDays, formatDate, todayString } from "@/lib/pm/dates";
import type { UpdateMilestoneInput } from "@/lib/pm/schemas";
import type { Milestone, Task, Workstream } from "@/lib/pm/types";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldAutoClass, fieldClass, labelClass, selectClass } from "./styles";

function MilestoneRow({
  milestone,
  taskCount,
  workstreams,
  others,
}: {
  milestone: Milestone;
  taskCount: number;
  workstreams: Workstream[];
  /** The project's other milestones, as candidates for "depends on". */
  others: Milestone[];
}) {
  const { showError } = usePm();
  const [name, setName] = useState(milestone.name);
  const [targetDate, setTargetDate] = useState(milestone.targetDate);
  const [confirming, setConfirming] = useState(false);
  const slip = diffDays(milestone.baselineDate, milestone.targetDate);
  const dependencies = others.filter((m) => milestone.dependsOnIds.includes(m.id));
  const candidates = others.filter((m) => !milestone.dependsOnIds.includes(m.id));

  // The row is re-keyed on every server change, so failed edits only need to
  // put the two free-text fields back.
  async function save(patch: Omit<UpdateMilestoneInput, "id">) {
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
          className={fieldAutoClass}
          value={targetDate}
          onChange={(e) => {
            if (!e.target.value) return;
            setTargetDate(e.target.value);
            void save({ targetDate: e.target.value });
          }}
        />
        {workstreams.length > 0 && (
          <select
            aria-label={`Workstream for ${milestone.name}`}
            className={`${selectClass} max-w-[11rem] py-2`}
            value={milestone.workstreamId ?? ""}
            onChange={(e) => void save({ workstreamId: e.target.value || null })}
          >
            <option value="">No workstream</option>
            {workstreams.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={Boolean(milestone.completedDate)}
            onChange={(e) => void save({ completedDate: e.target.checked ? todayString() : null })}
            aria-label={`${milestone.name} done`}
          />
          Done
        </label>
        <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirming(true)}>
          Delete
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-graphite">
        <span>
          Baseline {formatDate(milestone.baselineDate, { year: true })}
          {slip !== 0 && (
            <span className={slip > 0 ? "font-medium text-amber-800" : ""}>
              {" "}
              · target is {Math.abs(slip)} {Math.abs(slip) === 1 ? "day" : "days"} {slip > 0 ? "later" : "earlier"}
            </span>
          )}
        </span>
        {slip !== 0 && (
          <button
            type="button"
            className="underline hover:text-ink"
            onClick={() => void save({ baselineDate: milestone.targetDate })}
            title="Make the current target date the new baseline"
          >
            Re-baseline
          </button>
        )}
        {(dependencies.length > 0 || candidates.length > 0) && (
          <span className="flex flex-wrap items-center gap-1.5">
            Depends on:
            {dependencies.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-line/60 py-0.5 pl-2 pr-1 text-ink">
                {d.name}
                <button
                  type="button"
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-line"
                  aria-label={`Remove dependency on ${d.name}`}
                  onClick={() => void save({ dependsOnIds: milestone.dependsOnIds.filter((id) => id !== d.id) })}
                >
                  ✕
                </button>
              </span>
            ))}
            {candidates.length > 0 && (
              <select
                aria-label={`Add a dependency for ${milestone.name}`}
                className="max-w-[10rem] rounded border border-line bg-white px-1 py-0.5 text-xs text-graphite focus:outline-none focus:ring-2 focus:ring-accent"
                value=""
                onChange={(e) => {
                  if (e.target.value) void save({ dependsOnIds: [...milestone.dependsOnIds, e.target.value] });
                }}
              >
                <option value="">{dependencies.length ? "Add another…" : "Nothing yet. Add…"}</option>
                {candidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </span>
        )}
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

/** Add, rename, reschedule, complete, link and delete a project's milestones. */
export default function MilestoneManager({
  projectId,
  milestones,
  tasks,
  workstreams = [],
}: {
  projectId: string;
  milestones: Milestone[];
  tasks: Task[];
  workstreams?: Workstream[];
}) {
  const { showError } = usePm();
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [workstreamId, setWorkstreamId] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await runAction(() =>
      createMilestoneAction({ projectId, name, targetDate, workstreamId: workstreamId || null }),
    );
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
              key={JSON.stringify(m)}
              milestone={m}
              taskCount={tasks.filter((t) => t.milestoneId === m.id).length}
              workstreams={workstreams}
              others={milestones.filter((o) => o.id !== m.id)}
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
            className={fieldAutoClass}
            value={targetDate}
            required
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        {workstreams.length > 0 && (
          <div>
            <label className={labelClass} htmlFor="pm-milestone-ws">
              Workstream
            </label>
            <select id="pm-milestone-ws" className={`${selectClass} max-w-[11rem] py-2`} value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
              <option value="">None</option>
              {workstreams.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className={btnPrimary} disabled={busy || !name.trim() || !targetDate}>
          Add milestone
        </button>
      </form>
    </section>
  );
}

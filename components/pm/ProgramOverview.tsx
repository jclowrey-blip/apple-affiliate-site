"use client";

// Program view: overall status, then one card per workstream with its
// milestones (baseline vs. target, slippage, dependency conflicts), budget
// and open risks.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createWorkstreamAction, deleteWorkstreamAction, updateWorkstreamAction } from "@/lib/pm/actions";
import { formatDate } from "@/lib/pm/dates";
import { riskSeverity, type MilestoneStatus, type ProgramSnapshot, type WorkstreamSnapshot } from "@/lib/pm/health";
import { formatMoney, formatMoneyFull } from "@/lib/pm/money";
import { HealthBadge, OverallBadge } from "./badges";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass } from "./styles";
import { EmptyState } from "./ui";

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className={labelClass}>{label}</p>
      {children}
    </div>
  );
}

function MilestoneRow({ m }: { m: MilestoneStatus }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="min-w-0 flex-1 text-sm text-ink">{m.name}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-graphite">
        {m.completedDate ? (
          <span>Completed {formatDate(m.completedDate, { year: true })}</span>
        ) : (
          <>
            <span>Target {formatDate(m.targetDate, { year: true })}</span>
            {m.slipDays !== 0 && (
              <span className={m.slipDays > 0 ? "font-medium text-amber-800" : ""}>
                {Math.abs(m.slipDays)}d {m.slipDays > 0 ? "later" : "earlier"} than baseline {formatDate(m.baselineDate)}
              </span>
            )}
            {m.blockedBy.length > 0 && (
              <span className="font-medium text-warn">
                Waiting on {m.blockedBy.map((b) => `${b.name} (${formatDate(b.targetDate)})`).join(", ")}
              </span>
            )}
          </>
        )}
        <HealthBadge health={m.health} />
      </span>
    </li>
  );
}

function WorkstreamCard({ group, slug }: { group: WorkstreamSnapshot; slug: string }) {
  const { showError } = usePm();
  const ws = group.workstream;
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(ws?.name ?? "");
  const [owner, setOwner] = useState(ws?.owner ?? "");
  const [description, setDescription] = useState(ws?.description ?? "");
  const openRisks = group.risks.filter((r) => r.status !== "closed");
  const highRisks = openRisks.filter((r) => riskSeverity(r) === "high").length;
  const t = group.totals;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!ws) return;
    const result = await runAction(() => updateWorkstreamAction({ id: ws.id, name, owner, description }));
    if (!result.ok) return showError(result.error);
    setEditing(false);
  }

  async function remove() {
    if (!ws) return;
    const result = await runAction(() => deleteWorkstreamAction({ id: ws.id }));
    if (!result.ok) {
      setConfirming(false);
      showError(result.error);
    }
  }

  return (
    <li className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line bg-paper px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-base text-ink">{ws ? ws.name : "Not in a workstream"}</h3>
          <p className="text-xs text-graphite">
            {ws ? (ws.owner ? `Owner: ${ws.owner}` : "No owner set") : "Milestones and risks not assigned to a workstream"}
            {ws?.description ? ` · ${ws.description}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-graphite">
          {ws && t.budget + t.forecast > 0 && (
            <Link href={`/pm/${slug}/budget`} className="hover:text-ink" title={`Budget ${formatMoneyFull(t.budget)}, forecast ${formatMoneyFull(t.forecast)}`}>
              {formatMoney(t.forecast)} forecast of {formatMoney(t.budget)}
              {t.variance < 0 && <span className="ml-1 font-medium text-warn">({formatMoney(-t.variance)} over)</span>}
            </Link>
          )}
          <Link href={`/pm/${slug}/risks`} className={highRisks ? "font-medium text-warn" : "hover:text-ink"}>
            {openRisks.length} open {openRisks.length === 1 ? "risk" : "risks"}
            {highRisks ? `, ${highRisks} high` : ""}
          </Link>
          {ws && !editing && (
            <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      {editing && ws && (
        <form onSubmit={save} className="space-y-3 border-b border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`ws-name-${ws.id}`}>
                Name
              </label>
              <input id={`ws-name-${ws.id}`} className={fieldClass} value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`ws-owner-${ws.id}`}>
                Owner
              </label>
              <input id={`ws-owner-${ws.id}`} className={fieldClass} value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor={`ws-desc-${ws.id}`}>
              Description
            </label>
            <input id={`ws-desc-${ws.id}`} className={fieldClass} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {confirming ? (
            <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
              <p className="text-sm text-ink">
                Delete <strong>{ws.name}</strong>? Its {group.budgetLines.length} budget {group.budgetLines.length === 1 ? "line is" : "lines are"} deleted
                too. Its milestones and risks are kept, without a workstream.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>
                  Keep workstream
                </button>
                <button type="button" className={btnDanger} onClick={remove}>
                  Delete workstream
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirming(true)}>
                Delete workstream
              </button>
              <div className="flex gap-2">
                <button type="button" className={btnSecondary} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className={btnPrimary} disabled={!name.trim()}>
                  Save
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {group.milestones.length > 0 ? (
        <ul className="divide-y divide-line/70">
          {group.milestones.map((m) => (
            <MilestoneRow key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-graphite">No milestones yet. Add one below and assign it to this workstream.</p>
      )}
    </li>
  );
}

export default function ProgramOverview({ snapshot }: { snapshot: ProgramSnapshot }) {
  const { showError } = usePm();
  const { project, schedule, budget, risks, overall } = snapshot;
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const cap = budget.approved || budget.budget;
  const spentPct = cap > 0 ? Math.min(100, Math.round((budget.spent / cap) * 100)) : 0;

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await runAction(() => createWorkstreamAction({ projectId: project.id, name, owner }));
    setBusy(false);
    if (!result.ok) return showError(result.error);
    setName("");
    setOwner("");
  }

  const addForm = (
    <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-3">
      <div className="min-w-0 flex-1 basis-40">
        <label className={labelClass} htmlFor="pm-ws-name">
          New workstream
        </label>
        <input id="pm-ws-name" className={fieldClass} placeholder="Name" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="min-w-0 flex-1 basis-32">
        <label className={labelClass} htmlFor="pm-ws-owner">
          Owner (optional)
        </label>
        <input id="pm-ws-owner" className={fieldClass} value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <button type="submit" className={btnPrimary} disabled={busy || !name.trim()}>
        Add workstream
      </button>
    </form>
  );

  // Milestones or risks without a workstream form an "unassigned" group; that alone is not a program yet.
  if (snapshot.workstreams.every((group) => !group.workstream)) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No workstreams yet"
          body="Workstreams split a large program into its major strands, each with its own milestones, budget and risks. Add the first one below."
        />
        {addForm}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Overall">
          <OverallBadge status={overall.status} />
          <ul className="mt-2 space-y-0.5 text-xs text-graphite">
            {overall.reasons.length === 0 && <li>Nothing late, over forecast or high severity.</li>}
            {overall.reasons.map((r) => (
              <li key={r}>{r[0].toUpperCase() + r.slice(1)}</li>
            ))}
          </ul>
        </Tile>
        <Tile label="Schedule">
          <p className="font-display text-xl text-ink">
            {schedule.done}/{schedule.total} <span className="text-sm text-graphite">milestones done</span>
          </p>
          <p className="mt-1 text-xs text-graphite">
            {schedule.on_track} on track · {schedule.slipped} slipped · {schedule.conflict} conflict ·{" "}
            <span className={schedule.late ? "font-medium text-warn" : ""}>{schedule.late} late</span>
          </p>
        </Tile>
        <Tile label="Budget">
          {cap > 0 ? (
            <>
              <p className="font-display text-xl text-ink" title={formatMoneyFull(budget.forecast)}>
                {formatMoney(budget.forecast)} <span className="text-sm text-graphite">forecast of {formatMoney(cap)}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={spentPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${spentPct}% of budget spent`}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${spentPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-graphite">
                {formatMoney(budget.spent)} spent · {formatMoney(budget.committed)} committed
                {budget.forecast > cap && <span className="font-medium text-warn"> · {formatMoney(budget.forecast - cap)} over</span>}
              </p>
            </>
          ) : (
            <p className="text-sm text-graphite">
              No budget entered. Add lines on the{" "}
              <Link href={`/pm/${project.slug}/budget`} className="text-accent underline">
                Budget tab
              </Link>
              .
            </p>
          )}
        </Tile>
        <Tile label="Risks and issues">
          <p className="font-display text-xl text-ink">
            {risks.open} <span className="text-sm text-graphite">open</span>
          </p>
          <p className="mt-1 text-xs text-graphite">
            <span className={risks.high ? "font-medium text-warn" : ""}>{risks.high} high severity</span> ·{" "}
            <span className={risks.overdue ? "font-medium text-warn" : ""}>{risks.overdue} past due</span>
          </p>
        </Tile>
      </div>

      <section aria-labelledby="pm-workstreams-heading">
        <h2 id="pm-workstreams-heading" className="mb-2 font-display text-base text-ink">
          Workstreams
        </h2>
        <ul className="mb-3 space-y-3">
          {snapshot.workstreams.map((group) => (
            <WorkstreamCard key={`${group.workstream?.id ?? "none"}:${group.workstream?.name}:${group.workstream?.owner}:${group.workstream?.description}`} group={group} slug={project.slug} />
          ))}
        </ul>
        {addForm}
      </section>
    </div>
  );
}

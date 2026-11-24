"use client";

// Daily tab: the questions that need an answer today, with the controls to
// answer them in place, then one button to close the day (save the summary
// and draft the team's messages).
import Link from "next/link";
import { useState } from "react";
import { addNoteAction, finishDayAction, updateBudgetLineAction, updateMilestoneAction, updateRiskAction, updateWorkstreamAction } from "@/lib/pm/actions";
import type { DailyCheckin } from "@/lib/pm/daily";
import { formatDate } from "@/lib/pm/dates";
import { riskSeverity } from "@/lib/pm/health";
import { RISK_KIND_LABELS, RISK_STATUSES, RISK_STATUS_LABELS, type Activity, type DateString, type Project, type RiskStatus, type Workstream } from "@/lib/pm/types";
import { HealthBadge, SeverityBadge } from "./badges";
import MoneyInput from "./MoneyInput";
import { usePm } from "./PmContext";
import { RiskForm } from "./RiskRegister";
import { runAction } from "./runAction";
import { btnPrimary, btnSecondary, fieldAutoClass, fieldClass, labelClass, selectClass } from "./styles";
import { EmptyState } from "./ui";

function Section({ title, count, hint, children }: { title: string; count: number; hint: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border border-line bg-white">
      <header className="border-b border-line bg-paper px-4 py-2.5">
        <h2 className="font-display text-base text-ink">
          {title} <span className="text-graphite">({count})</span>
        </h2>
        <p className="text-xs text-graphite">{hint}</p>
      </header>
      {children}
    </section>
  );
}

export default function DailyCheckinView({
  project,
  today,
  checkin,
  activities,
  workstreams,
  memberCount,
  forecastFinish,
  finishSlipDays,
}: {
  project: Project;
  today: DateString;
  checkin: DailyCheckin;
  activities: Activity[];
  workstreams: Workstream[];
  memberCount: number;
  forecastFinish: DateString | null;
  finishSlipDays: number;
}) {
  const { showError, openAssistant } = usePm();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState<{ messageCount: number } | null>(null);
  const [riskForm, setRiskForm] = useState(false);
  const base = `/pm/${project.slug}`;

  /** Runs a save and reports a failure; the page re-renders from the server on success. */
  async function save(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    const result = await runAction(action as never);
    if (!result.ok) showError(result.error);
  }

  async function addNote() {
    if (!notes.trim()) return;
    const result = await runAction(() => addNoteAction({ projectId: project.id, text: notes }));
    if (!result.ok) return showError(result.error);
    setNotes("");
  }

  async function finish() {
    setBusy(true);
    const result = await runAction(() => finishDayAction({ projectId: project.id, notes }));
    setBusy(false);
    if (!result.ok) return showError(result.error);
    setNotes("");
    setFinished({ messageCount: result.data.messageCount });
  }

  if (checkin.count === 0 && activities.length === 0) {
    return (
      <EmptyState
        title="Nothing to check in on yet"
        body="The daily update asks about milestones, workstream progress, spend and open risks. Add workstreams and milestones on the Program tab and they will show up here."
        action={
          <Link href={`${base}/program`} className={btnPrimary}>
            Go to Program
          </Link>
        }
      />
    );
  }

  const changes = activities.filter((a) => a.kind === "change");
  const noted = activities.filter((a) => a.kind === "note");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink">Daily update, {formatDate(today, { year: true })}</h2>
          <p className="text-sm text-graphite">
            {checkin.count} {checkin.count === 1 ? "item" : "items"} to confirm. Change what moved, leave the rest, then finish the day.
            {forecastFinish && (
              <>
                {" "}
                Projected finish {formatDate(forecastFinish, { year: true })}
                {finishSlipDays !== 0 && (
                  <span className={finishSlipDays > 0 ? "font-medium text-warn" : ""}>
                    {" "}
                    ({Math.abs(finishSlipDays)} days {finishSlipDays > 0 ? "later" : "earlier"} than baseline)
                  </span>
                )}
                .
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className={`${btnSecondary} shrink-0`}
          onClick={() =>
            openAssistant(
              `Run today's check-in for ${project.name}. Ask me your questions a few at a time, update the tracker from my answers, then save the daily summary and draft the team's messages.`,
            )
          }
        >
          Do this with the assistant
        </button>
      </div>

      {checkin.milestones.length > 0 && (
        <Section title="Milestones" count={checkin.milestones.length} hint="Late, due within two weeks, or on the critical path. Set a new date or mark it done.">
          <ul className="divide-y divide-line/70">
            {checkin.milestones.map(({ milestone: m, workstream, reasons }) => (
              <li key={`${m.id}:${m.targetDate}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{m.name}</p>
                  <p className="text-xs text-graphite">
                    {workstream} · <span className={m.health === "late" ? "font-medium text-warn" : ""}>{reasons.join("; ")}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <HealthBadge health={m.health} />
                  <input
                    type="date"
                    aria-label={`New target date for ${m.name}`}
                    className={fieldAutoClass}
                    defaultValue={m.targetDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value && value !== m.targetDate) void save(() => updateMilestoneAction({ id: m.id, targetDate: value }));
                    }}
                  />
                  <button type="button" className={btnSecondary} onClick={() => void save(() => updateMilestoneAction({ id: m.id, completedDate: today }))}>
                    Done<span className="sr-only">: {m.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {checkin.workstreams.length > 0 && (
        <Section title="Progress" count={checkin.workstreams.length} hint="Percent of each workstream's work that is complete. This drives earned value.">
          <ul className="divide-y divide-line/70">
            {checkin.workstreams.map((ws) => (
              <li key={`${ws.id}:${ws.percentComplete}`} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{ws.name}</p>
                  {ws.owner && <p className="text-xs text-graphite">{ws.owner}</p>}
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-sm text-graphite">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={`Percent complete for ${ws.name}`}
                    className={`${fieldAutoClass} w-20 text-right`}
                    defaultValue={ws.percentComplete}
                    onBlur={(e) => {
                      const value = Math.round(Number(e.target.value));
                      if (e.target.value === "" || Number.isNaN(value)) return void (e.target.value = String(ws.percentComplete));
                      if (value !== ws.percentComplete) void save(() => updateWorkstreamAction({ id: ws.id, percentComplete: value }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  %
                </label>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {checkin.budgetLines.length > 0 && (
        <Section title="Spend" count={checkin.budgetLines.length} hint="Lines with money committed or spent, or forecast over budget. Type amounts like 250M.">
          <ul className="divide-y divide-line/70">
            {checkin.budgetLines.map(({ line, workstream }) => (
              <li key={line.id} className="px-4 py-3">
                <p className="text-sm text-ink">{line.name}</p>
                <p className="text-xs text-graphite">{workstream}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["spent", "committed", "forecast"] as const).map((key) => (
                    <div key={key}>
                      <span className={labelClass}>{key}</span>
                      <MoneyInput
                        value={line[key]}
                        label={`${key[0].toUpperCase()}${key.slice(1)} for ${line.name}`}
                        onCommit={(amount) => void save(() => updateBudgetLineAction({ id: line.id, [key]: amount }))}
                      />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Risks and issues" count={checkin.risks.length} hint="Open items that are high severity, overdue, or due this week.">
        <ul className="divide-y divide-line/70">
          {checkin.risks.map(({ risk, workstream, reasons }) => (
            <li key={risk.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{risk.title}</p>
                <p className="text-xs text-graphite">
                  {RISK_KIND_LABELS[risk.kind]} · {workstream}
                  {risk.owner ? ` · ${risk.owner}` : ""} · {reasons.join("; ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={riskSeverity(risk)} />
                <select
                  aria-label={`Status of ${risk.title}`}
                  className={selectClass}
                  value={risk.status}
                  onChange={(e) => void save(() => updateRiskAction({ id: risk.id, status: e.target.value as RiskStatus }))}
                >
                  {RISK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {RISK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-graphite">{checkin.risks.length === 0 ? "Nothing in the register needs attention today." : "Something new came up today?"}</span>
            <button type="button" className={btnSecondary} onClick={() => setRiskForm(true)}>
              Log a risk or issue
            </button>
          </li>
        </ul>
      </Section>

      <section aria-label="Today so far" className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-display text-base text-ink">
          Today so far <span className="text-graphite">({activities.length})</span>
        </h2>
        {activities.length === 0 ? (
          <p className="mt-1 text-sm text-graphite">No changes recorded yet today.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {changes.map((a) => (
              <li key={a.id}>✓ {a.summary}</li>
            ))}
            {noted.map((a) => (
              <li key={a.id} className="text-graphite">
                Note: {a.summary}
              </li>
            ))}
          </ul>
        )}

        <label className={`${labelClass} mt-4`} htmlFor="pm-daily-notes">
          Notes for today (decisions, blockers, anything the summary should carry)
        </label>
        <textarea id="pm-daily-notes" className={fieldClass} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={btnSecondary} onClick={addNote} disabled={!notes.trim()}>
            Save note
          </button>
          <button type="button" className={btnPrimary} onClick={finish} disabled={busy}>
            {busy ? "Finishing…" : "Finish today's update"}
          </button>
        </div>
        <p className="mt-2 text-xs text-graphite">
          Finishing saves the daily summary to Reports and drafts today&apos;s messages to the team. Nothing is sent to anyone.
        </p>

        {finished && (
          <div role="status" className="mt-3 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm text-ink">
            Daily summary saved.{" "}
            <Link href={`${base}/reports`} className="font-medium text-accentDark underline">
              Read it in Reports
            </Link>
            .{" "}
            {finished.messageCount > 0 ? (
              <>
                {finished.messageCount} {finished.messageCount === 1 ? "message" : "messages"} drafted.{" "}
                <Link href={`${base}/team`} className="font-medium text-accentDark underline">
                  Review them in Team
                </Link>
                .
              </>
            ) : memberCount === 0 ? (
              <>
                No messages were drafted because there are no team members yet.{" "}
                <Link href={`${base}/team`} className="font-medium text-accentDark underline">
                  Add them in Team
                </Link>
                .
              </>
            ) : null}
          </div>
        )}
      </section>

      {riskForm && <RiskForm projectId={project.id} workstreams={workstreams} onClose={() => setRiskForm(false)} />}
    </div>
  );
}

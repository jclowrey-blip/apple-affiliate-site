"use client";

// Status reports: generate one from the tracked data, or ask the assistant to
// draft one, then read, edit, copy or delete saved reports.
import { useState } from "react";
import { deleteReportAction, generateReportAction, updateReportAction } from "@/lib/pm/actions";
import { addDays, formatDate } from "@/lib/pm/dates";
import type { DateString, Project, StatusReport } from "@/lib/pm/types";
import Markdown from "./Markdown";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldAutoClass, fieldClass, labelClass } from "./styles";
import { EmptyState } from "./ui";

function ReportCard({ report, defaultOpen }: { report: StatusReport; defaultOpen: boolean }) {
  const { showError } = usePm();
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(report.body);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    const result = await runAction(() => updateReportAction({ id: report.id, body }));
    if (!result.ok) return showError(result.error);
    setEditing(false);
  }

  async function remove() {
    const result = await runAction(() => deleteReportAction({ id: report.id }));
    if (!result.ok) {
      setConfirming(false);
      showError(result.error);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(report.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Couldn't copy the report. Use Edit and copy the text from there.");
    }
  }

  return (
    <li className="overflow-hidden rounded-lg border border-line bg-white">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="min-w-0">
          <span className="block truncate text-sm text-ink">{report.title}</span>
          <span className="text-xs text-graphite">
            {formatDate(report.periodStart)} to {formatDate(report.periodEnd, { year: true })} ·{" "}
            {report.source === "assistant" ? "Drafted by the assistant" : "Generated from tracked data"}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-graphite">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-4">
          {editing ? (
            <>
              <textarea aria-label="Report markdown" className={`${fieldClass} font-mono`} rows={18} value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setBody(report.body);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className={btnPrimary} onClick={save}>
                  Save report
                </button>
              </div>
            </>
          ) : (
            <>
              <Markdown source={report.body} />
              {confirming ? (
                <div className="mt-4 rounded-md border border-warn/40 bg-warn/5 p-3">
                  <p className="text-sm text-ink">Delete this report? This can&apos;t be undone.</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>
                      Keep report
                    </button>
                    <button type="button" className={btnDanger} onClick={remove}>
                      Delete report
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap justify-end gap-1 border-t border-line pt-3">
                  <button type="button" className={btnGhost} onClick={copy}>
                    {copied ? "Copied" : "Copy markdown"}
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirming(true)}>
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function ReportsView({ project, reports, today }: { project: Project; reports: StatusReport[]; today: DateString }) {
  const { showError, openAssistant } = usePm();
  const [periodStart, setPeriodStart] = useState(addDays(today, -6));
  const [periodEnd, setPeriodEnd] = useState(today);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const result = await runAction(() => generateReportAction({ projectId: project.id, periodStart, periodEnd }));
    setBusy(false);
    if (!result.ok) showError(result.error);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-3">
        <div>
          <label className={labelClass} htmlFor="pm-report-start">
            Period from
          </label>
          <input id="pm-report-start" type="date" className={fieldAutoClass} value={periodStart} max={periodEnd} onChange={(e) => e.target.value && setPeriodStart(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-report-end">
            To
          </label>
          <input id="pm-report-end" type="date" className={fieldAutoClass} value={periodEnd} min={periodStart} onChange={(e) => e.target.value && setPeriodEnd(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setPeriodStart(addDays(today, -6));
              setPeriodEnd(today);
            }}
          >
            Last 7 days
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setPeriodStart(addDays(today, -29));
              setPeriodEnd(today);
            }}
          >
            Last 30 days
          </button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              openAssistant(
                `Draft a status report for ${project.name} covering ${periodStart} to ${periodEnd}. Lead with what changed and what needs a decision, keep every figure exactly as tracked, and save it to Reports.`,
              )
            }
          >
            Draft with assistant
          </button>
          <button type="button" className={btnPrimary} onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate report"}
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          body="Generate report builds one straight from the tracked schedule, budget, risks and tasks. Draft with assistant writes a narrative version from the same data."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r, i) => (
            <ReportCard key={`${r.id}:${r.body.length}`} report={r} defaultOpen={i === 0} />
          ))}
        </ul>
      )}
    </div>
  );
}

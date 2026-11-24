"use client";

// Risk and issue register: filterable table sorted by severity, inline status
// changes, and a dialog for the full record.
import { useMemo, useState, type FormEvent } from "react";
import { createRiskAction, deleteRiskAction, updateRiskAction } from "@/lib/pm/actions";
import { formatDate } from "@/lib/pm/dates";
import { isRiskOverdue, riskScore, riskSeverity } from "@/lib/pm/health";
import {
  LEVELS,
  LEVEL_LABELS,
  RISK_KINDS,
  RISK_KIND_LABELS,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
  type DateString,
  type Level,
  type Risk,
  type RiskKind,
  type RiskStatus,
  type Workstream,
} from "@/lib/pm/types";
import { SeverityBadge } from "./badges";
import { runAction } from "./runAction";
import { btnDanger, btnGhost, btnPrimary, btnSecondary, fieldClass, labelClass, selectClass } from "./styles";
import { EmptyState, Modal } from "./ui";
import { useOptimisticState } from "./useOptimisticState";

type StatusFilter = "active" | "all" | RiskStatus;

export function RiskForm({
  projectId,
  risk,
  workstreams,
  onClose,
}: {
  projectId: string;
  risk?: Risk;
  workstreams: Workstream[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(risk?.title ?? "");
  const [kind, setKind] = useState<RiskKind>(risk?.kind ?? "risk");
  const [likelihood, setLikelihood] = useState<Level>(risk?.likelihood ?? 2);
  const [impact, setImpact] = useState<Level>(risk?.impact ?? 2);
  const [status, setStatus] = useState<RiskStatus>(risk?.status ?? "open");
  const [owner, setOwner] = useState(risk?.owner ?? "");
  const [dueDate, setDueDate] = useState(risk?.dueDate ?? "");
  const [workstreamId, setWorkstreamId] = useState(risk?.workstreamId ?? "");
  const [description, setDescription] = useState(risk?.description ?? "");
  const [mitigation, setMitigation] = useState(risk?.mitigation ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const heading = risk ? `Edit ${RISK_KIND_LABELS[risk.kind].toLowerCase()}` : "New risk or issue";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fields = { title, kind, likelihood, impact, status, owner, dueDate: dueDate || null, workstreamId: workstreamId || null, description, mitigation };
    const result = await runAction(() => (risk ? updateRiskAction({ id: risk.id, ...fields }) : createRiskAction({ projectId, ...fields })));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
  }

  async function remove() {
    if (!risk) return;
    setBusy(true);
    const result = await runAction(() => deleteRiskAction({ id: risk.id }));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
  }

  const levelSelect = (id: string, value: Level, set: (l: Level) => void, disabled = false) => (
    <select id={id} className={`${selectClass} w-full py-2`} value={value} disabled={disabled} onChange={(e) => set(Number(e.target.value) as Level)}>
      {LEVELS.map((l) => (
        <option key={l} value={l}>
          {LEVEL_LABELS[l]}
        </option>
      ))}
    </select>
  );

  return (
    <Modal title={heading} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-ink">{heading}</h2>
          <SeverityBadge severity={riskSeverity({ kind, likelihood, impact })} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-risk-title">
            Title
          </label>
          <input id="pm-risk-title" className={fieldClass} value={title} maxLength={200} required autoFocus={!risk} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor="pm-risk-kind">
              Type
            </label>
            <select id="pm-risk-kind" className={`${selectClass} w-full py-2`} value={kind} onChange={(e) => setKind(e.target.value as RiskKind)}>
              {RISK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RISK_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-risk-likelihood">
              Likelihood
            </label>
            {levelSelect("pm-risk-likelihood", kind === "issue" ? 3 : likelihood, setLikelihood, kind === "issue")}
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-risk-impact">
              Impact
            </label>
            {levelSelect("pm-risk-impact", impact, setImpact)}
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-risk-status">
              Status
            </label>
            <select id="pm-risk-status" className={`${selectClass} w-full py-2`} value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)}>
              {RISK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RISK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {kind === "issue" && <p className="-mt-2 text-xs text-graphite">An issue has already happened, so its severity comes from impact alone.</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="pm-risk-owner">
              Owner
            </label>
            <input id="pm-risk-owner" className={fieldClass} value={owner} maxLength={80} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="pm-risk-due">
              Due date
            </label>
            <input id="pm-risk-due" type="date" className={fieldClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {workstreams.length > 0 && (
          <div>
            <label className={labelClass} htmlFor="pm-risk-ws">
              Workstream
            </label>
            <select id="pm-risk-ws" className={`${selectClass} w-full py-2`} value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
              <option value="">None</option>
              {workstreams.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="pm-risk-description">
            Description
          </label>
          <textarea id="pm-risk-description" className={fieldClass} rows={3} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pm-risk-mitigation">
            Mitigation or next action
          </label>
          <textarea id="pm-risk-mitigation" className={fieldClass} rows={3} value={mitigation} maxLength={5000} onChange={(e) => setMitigation(e.target.value)} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}

        {confirmDelete ? (
          <div className="rounded-md border border-warn/40 bg-warn/5 p-3">
            <p className="text-sm text-ink">Delete this entry from the register? This can&apos;t be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button type="button" className={btnDanger} onClick={remove} disabled={busy}>
                Delete entry
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {risk ? (
              <button type="button" className={`${btnGhost} text-warn hover:text-warn`} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={busy || !title.trim()}>
                {risk ? "Save" : "Add to register"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function RiskRegister({
  projectId,
  risks: serverRisks,
  workstreams,
  today,
}: {
  projectId: string;
  risks: Risk[];
  workstreams: Workstream[];
  today: DateString;
}) {
  const { value: risks, mutate } = useOptimisticState(serverRisks);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [kindFilter, setKindFilter] = useState<RiskKind | "all">("all");
  const [form, setForm] = useState<{ risk?: Risk } | null>(null);
  const wsName = (id: string | null) => workstreams.find((w) => w.id === id)?.name;

  const visible = useMemo(
    () =>
      risks
        .filter((r) => (statusFilter === "all" ? true : statusFilter === "active" ? r.status !== "closed" : r.status === statusFilter))
        .filter((r) => kindFilter === "all" || r.kind === kindFilter)
        .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || riskScore(b) - riskScore(a) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    [risks, statusFilter, kindFilter],
  );

  function changeStatus(risk: Risk, status: RiskStatus) {
    void mutate(
      (list) => list.map((r) => (r.id === risk.id ? { ...r, status } : r)),
      () => updateRiskAction({ id: risk.id, status }),
    );
  }

  const addButton = (
    <button type="button" className={btnPrimary} onClick={() => setForm({})}>
      Add risk or issue
    </button>
  );
  const dialog = form && <RiskForm projectId={projectId} risk={form.risk} workstreams={workstreams} onClose={() => setForm(null)} />;

  if (risks.length === 0) {
    return (
      <>
        <EmptyState
          title="Nothing in the register yet"
          body="Log risks (things that might happen) and issues (things that have), with an owner and a due date for each."
          action={addButton}
        />
        {dialog}
      </>
    );
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <select aria-label="Filter by status" className={`${selectClass} w-full sm:w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="active">Open and mitigating</option>
          <option value="all">All statuses</option>
          {RISK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RISK_STATUS_LABELS[s]} only
            </option>
          ))}
        </select>
        <select aria-label="Filter by type" className={`${selectClass} w-full sm:w-auto`} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as RiskKind | "all")}>
          <option value="all">Risks and issues</option>
          <option value="risk">Risks only</option>
          <option value="issue">Issues only</option>
        </select>
        <span className="text-xs text-graphite sm:ml-auto" aria-live="polite">
          {visible.length} of {risks.length}
        </span>
        <span className="flex justify-end">{addButton}</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches these filters"
          action={
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setStatusFilter("all");
                setKindFilter("all");
              }}
            >
              Show everything
            </button>
          }
        />
      ) : (
        <table className="block w-full text-sm sm:table sm:overflow-hidden sm:rounded-lg sm:border sm:border-line sm:bg-white">
          <thead className="hidden border-b border-line bg-paper text-xs text-graphite sm:table-header-group">
            <tr>
              {["Title", "Type", "Severity", "Owner", "Due", "Status"].map((h) => (
                <th key={h} scope="col" className={`px-3 py-2 text-left font-medium ${h === "Owner" ? "hidden md:table-cell" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block space-y-2 sm:table-row-group sm:space-y-0 sm:divide-y sm:divide-line">
            {visible.map((risk) => {
              const overdue = isRiskOverdue(risk, today);
              return (
                <tr key={risk.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-white p-3 sm:table-row sm:rounded-none sm:border-0 sm:p-0 ${risk.status === "closed" ? "opacity-60" : ""}`}>
                  <td className="block w-full sm:table-cell sm:w-auto sm:px-3 sm:py-2">
                    <button type="button" className="text-left text-ink hover:underline" onClick={() => setForm({ risk })}>
                      {risk.title}
                    </button>
                    {wsName(risk.workstreamId) && <span className="block text-xs text-graphite">{wsName(risk.workstreamId)}</span>}
                  </td>
                  <td className="block text-xs text-graphite sm:table-cell sm:px-3 sm:py-2">{RISK_KIND_LABELS[risk.kind]}</td>
                  <td className="block sm:table-cell sm:px-3 sm:py-2">
                    <SeverityBadge severity={riskSeverity(risk)} />
                  </td>
                  <td className="hidden text-xs text-graphite md:table-cell md:px-3 md:py-2">{risk.owner || "Unassigned"}</td>
                  <td className={`block whitespace-nowrap text-xs sm:table-cell sm:px-3 sm:py-2 ${overdue ? "font-medium text-warn" : "text-graphite"}`}>
                    {risk.dueDate ? `${overdue ? "Overdue · " : ""}${formatDate(risk.dueDate)}` : "No date"}
                  </td>
                  <td className="ml-auto block sm:ml-0 sm:table-cell sm:px-3 sm:py-2">
                    <select aria-label={`Status of ${risk.title}`} className={selectClass} value={risk.status} onChange={(e) => changeStatus(risk, e.target.value as RiskStatus)}>
                      {RISK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {RISK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {dialog}
    </div>
  );
}

// Schedule and cost performance for the Program tab: projected finish and
// critical path, then earned value by workstream. No client hooks.
import type { ScheduleAnalysis } from "@/lib/pm/critical-path";
import { formatDate } from "@/lib/pm/dates";
import { formatMoney, formatMoneyFull } from "@/lib/pm/money";
import { formatIndex, type EarnedValue, type Performance } from "@/lib/pm/performance";

const th = "px-3 py-2 text-right font-medium whitespace-nowrap";
const td = "px-3 py-2 text-right font-mono text-xs tabular-nums whitespace-nowrap";

function Index({ value }: { value: number | null }) {
  // Below 0.95 is flagged; anything from there up reads as on plan.
  return <span className={value !== null && value < 0.95 ? "font-medium text-warn" : "text-ink"}>{formatIndex(value)}</span>;
}

function Money({ value, signed }: { value: number | null; signed?: boolean }) {
  if (value === null) return <span className="text-graphite">n/a</span>;
  return (
    <span className={signed && value < 0 ? "font-medium text-warn" : "text-ink"} title={formatMoneyFull(value)}>
      {formatMoney(value)}
    </span>
  );
}

function EvRow({ row, total }: { row: EarnedValue; total?: boolean }) {
  return (
    <tr className={total ? "border-t border-line bg-paper font-medium" : ""}>
      <th scope="row" className="px-3 py-2 text-left text-sm font-normal text-ink">
        {row.name}
      </th>
      <td className={td}>{row.percentComplete}%</td>
      <td className={td}><Money value={row.bac} /></td>
      <td className={td}><Money value={row.pv} /></td>
      <td className={td}><Money value={row.ev} /></td>
      <td className={td}><Money value={row.ac} /></td>
      <td className={td}><Money value={row.cv} signed /></td>
      <td className={td}><Money value={row.sv} signed /></td>
      <td className={td}><Index value={row.cpi} /></td>
      <td className={td}><Index value={row.spi} /></td>
      <td className={td}><Money value={row.eac} /></td>
    </tr>
  );
}

export default function PerformancePanel({ analysis, performance }: { analysis: ScheduleAnalysis; performance: Performance }) {
  const nodeById = new Map(analysis.nodes.map((n) => [n.id, n]));
  const path = analysis.criticalPath.map((id) => nodeById.get(id)!);
  const open = analysis.nodes.filter((n) => !n.completedDate);
  const slip = analysis.finishSlipDays;
  const m = performance.milestones;

  return (
    <div className="mt-8 space-y-8">
      <section aria-labelledby="pm-schedule-perf-heading">
        <h2 id="pm-schedule-perf-heading" className="mb-2 font-display text-base text-ink">
          Schedule performance
        </h2>
        {analysis.nodes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-graphite">Add milestones to see the projected finish and critical path.</p>
        ) : (
          <div className="rounded-lg border border-line bg-white">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-line p-4 text-sm lg:grid-cols-4">
              <div>
                <dt className="text-xs text-graphite">Baseline finish</dt>
                <dd className="text-ink">{formatDate(analysis.baselineFinish!, { year: true })}</dd>
              </div>
              <div>
                <dt className="text-xs text-graphite">Projected finish</dt>
                <dd className={slip > 0 ? "font-medium text-warn" : "text-ink"}>
                  {formatDate(analysis.forecastFinish!, { year: true })}
                  {slip !== 0 && ` (${Math.abs(slip)} days ${slip > 0 ? "later" : "earlier"})`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-graphite">Milestones done against plan</dt>
                <dd className={m.plannedDone < m.plannedByNow ? "font-medium text-warn" : "text-ink"}>
                  {m.plannedDone} of {m.plannedByNow} planned by now
                </dd>
              </div>
              <div>
                <dt className="text-xs text-graphite">Average slip, slipped milestones</dt>
                <dd className="text-ink">{m.averageSlipDays ? `${m.averageSlipDays} days` : "None slipped"}</dd>
              </div>
            </dl>

            <div className="border-b border-line p-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-graphite">Critical path</h3>
              {path.length > 0 ? (
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
                  {path.map((n, i) => (
                    <li key={n.id} className="flex items-center gap-2">
                      {i > 0 && <span aria-hidden className="text-graphite">→</span>}
                      <span className="rounded-md border border-warn/40 bg-warn/5 px-2 py-1">
                        <span className="text-ink">{n.name}</span> <span className="text-xs text-graphite">{formatDate(n.forecastDate, { year: true })}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-graphite">
                  {analysis.hasDependencies
                    ? "Every milestone with dependencies is complete."
                    : "No milestone depends on another yet. Set dependencies in the Milestones list below and the critical path will be traced from them."}
                </p>
              )}
              {path.length > 0 && <p className="mt-2 text-xs text-graphite">A day&apos;s slip on any of these moves the projected finish by a day.</p>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-paper text-xs text-graphite">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Open milestone</th>
                    <th scope="col" className={th}>Baseline</th>
                    <th scope="col" className={th}>Projected</th>
                    <th scope="col" className={th}>Slip</th>
                    <th scope="col" className={th}>Float</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {open.map((n) => (
                    <tr key={n.id}>
                      <th scope="row" className="px-3 py-2 text-left font-normal text-ink">
                        {n.name}
                        {n.critical && <span className="ml-2 rounded-full border border-warn/50 bg-warn/10 px-1.5 py-0.5 text-[10px] font-medium text-warn">Critical</span>}
                      </th>
                      <td className={`${td} text-graphite`}>{formatDate(n.baselineDate, { year: true })}</td>
                      <td className={`${td} text-ink`}>{formatDate(n.forecastDate, { year: true })}</td>
                      <td className={`${td} ${n.forecastSlipDays > 0 ? "font-medium text-warn" : "text-graphite"}`}>{n.forecastSlipDays === 0 ? "0" : `${n.forecastSlipDays > 0 ? "+" : ""}${n.forecastSlipDays}d`}</td>
                      <td className={`${td} text-graphite`}>{n.floatDays}d</td>
                    </tr>
                  ))}
                  {open.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-sm text-graphite">Every milestone is complete.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2 text-xs text-graphite">
              Projected dates carry upstream slippage through the dependencies. Float is how far a milestone can slip before the projected finish moves.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="pm-cost-perf-heading">
        <h2 id="pm-cost-perf-heading" className="mb-2 font-display text-base text-ink">
          Cost performance (earned value)
        </h2>
        {performance.workstreams.length === 0 || performance.total.bac === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-graphite">
            Add budget lines and set each workstream&apos;s percent complete to see earned value.
          </p>
        ) : (
          <div className="rounded-lg border border-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-paper text-xs text-graphite">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Workstream</th>
                    <th scope="col" className={th}>Complete</th>
                    <th scope="col" className={th} title="Budget at completion">Budget</th>
                    <th scope="col" className={th} title="Planned value: budget x share of the planned window elapsed">Planned</th>
                    <th scope="col" className={th} title="Earned value: budget x percent complete">Earned</th>
                    <th scope="col" className={th} title="Actual cost: spent to date">Actual</th>
                    <th scope="col" className={th} title="Cost variance: earned minus actual">Cost var.</th>
                    <th scope="col" className={th} title="Schedule variance: earned minus planned">Sched. var.</th>
                    <th scope="col" className={th} title="Cost performance index: earned / actual">CPI</th>
                    <th scope="col" className={th} title="Schedule performance index: earned / planned">SPI</th>
                    <th scope="col" className={th} title="Estimate at completion: budget / CPI">Est. at completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {performance.workstreams.map((row) => (
                    <EvRow key={row.workstreamId} row={row} />
                  ))}
                  <EvRow row={performance.total} total />
                </tbody>
              </table>
            </div>
            <div className="space-y-1 border-t border-line px-4 py-2 text-xs text-graphite">
              <p>
                CPI below 1 means the work done has cost more than budgeted; SPI below 1 means less work is done than planned by now. Planned value spreads each
                workstream&apos;s budget evenly across its planned start and finish, so read SPI as a rough signal.
              </p>
              {performance.missingPlan.length > 0 && (
                <p className="text-amber-800">
                  No planned start and finish set for: {performance.missingPlan.join(", ")}. Planned value and SPI are left out for {performance.missingPlan.length === 1 ? "it" : "them"} and for the total. Set the dates under Edit on the workstream.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

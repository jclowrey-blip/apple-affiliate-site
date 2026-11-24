"use client";

// Budget view: lines grouped by workstream with budget, committed, spent and
// forecast, all editable in place. Variance is budget minus forecast.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createBudgetLineAction, deleteBudgetLineAction, updateBudgetLineAction } from "@/lib/pm/actions";
import { budgetTotals, type BudgetTotals } from "@/lib/pm/health";
import { formatMoney, formatMoneyFull } from "@/lib/pm/money";
import type { BudgetLine, Project, Workstream } from "@/lib/pm/types";
import MoneyInput from "./MoneyInput";
import { usePm } from "./PmContext";
import { runAction } from "./runAction";
import { btnPrimary, btnSecondary, fieldClass, labelClass } from "./styles";
import { EmptyState } from "./ui";
import { useOptimisticState } from "./useOptimisticState";

const AMOUNTS = ["budget", "committed", "spent", "forecast"] as const;
type AmountKey = (typeof AMOUNTS)[number];
const AMOUNT_LABELS: Record<AmountKey, string> = { budget: "Budget", committed: "Committed", spent: "Spent", forecast: "Forecast" };

function Variance({ value, full }: { value: number; full?: boolean }) {
  const text = full ? formatMoneyFull(value) : formatMoney(value);
  return (
    <span className={`font-mono text-xs tabular-nums ${value < 0 ? "font-medium text-warn" : "text-graphite"}`} title={formatMoneyFull(value)}>
      {value < 0 ? `${text} over`.replace("-", "") : text}
    </span>
  );
}

function TotalsCells({ totals }: { totals: BudgetTotals }) {
  return (
    <>
      {AMOUNTS.map((key) => (
        <td key={key} className="hidden px-2 py-2 text-right font-mono text-xs tabular-nums text-ink sm:table-cell" title={formatMoneyFull(totals[key])}>
          {formatMoney(totals[key])}
        </td>
      ))}
      <td className="hidden px-2 py-2 text-right sm:table-cell">
        <Variance value={totals.variance} />
      </td>
    </>
  );
}

function AddLine({ workstream }: { workstream: Workstream }) {
  const { showError } = usePm();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await runAction(() => createBudgetLineAction({ workstreamId: workstream.id, name }));
    setBusy(false);
    if (!result.ok) return showError(result.error);
    setName("");
  }

  return (
    <form onSubmit={add} className="flex gap-2 border-t border-line p-3">
      <input
        className={`${fieldClass} min-w-0 flex-1`}
        placeholder="New budget line, e.g. Long-lead equipment"
        aria-label={`New budget line for ${workstream.name}`}
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className={`${btnSecondary} shrink-0`} disabled={busy || !name.trim()}>
        Add line
      </button>
    </form>
  );
}

export default function BudgetTable({
  project,
  workstreams,
  lines: serverLines,
}: {
  project: Project;
  workstreams: Workstream[];
  lines: BudgetLine[];
}) {
  const { value: lines, mutate } = useOptimisticState(serverLines);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (workstreams.length === 0) {
    return (
      <EmptyState
        title="Add a workstream first"
        body="Budget lines belong to workstreams, so the budget can be read strand by strand."
        action={
          <Link href={`/pm/${project.slug}/program`} className={btnPrimary}>
            Go to Program
          </Link>
        }
      />
    );
  }

  function setAmount(line: BudgetLine, key: AmountKey, amount: number) {
    void mutate(
      (list) => list.map((l) => (l.id === line.id ? { ...l, [key]: amount } : l)),
      () => updateBudgetLineAction({ id: line.id, [key]: amount }),
    );
  }

  function rename(line: BudgetLine, name: string) {
    const next = name.trim();
    if (!next || next === line.name) return;
    void mutate(
      (list) => list.map((l) => (l.id === line.id ? { ...l, name: next } : l)),
      () => updateBudgetLineAction({ id: line.id, name: next }),
    );
  }

  function remove(line: BudgetLine) {
    setConfirmDelete(null);
    void mutate(
      (list) => list.filter((l) => l.id !== line.id),
      () => deleteBudgetLineAction({ id: line.id }),
    );
  }

  const totals = budgetTotals(lines);
  const approved = project.budget;
  const unallocated = approved - totals.budget;
  const cap = approved || totals.budget;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: "Approved", value: approved, hint: approved ? undefined : "Set on the project (Edit)" },
          { label: "Allocated", value: totals.budget, hint: approved ? (unallocated >= 0 ? `${formatMoney(unallocated)} unallocated` : `${formatMoney(-unallocated)} over-allocated`) : undefined, warn: approved > 0 && unallocated < 0 },
          { label: "Committed", value: totals.committed },
          { label: "Spent", value: totals.spent, hint: cap ? `${Math.round((totals.spent / cap) * 100)}% of budget` : undefined },
          { label: "Forecast", value: totals.forecast, warn: cap > 0 && totals.forecast > cap },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border border-line bg-white p-3">
            <dt className={labelClass}>{t.label}</dt>
            <dd className={`font-display text-lg ${t.warn ? "text-warn" : "text-ink"}`} title={formatMoneyFull(t.value)}>
              {t.label === "Approved" && !approved ? "Not set" : formatMoney(t.value)}
            </dd>
            {t.hint && <dd className={`text-xs ${t.warn ? "text-warn" : "text-graphite"}`}>{t.hint}</dd>}
          </div>
        ))}
        <div className="rounded-lg border border-line bg-white p-3">
          <dt className={labelClass}>Variance</dt>
          <dd className={`font-display text-lg ${totals.variance < 0 ? "text-warn" : "text-ink"}`} title={formatMoneyFull(totals.variance)}>
            {formatMoney(Math.abs(totals.variance))}
          </dd>
          <dd className={`text-xs ${totals.variance < 0 ? "text-warn" : "text-graphite"}`}>
            {totals.variance < 0 ? "forecast over budget" : "forecast under budget"}
          </dd>
        </div>
      </dl>

      {workstreams.map((ws) => {
        const wsLines = lines.filter((l) => l.workstreamId === ws.id);
        const wsTotals = budgetTotals(wsLines);
        return (
          <section key={ws.id} aria-label={`${ws.name} budget`} className="overflow-hidden rounded-lg border border-line bg-white">
            <table className="block w-full text-sm sm:table">
              <thead className="block border-b border-line bg-paper text-xs text-graphite sm:table-header-group">
                <tr className="flex items-center justify-between sm:table-row">
                  <th scope="col" className="px-3 py-2 text-left font-display text-sm font-normal text-ink">
                    {ws.name}
                    <span className="ml-2 font-body text-xs text-graphite sm:hidden">
                      {formatMoney(wsTotals.forecast)} of {formatMoney(wsTotals.budget)}
                    </span>
                  </th>
                  {AMOUNTS.map((key) => (
                    <th key={key} scope="col" className="hidden w-40 px-2 py-2 text-right font-medium sm:table-cell">
                      {AMOUNT_LABELS[key]}
                    </th>
                  ))}
                  <th scope="col" className="hidden w-28 px-2 py-2 text-right font-medium sm:table-cell">
                    Variance
                  </th>
                  <th scope="col" className="hidden w-10 sm:table-cell">
                    <span className="sr-only">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-line/70 sm:table-row-group">
                {wsLines.length === 0 && (
                  <tr className="block sm:table-row">
                    <td colSpan={7} className="block px-3 py-4 text-sm text-graphite sm:table-cell">
                      No budget lines in this workstream yet.
                    </td>
                  </tr>
                )}
                {wsLines.map((line) => (
                  <tr key={line.id} className="grid grid-cols-2 gap-2 p-3 sm:table-row sm:p-0">
                    <td className="col-span-2 block sm:table-cell sm:px-3 sm:py-1.5">
                      <input
                        aria-label="Budget line name"
                        className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-base text-ink hover:border-line focus:border-line focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
                        defaultValue={line.name}
                        key={line.name}
                        maxLength={80}
                        onBlur={(e) => rename(line, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    </td>
                    {AMOUNTS.map((key) => (
                      <td key={key} className="block sm:table-cell sm:px-2 sm:py-1.5">
                        <span className={`${labelClass} sm:hidden`}>{AMOUNT_LABELS[key]}</span>
                        <MoneyInput value={line[key]} label={`${AMOUNT_LABELS[key]} for ${line.name}`} onCommit={(amount) => setAmount(line, key, amount)} />
                      </td>
                    ))}
                    <td className="flex items-center justify-between sm:table-cell sm:px-2 sm:py-1.5 sm:text-right">
                      <span className={`${labelClass} mb-0 sm:hidden`}>Variance</span>
                      <Variance value={line.budget - line.forecast} />
                    </td>
                    <td className="flex items-center justify-end sm:table-cell sm:pr-2 sm:text-right">
                      {confirmDelete === line.id ? (
                        <span className="flex items-center justify-end gap-1 whitespace-nowrap text-xs">
                          <button type="button" className="rounded px-1.5 py-1 font-medium text-warn hover:bg-warn/10" onClick={() => remove(line)}>
                            Delete
                          </button>
                          <button type="button" className="rounded px-1.5 py-1 text-graphite hover:bg-line" onClick={() => setConfirmDelete(null)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded text-graphite hover:bg-line hover:text-ink"
                          aria-label={`Delete budget line ${line.name}`}
                          onClick={() => setConfirmDelete(line.id)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {wsLines.length > 1 && (
                <tfoot className="hidden border-t border-line bg-paper sm:table-footer-group">
                  <tr>
                    <td className="px-3 py-2 text-xs font-medium text-graphite">Workstream total</td>
                    <TotalsCells totals={wsTotals} />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
            <AddLine workstream={ws} />
          </section>
        );
      })}
      <p className="text-xs text-graphite">
        Amounts are whole dollars. Type shorthand such as 250M or 1.2B. Variance is budget minus forecast.
      </p>
    </div>
  );
}

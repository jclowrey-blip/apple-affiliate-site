// Performance against the baseline: earned value per workstream and a simple
// milestone count. Pure: no storage imports.
//
// Earned value, in standard terms:
//   BAC  budget at completion      = the workstream's total line budget
//   AC   actual cost               = spent to date
//   EV   earned value              = BAC x percent complete
//   PV   planned value             = BAC x the share of the planned window that
//                                    has elapsed (straight-line; needs the
//                                    workstream's planned start and finish)
//   CV = EV - AC, CPI = EV / AC    cost: below 1 means over cost for work done
//   SV = EV - PV, SPI = EV / PV    schedule: below 1 means behind plan
//   EAC  estimate at completion    = BAC / CPI
//
// Planned value assumes spend is spread evenly across the planned window. A
// real program rarely spends evenly, so treat SPI here as a rough signal; the
// milestone and critical path figures are the firmer schedule measures.
import { diffDays } from "./dates";
import type { ProgramSnapshot } from "./health";
import type { DateString } from "./types";

export type EarnedValue = {
  workstreamId: string | null;
  name: string;
  percentComplete: number;
  bac: number;
  ac: number;
  ev: number;
  /** null when the workstream has no planned start and finish. */
  pv: number | null;
  cv: number;
  sv: number | null;
  /** null until something has been spent. */
  cpi: number | null;
  spi: number | null;
  /** null when CPI can't be computed. */
  eac: number | null;
};

export type Performance = {
  workstreams: EarnedValue[];
  total: EarnedValue;
  /** Workstreams with a budget but no planned window, so PV/SPI are missing. */
  missingPlan: string[];
  milestones: {
    /** Baseline date on or before today. */
    plannedByNow: number;
    /** Of those, how many are complete. */
    plannedDone: number;
    /** All completed, including any finished early. */
    done: number;
    total: number;
    /** Average days late (target vs baseline) across unfinished milestones that have slipped. */
    averageSlipDays: number;
  };
};

/** Share of the planned window elapsed by `today`, from 0 to 1. */
export function plannedFraction(start: DateString, finish: DateString, today: DateString): number {
  if (today >= finish) return 1;
  if (today <= start) return 0;
  const span = diffDays(start, finish);
  return span <= 0 ? 1 : diffDays(start, today) / span;
}

const ratio = (a: number, b: number | null) => (b && b > 0 ? a / b : null);

function measure(name: string, workstreamId: string | null, percentComplete: number, bac: number, ac: number, ev: number, pv: number | null): EarnedValue {
  const cpi = ratio(ev, ac);
  return {
    workstreamId,
    name,
    percentComplete,
    bac,
    ac,
    ev,
    pv,
    cv: ev - ac,
    sv: pv === null ? null : ev - pv,
    cpi,
    spi: ratio(ev, pv),
    eac: cpi && cpi > 0 ? Math.round(bac / cpi) : null,
  };
}

export function buildPerformance(snapshot: ProgramSnapshot): Performance {
  const { today } = snapshot;
  const rows: EarnedValue[] = [];
  const missingPlan: string[] = [];

  for (const group of snapshot.workstreams) {
    const ws = group.workstream;
    if (!ws) continue;
    const bac = group.totals.budget;
    const ev = Math.round((bac * ws.percentComplete) / 100);
    const hasPlan = ws.plannedStart !== null && ws.plannedFinish !== null;
    const pv = hasPlan ? Math.round(bac * plannedFraction(ws.plannedStart!, ws.plannedFinish!, today)) : null;
    if (!hasPlan && bac > 0) missingPlan.push(ws.name);
    rows.push(measure(ws.name, ws.id, ws.percentComplete, bac, group.totals.spent, ev, pv));
  }

  const sum = (key: "bac" | "ac" | "ev") => rows.reduce((n, r) => n + r[key], 0);
  const bac = sum("bac");
  const ev = sum("ev");
  // A program-level PV is only honest when every budgeted workstream has a plan.
  const pv = missingPlan.length === 0 && rows.some((r) => r.pv !== null) ? rows.reduce((n, r) => n + (r.pv ?? 0), 0) : null;
  const total = measure("Total", null, bac > 0 ? Math.round((ev / bac) * 100) : 0, bac, sum("ac"), ev, pv);

  const all = snapshot.workstreams.flatMap((w) => w.milestones);
  const planned = all.filter((m) => m.baselineDate <= today);
  const slipped = all.filter((m) => !m.completedDate && m.slipDays > 0);
  return {
    workstreams: rows,
    total,
    missingPlan,
    milestones: {
      plannedByNow: planned.length,
      plannedDone: planned.filter((m) => m.completedDate).length,
      done: all.filter((m) => m.completedDate).length,
      total: all.length,
      averageSlipDays: slipped.length ? Math.round(slipped.reduce((n, m) => n + m.slipDays, 0) / slipped.length) : 0,
    },
  };
}

/** 0.97 style, or a dash when the index can't be computed yet. */
export function formatIndex(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

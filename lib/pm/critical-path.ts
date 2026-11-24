// Critical path and projected finish, computed over the milestone dependency
// network. Pure: no storage imports.
//
// How it works. Each milestone's working duration is taken from the baseline
// plan: the gap between its baseline date and the latest baseline date among
// the milestones it depends on. (A milestone with no dependencies is anchored
// at its own date.) Then:
//
//   forecast  = when each milestone will now land: its completed date if
//               done; otherwise the latest of its target date, today, and
//               (latest predecessor forecast + its duration). So slippage
//               upstream pushes everything downstream.
//   float     = how many days a milestone could slip before it moves the
//               projected finish (backward pass from the projected finish).
//   critical  = unfinished milestones with zero float.
//   path      = from the last milestone to finish, back through each
//               predecessor that sets its date, for as long as one does.
import { addDays, diffDays } from "./dates";
import type { DateString, Milestone } from "./types";

export type ScheduleNode = {
  id: string;
  name: string;
  workstreamId: string | null;
  baselineDate: DateString;
  targetDate: DateString;
  completedDate: DateString | null;
  /** Working days after the last predecessor, from the baseline. null for start milestones. */
  durationDays: number | null;
  /** Where this milestone is now expected to land. */
  forecastDate: DateString;
  /** forecast minus baseline. */
  forecastSlipDays: number;
  /** Days it can slip before the projected finish moves. */
  floatDays: number;
  critical: boolean;
  /** The predecessor whose forecast determines this one's, if any. */
  drivenById: string | null;
};

export type ScheduleAnalysis = {
  /** In dependency order (predecessors first). */
  nodes: ScheduleNode[];
  /** Ids from the first driving milestone to the last milestone to finish. */
  criticalPath: string[];
  baselineFinish: DateString | null;
  forecastFinish: DateString | null;
  /** forecastFinish minus baselineFinish. */
  finishSlipDays: number;
  /** False when no milestone depends on another, so no path can be traced. */
  hasDependencies: boolean;
};

const later = (a: DateString, b: DateString) => (a >= b ? a : b);
const earlier = (a: DateString, b: DateString) => (a <= b ? a : b);

export function analyzeSchedule(milestones: readonly Milestone[], today: DateString): ScheduleAnalysis {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const preds = new Map(milestones.map((m) => [m.id, m.dependsOnIds.filter((id) => byId.has(id) && id !== m.id)]));
  const succs = new Map<string, string[]>(milestones.map((m) => [m.id, []]));
  for (const [id, list] of preds) for (const p of list) succs.get(p)!.push(id);

  // Dependency order. Loops are rejected when saved, but stay safe if one exists.
  const order: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    if (state.get(id)) return;
    state.set(id, 1);
    for (const p of preds.get(id)!) if (state.get(p) !== 1) visit(p);
    state.set(id, 2);
    order.push(id);
  };
  [...milestones].sort((a, b) => a.baselineDate.localeCompare(b.baselineDate) || a.name.localeCompare(b.name)).forEach((m) => visit(m.id));

  const duration = new Map<string, number | null>();
  const forecast = new Map<string, DateString>();
  const drivenBy = new Map<string, string | null>();

  for (const id of order) {
    const m = byId.get(id)!;
    const ps = preds.get(id)!;
    const d = ps.length ? Math.max(0, diffDays(ps.map((p) => byId.get(p)!.baselineDate).reduce(later), m.baselineDate)) : null;
    duration.set(id, d);

    if (m.completedDate) {
      forecast.set(id, m.completedDate);
      drivenBy.set(id, null);
      continue;
    }
    let date = later(m.targetDate, today);
    let driver: string | null = null;
    if (ps.length) {
      // The remaining work starts once the last predecessor lands.
      const last = ps.reduce((x, y) => (forecast.get(y)! > forecast.get(x)! ? y : x));
      const viaPredecessor = addDays(forecast.get(last)!, d ?? 0);
      if (viaPredecessor >= date) {
        date = viaPredecessor;
        if (!byId.get(last)!.completedDate) driver = last;
      }
    }
    forecast.set(id, date);
    drivenBy.set(id, driver);
  }

  const baselineFinish = milestones.length ? milestones.map((m) => m.baselineDate).reduce(later) : null;
  const forecastFinish = milestones.length ? [...forecast.values()].reduce(later) : null;

  // Backward pass: the latest each milestone can land without moving the finish.
  const latest = new Map<string, DateString>();
  for (const id of [...order].reverse()) {
    let limit = forecastFinish!;
    for (const s of succs.get(id)!) {
      if (byId.get(s)!.completedDate) continue; // a finished successor no longer constrains anything
      limit = earlier(limit, addDays(latest.get(s)!, -(duration.get(s) ?? 0)));
    }
    latest.set(id, limit);
  }

  const nodes: ScheduleNode[] = order.map((id) => {
    const m = byId.get(id)!;
    const f = forecast.get(id)!;
    const floatDays = m.completedDate ? 0 : Math.max(0, diffDays(f, latest.get(id)!));
    return {
      id,
      name: m.name,
      workstreamId: m.workstreamId,
      baselineDate: m.baselineDate,
      targetDate: m.targetDate,
      completedDate: m.completedDate,
      durationDays: duration.get(id)!,
      forecastDate: f,
      forecastSlipDays: diffDays(m.baselineDate, f),
      floatDays,
      critical: !m.completedDate && floatDays === 0,
      drivenById: drivenBy.get(id)!,
    };
  });

  const hasDependencies = [...preds.values()].some((p) => p.length > 0);
  const criticalPath: string[] = [];
  if (hasDependencies && forecastFinish) {
    // Start from the unfinished milestone that finishes last, and walk back through its drivers.
    const open = nodes.filter((n) => !n.completedDate);
    let cursor: string | null = open.length ? open.reduce((a, b) => (b.forecastDate > a.forecastDate ? b : a)).id : null;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      criticalPath.unshift(cursor);
      cursor = nodes.find((n) => n.id === cursor)!.drivenById;
    }
  }

  return {
    nodes,
    criticalPath,
    baselineFinish,
    forecastFinish,
    finishSlipDays: baselineFinish && forecastFinish ? diffDays(baselineFinish, forecastFinish) : 0,
    hasDependencies,
  };
}

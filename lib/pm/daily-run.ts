// Loads what the daily loop needs and runs its end-of-day step. Shared by the
// Daily tab's server action and the assistant's tools.
import { listActivity, logActivity } from "./activity";
import { replaceGeneratedDrafts } from "./communications";
import { analyzeSchedule, type ScheduleAnalysis } from "./critical-path";
import { activityOn, buildDailyCheckin, buildDailySummary, buildTeamMessages, dailySummaryTitle, type DailyCheckin } from "./daily";
import { todayString } from "./dates";
import type { ProgramSnapshot } from "./health";
import { buildPerformance, type Performance } from "./performance";
import { getProgramSnapshot } from "./program";
import { createReport } from "./reports";
import { listMembers } from "./team";
import type { Activity, Communication, DateString, Project, StatusReport, TeamMember } from "./types";

export type DailyContext = {
  today: DateString;
  snapshot: ProgramSnapshot;
  analysis: ScheduleAnalysis;
  performance: Performance;
  checkin: DailyCheckin;
  members: TeamMember[];
  /** Changes and notes recorded today, oldest first. */
  activities: Activity[];
};

export async function loadDailyContext(project: Project, today: DateString = todayString()): Promise<DailyContext> {
  const [y, m, d] = today.split("-").map(Number);
  const [snapshot, members, recent] = await Promise.all([
    getProgramSnapshot(project, today),
    listMembers(project.id),
    // From a day early, then narrowed to the local calendar day.
    listActivity(project.id, new Date(y, m - 1, d - 1)),
  ]);
  const analysis = analyzeSchedule(snapshot.workstreams.flatMap((w) => w.milestones), today);
  return {
    today,
    snapshot,
    analysis,
    performance: buildPerformance(snapshot),
    checkin: buildDailyCheckin(snapshot, analysis, today),
    members,
    activities: activityOn(recent, today),
  };
}

/**
 * Closes out the day: records any notes, saves the daily summary to Reports,
 * and drafts today's messages to the team (replacing earlier auto-drafts for
 * today that haven't been edited or sent). Nothing is sent to anyone.
 */
export async function finishDay(project: Project, notes: string, today: DateString = todayString()): Promise<{ report: StatusReport; messages: Communication[] }> {
  const text = notes.trim();
  if (text) await logActivity(project.id, text, "note");

  const context = await loadDailyContext(project, today);
  const body = buildDailySummary(context);
  const report = await createReport({ projectId: project.id, title: dailySummaryTitle(project.name, today), periodStart: today, periodEnd: today, body, kind: "daily" });
  const messages = await replaceGeneratedDrafts(project.id, today, buildTeamMessages({ ...context, summary: body }));
  return { report, messages };
}

/** Drafts today's team messages without closing the day (no summary message). */
export async function draftTeamMessages(project: Project, today: DateString = todayString()): Promise<Communication[]> {
  const context = await loadDailyContext(project, today);
  return replaceGeneratedDrafts(project.id, today, buildTeamMessages(context));
}

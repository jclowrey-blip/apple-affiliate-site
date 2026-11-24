import { listBudgetLines } from "./budget";
import { todayString } from "./dates";
import { buildSnapshot, type ProgramSnapshot } from "./health";
import { listMilestones } from "./milestones";
import { listRisks } from "./risks";
import { listTasks } from "./tasks";
import type { DateString, Project } from "./types";
import { listWorkstreams } from "./workstreams";

/** Loads everything about a project and rolls it up into one health snapshot. */
export async function getProgramSnapshot(project: Project, today: DateString = todayString()): Promise<ProgramSnapshot> {
  const [workstreams, milestones, budgetLines, risks, tasks] = await Promise.all([
    listWorkstreams(project.id),
    listMilestones(project.id),
    listBudgetLines(project.id),
    listRisks(project.id),
    listTasks(project.id),
  ]);
  return buildSnapshot({ project, workstreams, milestones, budgetLines, risks, tasks, today });
}

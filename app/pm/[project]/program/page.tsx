import MilestoneManager from "@/components/pm/MilestoneManager";
import ProgramOverview from "@/components/pm/ProgramOverview";
import TaskPanelSlot from "@/components/pm/TaskPanelSlot";
import { listMilestones } from "@/lib/pm/milestones";
import { getProgramSnapshot } from "@/lib/pm/program";
import { listTasks } from "@/lib/pm/tasks";
import { listWorkstreams } from "@/lib/pm/workstreams";
import { loadProject } from "../load";

export const metadata = { title: "Program" };

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: { project: string };
  searchParams: { task?: string | string[] };
}) {
  const project = await loadProject(params.project);
  const [snapshot, milestones, workstreams, tasks] = await Promise.all([
    getProgramSnapshot(project),
    listMilestones(project.id),
    listWorkstreams(project.id),
    listTasks(project.id),
  ]);
  return (
    <>
      <ProgramOverview snapshot={snapshot} />
      <MilestoneManager projectId={project.id} milestones={milestones} tasks={tasks} workstreams={workstreams} />
      <TaskPanelSlot taskId={searchParams.task} />
    </>
  );
}

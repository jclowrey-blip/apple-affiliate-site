import MilestoneManager from "@/components/pm/MilestoneManager";
import TaskPanelSlot from "@/components/pm/TaskPanelSlot";
import Timeline from "@/components/pm/Timeline";
import { todayString } from "@/lib/pm/dates";
import { listMilestones } from "@/lib/pm/milestones";
import { listTasks } from "@/lib/pm/tasks";
import { loadProject } from "../load";

export const metadata = { title: "Timeline" };

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: { project: string };
  searchParams: { task?: string | string[] };
}) {
  const project = await loadProject(params.project);
  const [tasks, milestones] = await Promise.all([listTasks(project.id), listMilestones(project.id)]);
  return (
    <>
      <Timeline tasks={tasks} milestones={milestones} today={todayString()} color={project.color} />
      <MilestoneManager projectId={project.id} milestones={milestones} tasks={tasks} />
      <TaskPanelSlot taskId={searchParams.task} />
    </>
  );
}

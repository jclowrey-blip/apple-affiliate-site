import { todayISO } from "@/lib/pm/dates";
import { listMilestones } from "@/lib/pm/milestones";
import { getTask, listLabels } from "@/lib/pm/tasks";
import TaskPanel, { MissingTaskPanel } from "./TaskPanel";

/**
 * Server half of the task side panel. Every /pm page renders this with its
 * `?task=` search param, so a task URL is shareable and works over any view.
 */
export default async function TaskPanelLoader({ taskId }: { taskId?: string | string[] }) {
  if (typeof taskId !== "string" || !taskId) return null;

  const task = await getTask(taskId);
  if (!task) return <MissingTaskPanel />;

  const [milestones, labelOptions] = await Promise.all([listMilestones(task.projectId), listLabels(task.projectId)]);
  return <TaskPanel key={task.id} task={task} milestones={milestones} labelOptions={labelOptions} today={todayISO()} />;
}

import { todayString } from "@/lib/pm/dates";
import { listMilestones } from "@/lib/pm/milestones";
import { getTask } from "@/lib/pm/tasks";
import TaskPanel, { TaskPanelMissing } from "./TaskPanel";

/**
 * Renders the task side panel when the URL has ?task=<id>. Every /pm view
 * includes this, which is what makes the panel open over any of them and
 * gives each task a shareable URL.
 */
export default async function TaskPanelSlot({ taskId }: { taskId?: string | string[] }) {
  const id = Array.isArray(taskId) ? taskId[0] : taskId;
  if (!id) return null;

  const task = await getTask(id);
  if (!task) return <TaskPanelMissing />;

  const milestones = await listMilestones(task.projectId);
  return <TaskPanel key={task.id} task={task} milestones={milestones} today={todayString()} />;
}

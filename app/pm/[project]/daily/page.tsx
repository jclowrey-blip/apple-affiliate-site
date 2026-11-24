import DailyCheckinView from "@/components/pm/DailyCheckinView";
import { loadDailyContext } from "@/lib/pm/daily-run";
import { loadProject } from "../load";

export const metadata = { title: "Daily" };

export default async function DailyPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const context = await loadDailyContext(project);
  const workstreams = context.snapshot.workstreams.flatMap((w) => (w.workstream ? [w.workstream] : []));
  return (
    <DailyCheckinView
      project={project}
      today={context.today}
      checkin={context.checkin}
      activities={context.activities}
      workstreams={workstreams}
      memberCount={context.members.length}
      forecastFinish={context.analysis.forecastFinish}
      finishSlipDays={context.analysis.finishSlipDays}
    />
  );
}

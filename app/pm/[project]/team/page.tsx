import TeamView from "@/components/pm/TeamView";
import { listCommunications } from "@/lib/pm/communications";
import { todayString } from "@/lib/pm/dates";
import { listMembers } from "@/lib/pm/team";
import { listWorkstreams } from "@/lib/pm/workstreams";
import { loadProject } from "../load";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: { project: string } }) {
  const project = await loadProject(params.project);
  const [members, workstreams, messages] = await Promise.all([listMembers(project.id), listWorkstreams(project.id), listCommunications(project.id)]);
  return <TeamView projectId={project.id} members={members} workstreams={workstreams} messages={messages} today={todayString()} />;
}

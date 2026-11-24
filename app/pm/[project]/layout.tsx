import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectStatusBadge } from "@/components/pm/Badges";
import ProjectSettings from "@/components/pm/ProjectSettings";
import ProjectTabs from "@/components/pm/ProjectTabs";
import { getProjectBySlug } from "@/lib/pm/projects";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { project: string };
}) {
  const project = await getProjectBySlug(params.project);
  if (!project) notFound();

  return (
    <div>
      <div className="mb-5 border-b border-line">
        <Link href="/pm" className="text-xs text-graphite hover:text-ink">
          ← All projects
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
          <h1 className="min-w-0 break-words font-display text-2xl text-ink">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
          <span className="flex-1" />
          <ProjectSettings project={project} />
        </div>
        {project.description && <p className="mt-1 max-w-3xl text-sm text-graphite">{project.description}</p>}
        <div className="mt-3">
          <ProjectTabs slug={project.slug} />
        </div>
      </div>
      {children}
    </div>
  );
}

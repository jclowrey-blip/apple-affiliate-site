import ProjectFormButton from "@/components/pm/ProjectFormButton";
import ProjectTabs from "@/components/pm/ProjectTabs";
import { btnSecondary } from "@/components/pm/styles";
import { PROJECT_STATUS_LABELS } from "@/lib/pm/types";
import { loadProject } from "./load";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { project: string };
}) {
  const project = await loadProject(params.project);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-xl text-ink">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
            <span className="truncate">{project.name}</span>
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-body text-[11px] text-graphite">
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </h1>
          {project.description && <p className="mt-1 text-sm text-graphite">{project.description}</p>}
        </div>
        <ProjectFormButton project={project} className={`${btnSecondary} shrink-0`}>
          Edit
        </ProjectFormButton>
      </div>
      <ProjectTabs slug={project.slug} />
      {children}
    </div>
  );
}

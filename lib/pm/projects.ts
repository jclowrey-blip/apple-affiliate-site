import { db } from "./db";
import { NotFoundError } from "./errors";
import { toProject } from "./mappers";
import type { CreateProjectInput, UpdateProjectInput } from "./schemas";
import type { Project, ProjectSummary } from "./types";

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "project";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (await db.project.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((p) => p.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function listProjects(): Promise<Project[]> {
  const rows = await db.project.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toProject);
}

/** All projects with done / total task counts for progress bars. */
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const [rows, counts] = await Promise.all([
    db.project.findMany({ orderBy: { createdAt: "asc" } }),
    db.task.groupBy({ by: ["projectId", "status"], _count: { _all: true } }),
  ]);
  return rows.map((row) => {
    const mine = counts.filter((c) => c.projectId === row.id);
    return {
      ...toProject(row),
      totalTasks: mine.reduce((sum, c) => sum + c._count._all, 0),
      doneTasks: mine.filter((c) => c.status === "done").reduce((sum, c) => sum + c._count._all, 0),
    };
  });
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const row = await db.project.findUnique({ where: { slug } });
  return row ? toProject(row) : null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const slug = await uniqueSlug(input.name);
  const row = await db.project.create({ data: { ...input, slug } });
  return toProject(row);
}

/** Updates a project. The slug is kept stable on rename so shared URLs keep working. */
export async function updateProject({ id, ...patch }: UpdateProjectInput): Promise<Project> {
  const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Project");
  const row = await db.project.update({ where: { id }, data: patch });
  return toProject(row);
}

/** Deletes a project and everything in it (tasks, subtasks, milestones, labels). */
export async function deleteProject(id: string): Promise<void> {
  const { count } = await db.project.deleteMany({ where: { id } });
  if (count === 0) throw new NotFoundError("Project");
}

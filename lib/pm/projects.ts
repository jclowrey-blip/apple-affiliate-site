import { prisma } from "./db";
import {
  PmNotFoundError,
  type Project,
  type ProjectStatus,
  type ProjectWithProgress,
} from "./types";

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  status: string;
  createdAt: Date;
  budget: bigint;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    color: row.color,
    status: row.status as ProjectStatus,
    createdAt: row.createdAt.toISOString(),
    budget: Number(row.budget),
  };
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  // /pm/api (assistant endpoint) and /pm/login are real routes, not projects.
  if (slug === "api" || slug === "login") return `${slug}-project`;
  if (!slug) return "project";
  return slug;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (await prisma.project.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map(
      (p) => p.slug,
    ),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

export async function listProjects(): Promise<ProjectWithProgress[]> {
  const rows = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { tasks: { select: { status: true } } },
  });
  return rows.map(({ tasks, ...row }) => ({
    ...toProject(row),
    totalTasks: tasks.length,
    doneTasks: tasks.filter((t) => t.status === "done").length,
  }));
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { slug } });
  return row ? toProject(row) : null;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  return row ? toProject(row) : null;
}

export async function createProject(input: {
  name: string;
  description?: string;
  color: string;
  status?: ProjectStatus;
  budget?: number;
}): Promise<Project> {
  const row = await prisma.project.create({
    data: {
      slug: await uniqueSlug(input.name),
      name: input.name,
      description: input.description ?? "",
      color: input.color,
      status: input.status ?? "active",
      budget: BigInt(input.budget ?? 0),
    },
  });
  return toProject(row);
}

/** Updates a project. The slug is left alone on rename so existing URLs keep working. */
export async function updateProject(
  id: string,
  patch: { name?: string; description?: string; color?: string; status?: ProjectStatus; budget?: number },
): Promise<Project> {
  const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Project");
  const { budget, ...rest } = patch;
  return toProject(
    await prisma.project.update({
      where: { id },
      data: { ...rest, budget: budget === undefined ? undefined : BigInt(budget) },
    }),
  );
}

/** Deletes a project along with its tasks, subtasks and milestones. */
export async function deleteProject(id: string): Promise<void> {
  const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Project");
  await prisma.project.delete({ where: { id } });
  await prisma.label.deleteMany({ where: { tasks: { none: {} } } });
}

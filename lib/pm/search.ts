import { prisma } from "./db";
import type { SearchResult, TaskStatus } from "./types";

function snippet(text: string, query: string, radius = 40): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return flat.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + query.length + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/** Case-insensitive substring search over task titles and descriptions, all projects. */
export async function searchTasks(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.task.findMany({
    where: { OR: [{ title: { contains: q } }, { description: { contains: q } }] },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      project: { select: { slug: true, name: true, color: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit * 2,
  });
  const lower = q.toLowerCase();
  // Title matches first, then description-only matches.
  const ranked = [
    ...rows.filter((r) => r.title.toLowerCase().includes(lower)),
    ...rows.filter((r) => !r.title.toLowerCase().includes(lower)),
  ].slice(0, limit);
  return ranked.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as TaskStatus,
    snippet: r.title.toLowerCase().includes(lower) ? "" : snippet(r.description, q),
    project: r.project,
  }));
}

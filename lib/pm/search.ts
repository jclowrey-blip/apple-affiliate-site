import { db } from "./db";
import { projectRefSelect } from "./mappers";
import type { SearchResult, TaskStatus } from "./types";

/** A short excerpt of `text` around the first match of `query`. */
export function makeSnippet(text: string, query: string, radius = 40): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? "…" : "");
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + query.length + radius);
  return (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "");
}

/** Case-insensitive substring search over task titles and descriptions, title matches first. */
export async function searchTasks(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await db.task.findMany({
    where: { OR: [{ title: { contains: q } }, { description: { contains: q } }] },
    select: { id: true, title: true, description: true, status: true, updatedAt: true, project: { select: projectRefSelect } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const lower = q.toLowerCase();
  // SQLite LIKE treats % and _ as wildcards; re-check so they only match literally.
  const matches = rows.filter(
    (r) => r.title.toLowerCase().includes(lower) || r.description.toLowerCase().includes(lower),
  );
  const inTitle = (r: (typeof rows)[number]) => (r.title.toLowerCase().includes(lower) ? 0 : 1);
  return matches
    .sort((a, b) => inTitle(a) - inTitle(b))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as TaskStatus,
      snippet: makeSnippet(r.description, q),
      project: r.project,
    }));
}

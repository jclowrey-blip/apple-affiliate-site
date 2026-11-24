import { authEnabled, hasAccess } from "@/lib/pm/access";
import { exportCsv } from "@/lib/pm/import";
import { ENTITY_KEYS, type EntityKey } from "@/lib/pm/interchange";
import { getProjectBySlug } from "@/lib/pm/projects";

export const dynamic = "force-dynamic";

// GET /pm/api/export?project=<slug>&type=milestones|budget|risks|team
// Downloads one kind of record as CSV, with the same columns the import reads.
export async function GET(request: Request) {
  if (!(await hasAccess())) return new Response(authEnabled() ? "Sign in first" : "Not found", { status: authEnabled() ? 401 : 404 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") as EntityKey;
  const project = await getProjectBySlug(url.searchParams.get("project") ?? "");
  if (!project || !ENTITY_KEYS.includes(type)) return new Response("Not found", { status: 404 });

  return new Response(await exportCsv(project, type), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.slug}-${type}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

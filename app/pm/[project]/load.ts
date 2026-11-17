import { notFound } from "next/navigation";
import { cache } from "react";
import { requireAccess } from "@/lib/pm/access";
import { getProjectBySlug } from "@/lib/pm/projects";

/**
 * Loads the project for the current route once per request, or 404s. Every
 * project page and the project layout go through here, so this is also
 * where they pass the access gate.
 */
export const loadProject = cache(async (slug: string) => {
  await requireAccess();
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  return project;
});

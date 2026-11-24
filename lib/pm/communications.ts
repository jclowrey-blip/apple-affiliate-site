import { prisma } from "./db";
import { fromDateString, toDateString } from "./dates";
import { PmNotFoundError, type Communication, type DateString } from "./types";

type Row = {
  id: string;
  projectId: string;
  memberId: string | null;
  kind: string;
  recipient: string;
  email: string;
  subject: string;
  body: string;
  forDate: Date;
  status: string;
  source: string;
  createdAt: Date;
};

function toCommunication(row: Row): Communication {
  return {
    id: row.id,
    projectId: row.projectId,
    memberId: row.memberId,
    kind: row.kind === "summary" ? "summary" : "update_request",
    recipient: row.recipient,
    email: row.email,
    subject: row.subject,
    body: row.body,
    forDate: toDateString(row.forDate),
    status: row.status === "sent" ? "sent" : "draft",
    source: row.source === "assistant" || row.source === "edited" ? row.source : "generated",
    createdAt: row.createdAt.toISOString(),
  };
}

export type CommunicationDraft = {
  memberId?: string | null;
  kind?: "update_request" | "summary";
  recipient: string;
  email?: string;
  subject: string;
  body: string;
};

/** A project's drafted messages, newest day first. */
export async function listCommunications(projectId: string, limit = 200): Promise<Communication[]> {
  const rows = await prisma.communication.findMany({
    where: { projectId },
    orderBy: [{ forDate: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
  return rows.map(toCommunication);
}

export async function createCommunication(
  input: CommunicationDraft & { projectId: string; forDate: DateString; source?: "generated" | "assistant" | "edited" },
): Promise<Communication> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  return toCommunication(
    await prisma.communication.create({
      data: {
        projectId: input.projectId,
        memberId: input.memberId ?? null,
        kind: input.kind ?? "update_request",
        recipient: input.recipient,
        email: input.email ?? "",
        subject: input.subject,
        body: input.body,
        forDate: fromDateString(input.forDate),
        source: input.source ?? "generated",
      },
    }),
  );
}

/**
 * Replaces a day's auto-generated drafts with a fresh set. Messages already
 * marked sent, and ones the assistant or the user wrote, are left alone.
 */
export async function replaceGeneratedDrafts(projectId: string, forDate: DateString, drafts: CommunicationDraft[]): Promise<Communication[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new PmNotFoundError("Project");
  const day = fromDateString(forDate);
  return prisma.$transaction(async (tx) => {
    await tx.communication.deleteMany({ where: { projectId, forDate: day, status: "draft", source: "generated" } });
    const created: Communication[] = [];
    for (const d of drafts) {
      created.push(
        toCommunication(
          await tx.communication.create({
            data: { projectId, forDate: day, memberId: d.memberId ?? null, kind: d.kind ?? "update_request", recipient: d.recipient, email: d.email ?? "", subject: d.subject, body: d.body },
          }),
        ),
      );
    }
    return created;
  });
}

export async function updateCommunication(
  id: string,
  patch: { subject?: string; body?: string; status?: "draft" | "sent" },
): Promise<Communication> {
  const existing = await prisma.communication.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Message");
  // An edited draft is the user's own text from then on, so regenerating won't replace it.
  const edited = patch.subject !== undefined || patch.body !== undefined;
  return toCommunication(await prisma.communication.update({ where: { id }, data: { ...patch, ...(edited ? { source: "edited" } : {}) } }));
}

export async function deleteCommunication(id: string): Promise<void> {
  const existing = await prisma.communication.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Message");
  await prisma.communication.delete({ where: { id } });
}

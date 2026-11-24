import { prisma } from "./db";
import { PmNotFoundError, type BudgetLine } from "./types";

type Amounts = { budget?: number; committed?: number; spent?: number; forecast?: number };

function toBudgetLine(row: {
  id: string;
  workstreamId: string;
  name: string;
  budget: bigint;
  committed: bigint;
  spent: bigint;
  forecast: bigint;
  order: number;
}): BudgetLine {
  return {
    id: row.id,
    workstreamId: row.workstreamId,
    name: row.name,
    budget: Number(row.budget),
    committed: Number(row.committed),
    spent: Number(row.spent),
    forecast: Number(row.forecast),
    order: row.order,
  };
}

const big = (v: number | undefined) => (v === undefined ? undefined : BigInt(Math.round(v)));

/** All budget lines for a project, grouped by workstream order. */
export async function listBudgetLines(projectId: string): Promise<BudgetLine[]> {
  const rows = await prisma.budgetLine.findMany({
    where: { workstream: { projectId } },
    orderBy: [{ workstream: { order: "asc" } }, { order: "asc" }, { name: "asc" }],
  });
  return rows.map(toBudgetLine);
}

/** Creates a budget line. The forecast starts equal to the budget unless given. */
export async function createBudgetLine(input: { workstreamId: string; name: string } & Amounts): Promise<BudgetLine> {
  const ws = await prisma.workstream.findUnique({ where: { id: input.workstreamId }, select: { id: true } });
  if (!ws) throw new PmNotFoundError("Workstream");
  const last = await prisma.budgetLine.aggregate({ where: { workstreamId: input.workstreamId }, _max: { order: true } });
  return toBudgetLine(
    await prisma.budgetLine.create({
      data: {
        workstreamId: input.workstreamId,
        name: input.name,
        budget: big(input.budget ?? 0),
        committed: big(input.committed ?? 0),
        spent: big(input.spent ?? 0),
        forecast: big(input.forecast ?? input.budget ?? 0),
        order: (last._max.order ?? -1) + 1,
      },
    }),
  );
}

export async function updateBudgetLine(id: string, patch: { name?: string } & Amounts): Promise<BudgetLine> {
  const existing = await prisma.budgetLine.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Budget line");
  return toBudgetLine(
    await prisma.budgetLine.update({
      where: { id },
      data: {
        name: patch.name,
        budget: big(patch.budget),
        committed: big(patch.committed),
        spent: big(patch.spent),
        forecast: big(patch.forecast),
      },
    }),
  );
}

export async function deleteBudgetLine(id: string): Promise<void> {
  const existing = await prisma.budgetLine.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new PmNotFoundError("Budget line");
  await prisma.budgetLine.delete({ where: { id } });
}

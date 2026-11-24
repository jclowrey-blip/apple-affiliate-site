import { logActivity } from "./activity";
import { prisma } from "./db";
import { formatMoney } from "./money";
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
  const ws = await prisma.workstream.findUnique({ where: { id: input.workstreamId }, select: { projectId: true, name: true } });
  if (!ws) throw new PmNotFoundError("Workstream");
  const last = await prisma.budgetLine.aggregate({ where: { workstreamId: input.workstreamId }, _max: { order: true } });
  const created = toBudgetLine(
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
  await logActivity(ws.projectId, `Budget line added: ${created.name} (${ws.name}), budget ${formatMoney(created.budget)}`);
  return created;
}

export async function updateBudgetLine(id: string, patch: { name?: string } & Amounts): Promise<BudgetLine> {
  const existing = await prisma.budgetLine.findUnique({ where: { id }, include: { workstream: { select: { projectId: true } } } });
  if (!existing) throw new PmNotFoundError("Budget line");
  const before = toBudgetLine(existing);
  const after = toBudgetLine(
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
  const changes = (["budget", "committed", "spent", "forecast"] as const)
    .filter((key) => after[key] !== before[key])
    .map((key) => `${key} ${formatMoney(before[key])} to ${formatMoney(after[key])}`);
  if (changes.length) await logActivity(existing.workstream.projectId, `Budget line ${after.name}: ${changes.join("; ")}`);
  return after;
}

export async function deleteBudgetLine(id: string): Promise<void> {
  const existing = await prisma.budgetLine.findUnique({ where: { id }, select: { name: true, workstream: { select: { projectId: true } } } });
  if (!existing) throw new PmNotFoundError("Budget line");
  await prisma.budgetLine.delete({ where: { id } });
  await logActivity(existing.workstream.projectId, `Budget line deleted: ${existing.name}`);
}

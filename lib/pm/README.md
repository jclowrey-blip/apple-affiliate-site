# /pm — project management tool

A single-user project tracker that lives beside the storefront at `/pm`. It is
not linked from the storefront, every page is `noindex`, and it has its own
root layout (`app/pm/layout.tsx`).

## Setup

```bash
cp .env.example .env     # DATABASE_URL for the SQLite file
npm install              # also generates the Prisma client
npx prisma migrate deploy
npm run db:seed          # optional: two sample projects, 15 tasks (wipes PM data)
npm run dev              # http://localhost:3000/pm
```

## Access

Set `PM_PASSWORD` in `.env` to require signing in at `/pm/login`. The password
is the only credential; a signed, HTTP-only cookie keeps you signed in for 30
days, and changing the password signs every browser out. Eight wrong attempts
lock sign-in for ten minutes.

With no password set, `/pm` is open in development, and in a production build
(`npm run build && npm start`) it returns 404 unless `PM_ENABLED=1`. Do not
run it anywhere other people can reach without a password, and serve it over
HTTPS if it leaves your machine.

`hasAccess()` in `access.ts` is the single gate: the layout, every page, every
server action and the assistant endpoint call it.

## Large programs

Any project can also be run as a program. These tabs stay empty until used:

- **Program**: workstreams, each with milestones. A milestone keeps its
  baseline date when its target moves, so slippage is recorded, and can depend
  on other milestones. Health is done / late / dependency conflict / slipped /
  on track, rolled up into a red, amber or green status with reasons.
- **Budget**: lines per workstream with budget, committed, spent and forecast.
  Type amounts as `250M`, `1.2B` or `1,250,000`. Variance is budget minus
  forecast. The approved total is set on the project (Edit).
- **Risks**: risk and issue register. Severity is likelihood x impact for a
  risk and impact alone for an issue.
- **Reports**: "Generate report" builds a markdown status report straight from
  the tracked data, with no AI involved.

`npm run db:seed:program` adds one sample program. Everything in it is
placeholder data.

## Assistant

The Assistant button opens a chat that can answer questions about the tracked
data and make updates (create and update only; it has no delete tools). It
calls the Claude API from the server, so it needs a key:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

Questions and the project data needed to answer them are sent to the Claude
API. Conversation history is kept in the browser tab only. The model, prompt
and tools live in `lib/pm/assistant/`; the endpoint is
`app/pm/api/assistant/route.ts`.

## Layout

| Path | What it holds |
|---|---|
| `prisma/` | Schema, migrations, seed |
| `lib/pm/types.ts`, `dates.ts` | Plain domain types and date helpers (safe to import anywhere) |
| `lib/pm/projects.ts`, `tasks.ts`, `subtasks.ts`, `milestones.ts`, `search.ts` | Data access. The only code that touches Prisma, via `db.ts` |
| `lib/pm/reorder.ts` | Pure task-ordering logic, shared by server and client |
| `lib/pm/workstreams.ts`, `budget.ts`, `risks.ts`, `reports.ts`, `program.ts` | Data access for program features |
| `lib/pm/health.ts`, `money.ts`, `report-builder.ts` | Pure logic: schedule health, budget totals, risk severity, report text |
| `lib/pm/assistant/` | The assistant's tools, prompt and event types |
| `lib/pm/schemas.ts`, `actions.ts` | zod input schemas and the server actions that use them |
| `app/pm/` | Routes: dashboard, and board / list / timeline per project |
| `components/pm/` | UI components |

To swap storage, reimplement the data-access files against the types in
`types.ts`; nothing outside `lib/pm` imports Prisma.

## Shortcuts

- `n` — quick-add a task (Enter saves)
- `Cmd/Ctrl+K` — search task titles and descriptions across projects
- `Esc` — close the open dialog or task panel

A task's side panel opens from `?task=<id>` on any view, so the URL in the
address bar is always shareable.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

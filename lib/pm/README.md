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

- **Daily**: the day's check-in. It lists what needs confirming (milestones
  that are late, due within two weeks or on the critical path; percent
  complete per workstream; lines with money moving; open risks that are high
  severity or due). Answer in place, add notes, then "Finish today's update"
  saves a daily summary to Reports and drafts the team's messages.
- **Team**: team members, each optionally tied to a workstream, and the
  messages drafted for them. The tool never sends anything: edit a draft,
  then Copy it or use "Open in email", and mark it sent yourself.
- **Import / export**: move milestones, budget lines, risks and team members
  to and from other tools as CSV. See below.

Every change to program data is written to an activity log by the data layer,
whichever screen (or the assistant, or an import) made it. That log is what
"what changed today" in the daily summary is built from.

### Timing and cost figures

The Program tab also shows, and `lib/pm/critical-path.ts` and
`lib/pm/performance.ts` compute:

- **Projected finish and critical path.** Each milestone's working duration is
  taken from the baseline: the gap between its baseline date and its latest
  predecessor's. Slippage upstream is then carried through the dependencies to
  give projected dates. Float is how far a milestone can slip before the
  projected finish moves; the critical path is the chain with none. This needs
  dependencies between milestones to mean anything.
- **Earned value** per workstream: budget (BAC), earned value (budget x percent
  complete), actual cost (spent), planned value, cost and schedule variance,
  CPI, SPI and estimate at completion. Planned value spreads each workstream's
  budget evenly between its planned start and finish, which is a
  simplification, so SPI is a rough signal. Without those dates PV and SPI are
  shown as n/a rather than guessed.

### Working with the client's system

Nothing here is tied to one outside tool. The Import / export tab reads CSV
exported from Azure DevOps, MS Project, Primavera or Excel: it recognises
their usual column names (for example Title, State, Area Path, Target Date,
Predecessors, Baseline Finish, Assigned To, BAC, EAC), lets you match any it
doesn't, and reads common date and amount formats. Every import is checked
first, with a line-by-line report, and only then applied. Imports match rows
to existing records by name and update them; they never delete. Exports use
the same columns, so a file can go out, be edited, and come back.

A live connection to a specific system (for example syncing with Azure DevOps
through its API) is not built. The place for one is a module beside
`lib/pm/import.ts` that fetches records and feeds the same import functions.

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

It can also run the daily check-in as a conversation (it asks, you answer, it
updates the tracker, then saves the summary and drafts the team's messages),
report the critical path and earned value, and draft individual messages. It
cannot send messages; drafts land on the Team tab for you to send.

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
| `lib/pm/team.ts`, `communications.ts`, `activity.ts` | Data access for team members, drafted messages and the change log |
| `lib/pm/critical-path.ts`, `performance.ts`, `daily.ts` | Pure logic: projected dates and critical path, earned value, the daily questions, summary and team messages |
| `lib/pm/daily-run.ts` | Loads the daily context and closes out the day (used by the Daily tab and the assistant) |
| `lib/pm/csv.ts`, `interchange.ts`, `import.ts` | CSV reading and writing, column matching and value parsing, applying imports and building exports |
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

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

In a production build (`npm run build && npm start`) `/pm` returns 404 unless
`PM_ENABLED=1` is set. There is no authentication yet; `hasAccess()` in
`access.ts` is the one place to add it (the layout, every page and every
server action already call it).

## Layout

| Path | What it holds |
|---|---|
| `prisma/` | Schema, migrations, seed |
| `lib/pm/types.ts`, `dates.ts` | Plain domain types and date helpers (safe to import anywhere) |
| `lib/pm/projects.ts`, `tasks.ts`, `subtasks.ts`, `milestones.ts`, `search.ts` | Data access. The only code that touches Prisma, via `db.ts` |
| `lib/pm/reorder.ts` | Pure task-ordering logic, shared by server and client |
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

# orchard. — Apple products affiliate storefront (Amazon Associates)

A Next.js 14 (App Router) + Tailwind scaffold for an affiliate site that showcases Apple products
and links out to Amazon for purchase. No cart, no payments — this site is discovery/content only,
by design (see `DISCLOSURE.md` for why that matters for Amazon Associates compliance).

## What's here

```
app/
  page.tsx                 Homepage
  category/[slug]/page.tsx Category grid (iphone, mac, ipad, watch, airpods, accessories)
  product/[id]/page.tsx    Product detail page
  compare/page.tsx         Spec comparison table
  guides/page.tsx          Buying guides / blog listing
  disclosure/page.tsx      Rendered affiliate disclosure page
components/
  Header.tsx, Footer.tsx, ProductCard.tsx, AffiliateButton.tsx
lib/
  products.ts               Product data + mock catalog (swap for live data — see below)
  amazon-api.ts              Stub for Amazon Product Advertising API (PA-API 5.0) integration
DISCLOSURE.md               Standalone legal disclosure draft (have a lawyer review before launch)
```

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Before you launch, in order

1. **Apply to Amazon Associates** (affiliate-program.amazon.com). You need a live, functioning
   site with real content — this scaffold — before Amazon will review your application.
2. **Set your tracking ID.** Replace `YOUR-TAG-20` in `lib/products.ts` with your real Associates
   tag once approved.
3. **Get real product data.** Amazon requires an approved Associates account with at least one
   qualifying sale before issuing Product Advertising API (PA-API) credentials. Until then, this
   scaffold uses hand-maintained mock data in `lib/products.ts` — keep prices timestamped and
   don't let them go stale, per Amazon's terms.
4. **Wire up PA-API.** Once you have credentials, implement `getItemsByAsin` in
   `lib/amazon-api.ts` (Amazon publishes an official Node SDK: `paapi5-nodejs-sdk`), and point
   `lib/products.ts` at it. Recommended: refresh via a scheduled job into a small database/cache
   rather than calling PA-API on every page load — you'll hit rate limits fast otherwise.
5. **Add real product photography** to `/public/images/` and swap the placeholder divs in
   `ProductCard.tsx` / `product/[id]/page.tsx` for `next/image`. Do not use Apple's official
   marketing photography without a license — see `DISCLOSURE.md` §3.
6. **Review and publish `DISCLOSURE.md`** — it's rendered at `/disclosure` and referenced in the
   footer, but read it yourself (and have a lawyer review it) before this goes live; it's a draft.
7. **Add analytics + a real privacy policy** if you're tracking visitors — see `DISCLOSURE.md` §5.

## Design notes

- Tokens live in `tailwind.config.js`: a warm off-white background, near-black ink, a muted forest
  green accent (deliberately distinct from both Amazon's orange and Apple's own palette), and a
  monospace face reserved for prices/specs so numeric data reads distinctly from prose.
- All outbound Amazon links route through `AffiliateButton.tsx` so `rel="nofollow sponsored"` and
  the tracking tag stay consistent everywhere — don't hand-write `<a>` tags to Amazon elsewhere.

## Private project management tool (`/pm`)

A single-user project tracker lives under `/pm`. It is separate from the storefront: nothing in
the storefront links to it, every `/pm` page is `noindex`, and the storefront pages live in the
`app/(storefront)` route group so the two do not share a header or footer.

```bash
cp .env.example .env     # DATABASE_URL="file:./pm.db" (SQLite file in prisma/)
npm install              # also runs `prisma generate`
npm run db:migrate       # create the tables
npm run db:seed          # optional: two sample projects, 15 tasks (wipes existing /pm data)
npm run dev              # http://localhost:3000/pm
```

- **Views:** dashboard (`/pm`), and per project a kanban board, a sortable/filterable list and a
  milestone timeline. A task opens as a side panel on any view via `?task=<id>`.
- **Shortcuts:** `N` adds a task, `Cmd/Ctrl+K` searches all tasks, `Esc` closes.
- **No authentication yet.** In production builds `/pm` returns 404 unless `PM_ENABLED=1` is set.
  `requirePmAccess()` in `lib/pm/access.ts` is the single gate (called from `app/pm/layout.tsx`
  and every server action) — put a real auth check there before exposing the tool anywhere public.
- **Storage:** SQLite via Prisma. All data access is behind the functions in `lib/pm/`
  (`projects.ts`, `tasks.ts`, `subtasks.ts`, `milestones.ts`, `search.ts`); only `lib/pm/db.ts`
  and `lib/pm/mappers.ts` know about Prisma. Mutations go through `lib/pm/actions.ts` (server
  actions, zod-validated).
- **List filters and sort are in the URL** (`?status=…&label=…&sort=due&dir=desc`), so they
  survive a reload and can be bookmarked.
- **Checks:** `npm run lint`, `npm run typecheck`, `npm test` (unit), `npm run build`.
- **End-to-end tests:** `npm run test:e2e` runs the Playwright suite in `e2e/` against a
  production build with its own database (`prisma/e2e.db`, re-seeded each run; your dev data is
  not touched). First time only: `npx playwright install chromium`. It runs `next build`, so stop
  `npm run dev` first.

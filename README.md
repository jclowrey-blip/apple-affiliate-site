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

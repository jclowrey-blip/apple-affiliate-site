# Affiliate Disclosure & Legal Notices

**Site:** orchard. (replace with your actual site name/domain)
**Last updated:** August 16, 2026

> This document is a starting draft, not legal advice. Have an attorney review it before
> publishing, especially the FTC and trademark sections, and adapt it if you operate outside
> the US or add other affiliate/ad programs.

---

## 1. FTC-Required Affiliate Disclosure

This site is a participant in the **Amazon Services LLC Associates Program**, an affiliate
advertising program designed to provide a means for sites to earn advertising fees by advertising
and linking to Amazon.com and affiliated sites.

As required by the U.S. Federal Trade Commission's guidelines on endorsements and testimonials
(16 CFR Part 255):

- We **earn a commission** on qualifying purchases made through links on this site, at no extra
  cost to you.
- This relationship **may influence** which products we choose to write about, though it does not
  change our editorial opinions or ratings.
- This disclosure appears in the site footer (every page), on a dedicated `/disclosure` page, and
  should also be placed **near the top of any blog post or guide** containing affiliate links —
  a footer link alone is not sufficient for content-heavy pages under FTC guidance.

**Recommended placement checklist:**
- [ ] Footer disclosure on every page (implemented — see `components/Footer.tsx`)
- [ ] Dedicated `/disclosure` page (implemented — see `app/disclosure/page.tsx`)
- [ ] Short disclosure statement at the top of every blog/guide post, above the fold
- [ ] Disclosure restated near any embedded product widget/comparison table

---

## 2. Amazon Associates Program Compliance Notes

Per the Amazon Associates Operating Agreement, at minimum:

- **Price/availability display.** Do not display a specific price or "In Stock" claim unless it is
  pulled live (or near-live) from the Product Advertising API. If prices are periodically snapshot
  rather than live, each displayed price must be clearly timestamped and paired with a note to
  check Amazon for current pricing (implemented in `ProductCard.tsx` and `product/[id]/page.tsx`).
- **Link attribution.** All outbound product links must use your Associates tracking ID
  (implemented via `buildAmazonUrl()` in `lib/products.ts`).
- **No incentivized clicks.** Don't offer discounts, cashback, or rewards for clicking Associate
  links.
- **No use of Amazon trademarks/branding** beyond what the Operating Agreement's trademark
  guidelines permit (e.g., don't imply your site *is* Amazon or is officially endorsed by Amazon).
- **No collection of Associates links into a downloadable/offline document, app, or feed** — links
  must be served from the live, publicly accessible website.
- **No cookie-stuffing or link cloaking** — the destination of an Associates link must be
  transparent to the visitor.
- **Review the current Operating Agreement before launch** — Amazon updates these terms
  periodically: https://affiliate-program.amazon.com/help/operating/agreement

---

## 3. Apple Trademark & Content Notes

- Apple product names (iPhone, iPad, Mac, Apple Watch, AirPods, etc.) are used here purely in a
  **nominative/descriptive sense** — to accurately identify the products being discussed — not as
  a claim of affiliation with or endorsement by Apple Inc.
- Do **not** use Apple's logo, custom typography, or official marketing photography without a
  license. Use your own product photography, or images licensed for this purpose (e.g., via the
  Amazon Associates image/content API, where its terms permit affiliate use).
- Avoid page titles, meta descriptions, or ad copy that could imply this is an official Apple
  storefront (e.g., avoid phrasing like "Apple Official Store" or using Apple's exact brand
  typography in your logo).

---

## 4. General Site Disclaimer

- This site does not sell products directly, does not process payments, and does not ship or
  fulfill orders. All transactions occur on Amazon.com under Amazon's own terms of sale.
- Products listed may be sold and/or fulfilled by Amazon or by independent third-party sellers
  operating on Amazon's marketplace. The specific seller and fulfillment method are disclosed on
  each Amazon product listing prior to purchase.
- Specifications, images, and pricing are provided for informational purposes and may contain
  errors or become outdated between updates. Always verify details on the official Amazon listing
  before purchasing.

---

## 5. Privacy / Cookies (placeholder — expand before launch)

If you add analytics (e.g., Google Analytics), affiliate click tracking, or an email newsletter,
you'll also need:

- A **Privacy Policy** describing what data is collected (analytics, email signups, cookies) and
  how it's used/shared.
- A **cookie consent banner** if you have EU/UK/California visitors, depending on applicable law
  (GDPR / ePrivacy / CCPA-CPRA).

These are not included in this scaffold and should be drafted separately based on your actual
analytics/marketing stack.

export default function DisclosurePage() {
  return (
    <div className="py-14 max-w-2xl prose-sm">
      <h1 className="font-display text-3xl text-ink mb-6">Affiliate Disclosure</h1>

      <div className="space-y-5 text-graphite text-sm leading-relaxed">
        <p>Last updated: August 16, 2026</p>

        <p>
          orchard. ("we," "us," "this site") is a participant in the Amazon Services LLC Associates
          Program, an affiliate advertising program designed to provide a means for sites to earn
          advertising fees by advertising and linking to Amazon.com and affiliated sites.
        </p>

        <p>
          <strong className="text-ink">What this means in practice:</strong> when you click a "View
          on Amazon" or similar link on this site and go on to make a qualifying purchase, we may
          earn a commission. This comes at no additional cost to you — the price you pay on Amazon
          is the same whether or not you arrived via our link.
        </p>

        <p>
          <strong className="text-ink">We do not sell products directly.</strong> This site does not
          process payments, hold inventory, or ship products. All purchases are made on Amazon.com
          and are subject to Amazon's own pricing, availability, shipping, return, and customer
          service terms. Products may be sold and fulfilled by Amazon or by third-party sellers on
          Amazon's marketplace — the seller and fulfillment method are shown on the Amazon product
          page before you buy.
        </p>

        <p>
          <strong className="text-ink">Pricing accuracy.</strong> Prices, availability, and product
          details shown on this site are snapshots captured at the time indicated on each page and
          may not reflect the current price on Amazon. Always confirm current pricing and
          availability on Amazon before completing a purchase.
        </p>

        <p>
          <strong className="text-ink">Trademarks.</strong> Apple, iPhone, iPad, Mac, Apple Watch,
          AirPods, and related marks are trademarks of Apple Inc. Amazon, Amazon.com, and the Amazon
          logo are trademarks of Amazon.com, Inc. or its affiliates. This site is not affiliated
          with, endorsed by, or sponsored by Apple Inc. or Amazon.com, Inc., beyond our
          participation in the Amazon Associates Program.
        </p>

        <p>
          <strong className="text-ink">Editorial independence.</strong> Product recommendations,
          ratings, and comparisons reflect our own research and opinion. Commission eligibility does
          not influence which products we choose to feature or how we rank them.
        </p>

        <p>
          Questions about this disclosure can be sent to{" "}
          <a href="mailto:hello@example.com" className="underline text-ink">
            hello@example.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}

const GUIDES = [
  {
    slug: "iphone-16-vs-16-pro",
    title: "iPhone 16 vs 16 Pro: which one actually needs the Pro price",
    excerpt: "The camera and chip gaps that matter, and the ones that don't for most people.",
  },
  {
    slug: "best-apple-accessories",
    title: "The Apple accessories worth buying in 2026",
    excerpt: "Cases, chargers, and docks that hold up — skipping the ones that don't.",
  },
  {
    slug: "ipad-buying-guide",
    title: "iPad buying guide: base, Air, mini, or Pro",
    excerpt: "A short decision tree based on what you'll actually use it for.",
  },
];

export default function GuidesPage() {
  return (
    <div className="py-14 max-w-2xl">
      <h1 className="font-display text-3xl text-ink mb-2">Guides</h1>
      <p className="text-graphite mb-10">Longer-form buying advice, written to help you pick — not to upsell.</p>

      <div className="space-y-8">
        {GUIDES.map((g) => (
          <article key={g.slug} className="border-b border-line pb-8">
            <h2 className="font-display text-xl text-ink">{g.title}</h2>
            <p className="text-graphite mt-2">{g.excerpt}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

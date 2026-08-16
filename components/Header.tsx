import Link from "next/link";

const CATEGORIES = [
  { slug: "iphone", label: "iPhone" },
  { slug: "mac", label: "Mac" },
  { slug: "ipad", label: "iPad" },
  { slug: "watch", label: "Watch" },
  { slug: "airpods", label: "AirPods" },
  { slug: "accessories", label: "Accessories" },
];

export default function Header() {
  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-content mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Link href="/" className="font-display text-lg tracking-tight text-ink">
          orchard<span className="text-accent">.</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-graphite">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`} className="hover:text-ink transition-colors">
              {c.label}
            </Link>
          ))}
          <Link href="/compare" className="hover:text-ink transition-colors">
            Compare
          </Link>
          <Link href="/guides" className="hover:text-ink transition-colors">
            Guides
          </Link>
        </nav>
        <Link
          href="/disclosure"
          className="text-xs text-graphite border border-line rounded-full px-3 py-1 hover:border-graphite transition-colors"
        >
          Affiliate disclosure
        </Link>
      </div>
    </header>
  );
}

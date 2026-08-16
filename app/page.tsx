import Link from "next/link";
import { getProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div className="py-16">
      <section className="grid md:grid-cols-2 gap-10 items-center py-12">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono mb-4">
            Independent guide · not an Apple site
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-tight text-ink">
            Find the right Apple device. Buy it on Amazon.
          </h1>
          <p className="text-graphite mt-5 text-lg max-w-md">
            Specs, comparisons, and honest picks across the current iPhone, Mac, iPad, Watch, and
            AirPods lineups — every listing links straight to Amazon.
          </p>
          <div className="flex gap-3 mt-8">
            <Link
              href="/category/iphone"
              className="rounded-full bg-ink text-paper px-6 py-3 text-sm font-medium hover:bg-graphite transition-colors"
            >
              Browse iPhone
            </Link>
            <Link
              href="/compare"
              className="rounded-full border border-line px-6 py-3 text-sm font-medium hover:border-graphite transition-colors"
            >
              Compare models
            </Link>
          </div>
        </div>
        <div className="aspect-[4/3] bg-white border border-line rounded-2xl flex items-center justify-center text-graphite/40 text-sm">
          hero product image
        </div>
      </section>

      <section className="py-12">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-2xl text-ink">Popular right now</h2>
          <span className="text-xs text-graphite">Prices shown are snapshots — Amazon has current pricing</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

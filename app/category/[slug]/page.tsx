import { getProducts, Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import { notFound } from "next/navigation";

const VALID: Product["category"][] = ["iphone", "mac", "ipad", "watch", "airpods", "accessories"];

export function generateStaticParams() {
  return VALID.map((slug) => ({ slug }));
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  if (!VALID.includes(params.slug as Product["category"])) return notFound();

  const products = await getProducts(params.slug as Product["category"]);

  return (
    <div className="py-14">
      <h1 className="font-display text-3xl text-ink capitalize mb-2">{params.slug}</h1>
      <p className="text-graphite mb-8">
        {products.length} model{products.length === 1 ? "" : "s"} — filter and compare, then buy on
        Amazon.
      </p>

      {/* Filter bar — wire these up to real filtering once the catalog is larger */}
      <div className="flex flex-wrap gap-2 mb-8 text-sm">
        {["Price", "Storage", "Color"].map((f) => (
          <button
            key={f}
            className="border border-line rounded-full px-4 py-1.5 text-graphite hover:border-graphite/60 transition-colors"
          >
            {f} ▾
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-graphite">No products in this category yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

import { getProductById, formatPrice } from "@/lib/products";
import AffiliateButton from "@/components/AffiliateButton";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/ProductCard";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id);
  if (!product) return notFound();

  return (
          <div className="py-14 grid md:grid-cols-2 gap-12">
          <div className="aspect-square bg-white border border-line rounded-2xl flex items-center justify-center text-graphite/25">
          <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <CategoryIcon category={product.category} />
          </svg>
        </div>  
</div>

      <div>
        <h1 className="font-display text-3xl text-ink">{product.name}</h1>
        
        <p className="text-graphite mt-4">{product.blurb}</p>

        <div className="mt-6 border border-line rounded-2xl p-5 bg-white">
          <div className="font-mono text-2xl text-ink">
            {formatPrice(product.priceCents, product.currency)}
          </div>
          <p className="text-xs text-graphite mt-1">
            Price captured {new Date(product.priceCapturedAt).toLocaleString()}. Actual price,
            availability, and shipping details are set by Amazon and the selling party — confirm on
            the product page before buying.
          </p>
          <AffiliateButton href={product.amazonUrl} className="mt-4 w-full" />
        </div>

        <h2 className="font-display text-lg text-ink mt-10 mb-3">Specs</h2>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(product.specs).map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <td className="py-2 text-graphite w-1/3">{k}</td>
                <td className="py-2 text-ink">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

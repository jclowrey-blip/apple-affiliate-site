import Link from "next/link";
import type { Product } from "@/lib/products";
import { formatPrice } from "@/lib/products";
import AffiliateButton from "./AffiliateButton";

export function CategoryIcon({ category }: { category: Product["category"] }) {
  switch (category) {
    case "iphone":
      return (
        <>
          <rect x="18" y="8" width="28" height="48" rx="6" />
          <line x1="24" y1="16" x2="40" y2="16" />
          <circle cx="32" cy="48" r="2.5" fill="currentColor" stroke="none" />
        </>
      );
    case "ipad":
      return (
        <>
          <rect x="10" y="6" width="44" height="52" rx="5" />
          <circle cx="32" cy="52" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
    case "mac":
      return (
        <>
          <rect x="10" y="12" width="44" height="28" rx="2" />
          <path d="M4 46 h56 l-4 8 h-48 z" />
        </>
      );
    case "watch":
      return (
        <>
          <rect x="20" y="20" width="24" height="28" rx="6" />
          <path d="M24 20 l1 -10 h14 l1 10" />
          <path d="M24 48 l1 10 h14 l1 -10" />
          <line x1="44" y1="30" x2="48" y2="30" />
        </>
      );
    case "airpods":
      return (
        <>
          <path d="M22 10 q-6 0 -6 8 v14 q0 6 6 6" />
          <circle cx="22" cy="42" r="4" />
          <path d="M42 10 q6 0 6 8 v14 q0 6 -6 6" />
          <circle cx="42" cy="42" r="4" />
        </>
      );
    case "accessories":
      return (
        <>
          <circle cx="32" cy="32" r="16" />
          <circle cx="32" cy="32" r="4" fill="currentColor" stroke="none" />
        </>
      );
    default:
      return null;
  }
}
export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group border border-line rounded-2xl p-5 flex flex-col bg-white hover:border-graphite/40 transition-colors">
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square bg-paper rounded-xl mb-4 flex items-center justify-center text-graphite/25">
            <svg viewBox="0 0 64 64" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <CategoryIcon category={product.category} />              
            </svg>
          </div>
        <h3 className="font-display text-base text-ink">{product.name}</h3>
      </Link>
      <p className="text-sm text-graphite mt-1 line-clamp-2">{product.blurb}</p>

      <div className="flex items-center justify-between mt-4">
        <div>
          <div className="font-mono text-lg text-ink">
            {formatPrice(product.priceCents, product.currency)}
          </div>
          <div className="text-[11px] text-graphite">
            as of {new Date(product.priceCapturedAt).toLocaleDateString()} — see Amazon for current price
          </div>
        </div>
        <AffiliateButton href={product.amazonUrl} />
      </div>
    </div>
  );
}

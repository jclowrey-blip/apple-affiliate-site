import Link from "next/link";
import type { Product } from "@/lib/products";
import { formatPrice } from "@/lib/products";
import AffiliateButton from "./AffiliateButton";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group border border-line rounded-2xl p-5 flex flex-col bg-white hover:border-graphite/40 transition-colors">
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square bg-paper rounded-xl mb-4 flex items-center justify-center text-graphite/25">
            <svg viewBox="0 0 64 64" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="18" y="8" width="28" height="48" rx="6" />
              <line x1="24" y1="16" x2="40" y2="16" />
              <circle cx="32" cy="48" r="2.5" fill="currentColor" stroke="none" />
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

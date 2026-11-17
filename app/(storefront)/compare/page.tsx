import { getProducts, formatPrice } from "@/lib/products";
import AffiliateButton from "@/components/AffiliateButton";

export default async function ComparePage() {
  const products = await getProducts();

  // Union of all spec keys across the selected products, so the table stays aligned.
  const specKeys = Array.from(new Set(products.flatMap((p) => Object.keys(p.specs))));

  return (
    <div className="py-14">
      <h1 className="font-display text-3xl text-ink mb-2">Compare</h1>
      <p className="text-graphite mb-8">
        Side-by-side specs. In production, let visitors pick 2–4 specific products instead of
        showing the full catalog.
      </p>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-line bg-white">
              <th className="text-left p-4 text-graphite font-normal">Model</th>
              {products.map((p) => (
                <th key={p.id} className="text-left p-4 font-display text-ink min-w-[180px]">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="p-4 text-graphite">Price</td>
              {products.map((p) => (
                <td key={p.id} className="p-4 font-mono text-ink">
                  {formatPrice(p.priceCents, p.currency)}
                </td>
              ))}
            </tr>
            {specKeys.map((key) => (
              <tr key={key} className="border-b border-line">
                <td className="p-4 text-graphite">{key}</td>
                {products.map((p) => (
                  <td key={p.id} className="p-4 text-ink">
                    {p.specs[key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4" />
              {products.map((p) => (
                <td key={p.id} className="p-4">
                  <AffiliateButton href={p.amazonUrl} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

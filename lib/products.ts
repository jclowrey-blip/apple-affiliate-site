// lib/products.ts
//
// This file is the single seam between your site and Amazon.
// Right now it returns mock data so the scaffold runs with zero setup.
// Swap `getProducts` / `getProductById` to call `lib/amazon-api.ts`
// once you have Amazon Product Advertising API (PA-API 5.0) credentials.

export type Product = {
  id: string; // your internal slug
  asin: string; // Amazon Standard Identification Number
  name: string;
  category: "iphone" | "mac" | "ipad" | "watch" | "airpods" | "accessories";
  image: string;
  priceCents: number;
  currency: "USD";
  rating: number; // 0-5
  ratingCount: number;
  specs: Record<string, string>;
  blurb: string;
  amazonUrl: string; // full affiliate URL, tag included
  priceCapturedAt: string; // ISO timestamp — required since price isn't live in this mock
};

// Replace YOUR-TAG-20 with your real Amazon Associates tracking ID.
const ASSOCIATE_TAG = "YOUR-TAG-20";

export function buildAmazonUrl(asin: string) {
  return `https://www.amazon.com/dp/${asin}?tag=${ASSOCIATE_TAG}&linkCode=ogi&th=1&psc=1`;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: "iphone-16-pro",
    asin: "B0DHSZNGZ5",
    name: "Apple iPhone 16 Pro",
    category: "iphone",
    image: "/images/iphone-16-pro.png",
    priceCents: 99900,
    currency: "USD",
    rating: 4.7,
    ratingCount: 3241,
    specs: {
      Display: "6.3-inch Super Retina XDR",
      Chip: "A18 Pro",
      Storage: "128GB",
      Camera: "48MP Fusion + Ultra Wide + Telephoto",
      Battery: "Up to 27 hrs video playback",
    },
    blurb: "The current flagship — best pick for camera quality and long-term chip support.",
    amazonUrl: buildAmazonUrl("B0DHSZNGZ5"),
    priceCapturedAt: "2026-08-15T09:00:00Z",
  },
  {
    id: "macbook-air-m3",
    asin: "B0CX23V2ZK",
    name: "MacBook Air 13-inch (M3)",
    category: "mac",
    image: "/images/macbook-air-m3.png",
    priceCents: 109900,
    currency: "USD",
    rating: 4.8,
    ratingCount: 5810,
    specs: {
      Display: "13.6-inch Liquid Retina",
      Chip: "Apple M3 (8-core CPU)",
      Storage: "256GB SSD",
      Memory: "8GB unified",
      Battery: "Up to 18 hrs",
    },
    blurb: "The default recommendation for most people — light, silent, all-day battery.",
    amazonUrl: buildAmazonUrl("B0CX23V2ZK"),
    priceCapturedAt: "2026-08-15T09:00:00Z",
  },
  {
    id: "ipad-air-m2",
    asin: "B0D3J5WGD6",
    name: "iPad Air 11-inch (M2)",
    category: "ipad",
    image: "/images/ipad-air-m2.png",
    priceCents: 59900,
    currency: "USD",
    rating: 4.6,
    ratingCount: 2117,
    specs: {
      Display: "11-inch Liquid Retina",
      Chip: "Apple M2",
      Storage: "128GB",
      Pencil: "Apple Pencil Pro compatible",
      Battery: "Up to 10 hrs",
    },
    blurb: "Sits between the base iPad and the Pro — enough power for most creative work.",
    amazonUrl: buildAmazonUrl("B0D3J5WGD6"),
    priceCapturedAt: "2026-08-15T09:00:00Z",
  },
  {
    id: "apple-watch-series-10",
    asin: "B0DGHLCYJ7",
    name: "Apple Watch Series 10",
    category: "watch",
    image: "/images/watch-series-10.png",
    priceCents: 39900,
    currency: "USD",
    rating: 4.7,
    ratingCount: 1904,
    specs: {
      Display: "Always-On Retina, larger than Series 9",
      Case: "42mm or 46mm aluminum/titanium",
      Health: "ECG, blood oxygen, sleep apnea notifications",
      Battery: "Up to 18 hrs",
    },
    blurb: "Thinnest Apple Watch yet — the safe default pick this generation.",
    amazonUrl: buildAmazonUrl("B0DGHLCYJ7"),
    priceCapturedAt: "2026-08-15T09:00:00Z",
  },
  {
    id: "airpods-pro-2",
    asin: "B0D1XD1ZV3",
    name: "AirPods Pro 2 (USB-C)",
    category: "airpods",
    image: "/images/airpods-pro-2.png",
    priceCents: 23900,
    currency: "USD",
    rating: 4.8,
    ratingCount: 9021,
    specs: {
      ANC: "2x noise cancellation vs prior gen",
      Chip: "H2",
      Case: "USB-C, MagSafe, speaker + lanyard loop",
      Features: "Hearing Aid feature, Adaptive Audio",
    },
    blurb: "Best all-around earbuds in the lineup — hearing-health features are a genuine differentiator.",
    amazonUrl: buildAmazonUrl("B0D1XD1ZV3"),
    priceCapturedAt: "2026-08-15T09:00:00Z",
  },
];

export async function getProducts(category?: Product["category"]) {
  // TODO: replace with a call into lib/amazon-api.ts for live data
  if (category) return MOCK_PRODUCTS.filter((p) => p.category === category);
  return MOCK_PRODUCTS;
}

export async function getProductById(id: string) {
  return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
}

export function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

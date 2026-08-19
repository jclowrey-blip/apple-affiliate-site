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
  specs: Record<string, string>;
  blurb: string;
  amazonUrl: string; // full affiliate URL, tag included
  priceCapturedAt: string; // ISO timestamp — required since price isn't live in this mock
};

// Replace YOUR-TAG-20 with your real Amazon Associates tracking ID.
const ASSOCIATE_TAG = "orchardapple-20";

export function buildAmazonUrl(asin: string) {
  return `https://www.amazon.com/dp/${asin}?tag=${ASSOCIATE_TAG}&linkCode=ogi&th=1&psc=1`;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: "iphone-17-pro",
    asin: "B0FQG9F2S5",
    name: "iPhone 17 Pro",
    category: "iphone",
    image: "/images/iphone-17-pro.png",
    priceCents: 109900,
    currency: "USD",
    specs: {
      Display: "6.3-inch Super Retina XDR, ProMotion",
      Chip: "A19 Pro",
      Storage: "256GB",
      Camera: "All 48MP rear cameras, 8x optical-quality zoom",
      Battery: "Up to 33 hrs video playback",
    },
    blurb: "The current flagship — best pick for camera quality and long-term chip support.",
    amazonUrl: buildAmazonUrl("B0FQG9F2S5"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "iphone-17",
    asin: "B0FQFM95MD",
    name: "iPhone 17",
    category: "iphone",
    image: "/images/iphone-17.png",
    priceCents: 79900,
    currency: "USD",
    specs: {
      Display: "6.3-inch Super Retina XDR, ProMotion",
      Chip: "A19",
      Storage: "256GB",
      Camera: "All 48MP rear cameras, Center Stage front camera",
      Battery: "Up to 30 hrs video playback",
    },
    blurb: "Nearly all the flagship experience at a lower price — the pick for most people who don't need Pro cameras.",
    amazonUrl: buildAmazonUrl("B0FQFM95MD"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "macbook-air-m5",
    asin: "B0GR1493ZV",
    name: "MacBook Air 13-inch (M5)",
    category: "mac",
    image: "/images/macbook-air-m5.png",
    priceCents: 129900,
    currency: "USD",
    specs: {
      Display: "13.6-inch Liquid Retina",
      Chip: "Apple M5",
      Storage: "512GB SSD",
      Memory: "16GB unified",
      Battery: "Up to 18 hrs",
    },
    blurb: "The default recommendation for most people — light, silent, all-day battery.",
    amazonUrl: buildAmazonUrl("B0GR1493ZV"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "ipad-air-m4",
    asin: "B0GQVBJT4J",
    name: "iPad Air 11-inch (M4)",
    category: "ipad",
    image: "/images/ipad-air-m4.png",
    priceCents: 59900,
    currency: "USD",
    specs: {
      Display: "11-inch Liquid Retina",
      Chip: "Apple M4",
      Storage: "128GB",
      Connectivity: "Wi-Fi 7 with Apple N1",
      Battery: "All-day",
    },
    blurb: "Sits between the base iPad and the Pro — enough power for most creative work.",
    amazonUrl: buildAmazonUrl("B0GQVBJT4J"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "apple-watch-series-11",
    asin: "B0FQFL8PZ5",
    name: "Apple Watch Series 11",
    category: "watch",
    image: "/images/watch-series-11.png",
    priceCents: 39900,
    currency: "USD",
    specs: {
      Display: "Always-On Retina, thinner design",
      Case: "42mm aluminum",
      Health: "ECG, blood oxygen, sleep score, hypertension notifications",
      Battery: "Up to 24 hrs",
    },
    blurb: "Thinnest Apple Watch yet — the safe default pick this generation.",
    amazonUrl: buildAmazonUrl("B0FQFL8PZ5"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "airpods-pro-3",
    asin: "B0FQFB8FMG",
    name: "AirPods Pro 3",
    category: "airpods",
    image: "/images/airpods-pro-3.png",
    priceCents: 24900,
    currency: "USD",
    specs: {
      ANC: "2x more noise cancellation vs. AirPods Pro 2",
      Chip: "H2",
      Case: "USB-C, includes heart rate sensor",
      Features: "Live Translation, Hearing Aid feature, Adaptive Audio",
    },
    blurb: "Best all-around earbuds in the lineup — now with heart-rate sensing and Live Translation.",
    amazonUrl: buildAmazonUrl("B0FQFB8FMG"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
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

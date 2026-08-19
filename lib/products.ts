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
  },  {
    id: "iphone-17-pro-max",
    asin: "B0FQFQG2VL",
    name: "iPhone 17 Pro Max",
    category: "iphone",
    image: "/images/iphone-17-pro-max.png",
    priceCents: 119900,
    currency: "USD",
    specs: {
      Display: "6.9-inch Super Retina XDR, ProMotion",
      Chip: "A19 Pro",
      Storage: "256GB",
      Camera: "All 48MP rear cameras, 8x optical-quality zoom",
      Battery: "Up to 39 hrs video playback",
    },
    blurb: "The largest, longest-lasting iPhone — best pick if screen size and battery life matter most.",
    amazonUrl: buildAmazonUrl("B0FQFQG2VL"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "macbook-pro-14-m5",
    asin: "B0FWD623D1",
    name: "MacBook Pro 14-inch (M5)",
    category: "mac",
    image: "/images/macbook-pro-14-m5.png",
    priceCents: 179900,
    currency: "USD",
    specs: {
      Display: "14.2-inch Liquid Retina XDR",
      Chip: "Apple M5",
      Storage: "1TB SSD",
      Memory: "16GB unified",
      Battery: "Up to 24 hrs",
    },
    blurb: "Steps up from the Air with a brighter XDR display and more sustained performance for heavier workloads.",
    amazonUrl: buildAmazonUrl("B0FWD623D1"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "ipad-11",
    asin: "B0DZ751XN6",
    name: "iPad (A16)",
    category: "ipad",
    image: "/images/ipad-11.png",
    priceCents: 34900,
    currency: "USD",
    specs: {
      Display: "11-inch Liquid Retina",
      Chip: "A16",
      Storage: "128GB",
      Connectivity: "Wi-Fi 6",
      Battery: "All-day",
    },
    blurb: "The budget pick — everything most people need in an iPad, at the lowest price in the lineup.",
    amazonUrl: buildAmazonUrl("B0DZ751XN6"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "ipad-pro-11-m5",
    asin: "B0FWCXJVHN",
    name: "iPad Pro 11-inch (M5)",
    category: "ipad",
    image: "/images/ipad-pro-11-m5.png",
    priceCents: 99900,
    currency: "USD",
    specs: {
      Display: "11-inch Ultra Retina XDR",
      Chip: "Apple M5",
      Storage: "256GB",
      Camera: "12MP front/back, LiDAR Scanner",
      Connectivity: "Wi-Fi 7 with Apple N1",
    },
    blurb: "The top of the iPad line — for people who want a laptop-class tablet for creative or pro work.",
    amazonUrl: buildAmazonUrl("B0FWCXJVHN"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "watch-ultra-3",
    asin: "B0FQFHVZYL",
    name: "Apple Watch Ultra 3",
    category: "watch",
    image: "/images/watch-ultra-3.png",
    priceCents: 79900,
    currency: "USD",
    specs: {
      Case: "49mm titanium",
      Display: "Always-On Retina, 3000 nits",
      Health: "ECG, blood oxygen, hypertension notifications",
      Safety: "Satellite SOS, 5G cellular",
      Battery: "Up to 42 hrs normal use",
    },
    blurb: "The rugged, adventure-ready Watch — for divers, runners, and anyone who wants satellite SOS.",
    amazonUrl: buildAmazonUrl("B0FQFHVZYL"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "airpods-4",
    asin: "B0DGJ7HYG1",
    name: "AirPods 4",
    category: "airpods",
    image: "/images/airpods-4.png",
    priceCents: 17900,
    currency: "USD",
    specs: {
      ANC: "Active Noise Cancellation",
      Chip: "H2",
      Design: "Open-ear fit, shorter stem",
      Case: "USB-C, wireless charging",
    },
    blurb: "The budget AirPods — open-ear comfort with real noise cancellation, for people who don't want an in-ear tip.",
    amazonUrl: buildAmazonUrl("B0DGJ7HYG1"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "apple-pencil-pro",
    asin: "B0D3J71RM7",
    name: "Apple Pencil Pro",
    category: "accessories",
    image: "/images/apple-pencil-pro.png",
    priceCents: 12900,
    currency: "USD",
    specs: {
      Compatibility: "iPad Pro (M4/M5), iPad Air (M2/M3/M4), iPad mini (A17 Pro)",
      Features: "Squeeze, barrel roll, haptic feedback, hover",
      Charging: "Magnetic, wireless",
    },
    blurb: "The essential accessory for anyone using an iPad for drawing, notes, or design work.",
    amazonUrl: buildAmazonUrl("B0D3J71RM7"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "magsafe-charger",
    asin: "B0DGJ4QQ5W",
    name: "Apple MagSafe Charger",
    category: "accessories",
    image: "/images/magsafe-charger.png",
    priceCents: 3900,
    currency: "USD",
    specs: {
      Compatibility: "iPhone 12 and later",
      "Charging speed": "Up to 25W",
      "Cable length": "1 meter",
    },
    blurb: "The simplest way to charge any current iPhone — snaps on magnetically, no fumbling with cables.",
    amazonUrl: buildAmazonUrl("B0DGJ4QQ5W"),
    priceCapturedAt: "2026-08-17T09:00:00Z",
  },
  {
    id: "airtag",
    asin: "B0933BVK6T",
    name: "Apple AirTag",
    category: "accessories",
    image: "/images/airtag.png",
    priceCents: 2900,
    currency: "USD",
    specs: {
      Tracking: "Precision Finding via Ultra Wideband",
      Network: "Find My network",
      Battery: "User-replaceable, ~1 year",
    },
    blurb: "Clip it to keys, a bag, or a suitcase — the easiest way to never lose track of something again.",
    amazonUrl: buildAmazonUrl("B0933BVK6T"),
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

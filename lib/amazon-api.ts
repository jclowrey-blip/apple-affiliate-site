// lib/amazon-api.ts
//
// STUB — wire this up once you're approved for Amazon's Product Advertising
// API (PA-API 5.0). You must be an approved Associate with at least one
// qualifying sale before Amazon issues PA-API credentials.
//
// Docs: https://webservices.amazon.com/paapi5/documentation/
//
// Amazon's operating agreement requires that displayed prices/availability
// stay in sync with what PA-API returns — do NOT hardcode or indefinitely
// cache prices in production. This file is the place to enforce that.

type PaApiCredentials = {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  host: "webservices.amazon.com";
  region: "us-east-1";
};

export function getCredentials(): PaApiCredentials {
  return {
    accessKey: process.env.AMAZON_PAAPI_ACCESS_KEY ?? "",
    secretKey: process.env.AMAZON_PAAPI_SECRET_KEY ?? "",
    partnerTag: process.env.AMAZON_ASSOCIATE_TAG ?? "",
    host: "webservices.amazon.com",
    region: "us-east-1",
  };
}

// Example shape of what you'd implement with Amazon's official SDK
// (paapi5-nodejs-sdk) or a signed fetch request:
//
// export async function getItemsByAsin(asins: string[]) {
//   const creds = getCredentials();
//   // 1. Build a GetItems request with Resources: ["ItemInfo.Title",
//   //    "Offers.Listings.Price", "Images.Primary.Large",
//   //    "CustomerReviews.StarRating", "CustomerReviews.Count"]
//   // 2. Sign the request per AWS Signature V4 (PA-API uses this scheme)
//   // 3. POST to https://webservices.amazon.com/paapi5/getitems
//   // 4. Map the response into the `Product` shape from lib/products.ts
//   // 5. Cache results briefly (minutes, not days) — Amazon's terms
//   //    prohibit stale pricing being presented as current.
// }
//
// Recommended pattern: run this on a scheduled job (e.g. every 30-60 min)
// that refreshes a small database/cache, and have pages read from that
// cache — rather than calling PA-API on every page render, which will
// hit rate limits fast.

export async function getItemsByAsin(_asins: string[]): Promise<never> {
  throw new Error(
    "PA-API integration not yet implemented. See comments in this file, or lib/products.ts for the mock data currently in use."
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow product images served from Amazon's media CDN and your own asset host.
    remotePatterns: [
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
    ],
  },
};

module.exports = nextConfig;

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "orchard. — Apple products, found on Amazon",
  description:
    "Guides, comparisons, and current Amazon listings for iPhone, Mac, iPad, Apple Watch, and AirPods.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

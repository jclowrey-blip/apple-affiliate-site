import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "orchard. — Apple products, found on Amazon",
  description:
    "Guides, comparisons, and current Amazon listings for iPhone, Mac, iPad, Apple Watch, and AirPods.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="max-w-content mx-auto px-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

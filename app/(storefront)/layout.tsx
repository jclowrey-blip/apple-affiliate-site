import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Storefront chrome. Lives in a route group so /pm does not inherit it;
// URLs are unaffected.
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="max-w-content mx-auto px-6">{children}</main>
      <Footer />
    </>
  );
}

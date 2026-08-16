import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="max-w-content mx-auto px-6 py-10 text-sm text-graphite space-y-4">
        <p>
          orchard. is a participant in the Amazon Services LLC Associates Program, an affiliate
          advertising program designed to provide a means for sites to earn advertising fees by
          advertising and linking to Amazon.com. As an Amazon Associate, we earn from qualifying
          purchases.
        </p>
        <p>
          Apple, iPhone, iPad, Mac, Apple Watch, and AirPods are trademarks of Apple Inc. This site
          is not affiliated with, endorsed by, or sponsored by Apple Inc. Product prices and
          availability are accurate as of the date/time indicated on each listing and are subject
          to change on Amazon.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link href="/disclosure" className="underline hover:text-ink">
            Full affiliate disclosure
          </Link>
          <span>&copy; {new Date().getFullYear()} orchard.</span>
        </div>
      </div>
    </footer>
  );
}

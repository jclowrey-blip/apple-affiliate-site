type Props = {
  href: string;
  label?: string;
  className?: string;
};

// Every outbound Amazon link in the site should route through this
// component so tracking + compliance attributes stay consistent.
export default function AffiliateButton({ href, label = "View on Amazon", className = "" }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener"
      className={`inline-flex items-center justify-center rounded-full bg-accent text-paper px-5 py-2.5 text-sm font-medium hover:bg-accentDark transition-colors ${className}`}
    >
      {label}
    </a>
  );
}

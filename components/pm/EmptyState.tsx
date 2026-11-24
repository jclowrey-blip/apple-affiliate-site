export default function EmptyState({
  title,
  children,
  action,
  compact = false,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-line text-center ${
        compact ? "px-4 py-6" : "px-6 py-14"
      }`}
    >
      <p className="font-display text-base text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-graphite">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

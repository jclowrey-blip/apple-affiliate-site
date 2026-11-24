export default function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-graphite">
        <span>
          <span className="font-mono text-ink">{done}</span> / <span className="font-mono">{total}</span>{" "}
          {total === 1 ? "task" : "tasks"} done
        </span>
        <span className="font-mono">{total === 0 ? "–" : `${pct}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} tasks done`}
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

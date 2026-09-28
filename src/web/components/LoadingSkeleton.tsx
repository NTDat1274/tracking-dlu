// src/web/components/LoadingSkeleton.tsx
// Skeleton loaders for smooth async data fetching experience.


export function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 animate-skeleton">
      <div className="h-3 w-24 rounded bg-muted"></div>
      <div className="mt-3 h-8 w-16 rounded bg-muted"></div>
      <div className="mt-2 h-3 w-32 rounded bg-muted"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-lg border border-border bg-card p-4 animate-skeleton">
      {/* Header skeleton */}
      <div className="flex gap-4 border-b border-border pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 flex-1 rounded bg-muted"></div>
        ))}
      </div>
      {/* Rows skeleton */}
      <div className="space-y-3 pt-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 py-2 border-b border-border/40 last:border-0">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 rounded bg-muted"
                style={{ opacity: 0.8 - (c * 0.08) }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentCardSkeleton() {
  return (
    <div className="flex flex-col justify-between h-full rounded-2xl border border-border bg-card p-4 animate-skeleton">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-11 w-11 shrink-0 rounded-full bg-muted mt-0.5"></div>
          <div className="flex-1 space-y-2 min-w-0 pt-0.5">
            <div className="h-4 w-3/4 rounded bg-muted"></div>
            <div className="h-3 w-1/2 rounded bg-muted"></div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-0.5">
          <div className="h-7 w-7 rounded-lg bg-muted"></div>
          <div className="h-7 w-7 rounded-lg bg-muted"></div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
        <div className="h-3 w-16 rounded bg-muted"></div>
        <div className="h-3 w-16 rounded bg-muted"></div>
      </div>
    </div>
  );
}

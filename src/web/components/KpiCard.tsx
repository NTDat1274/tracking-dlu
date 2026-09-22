// src/web/components/KpiCard.tsx
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  dateContext?: string;
  accent?: string;
  icon?: ReactNode;
}

export default function KpiCard({ label, value, sub, dateContext, accent, icon }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>

      <div
        className="mt-1 font-display text-2xl font-bold"
        style={{ color: accent ?? "var(--foreground)" }}
      >
        {value}
      </div>

      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      {dateContext && (
        <div className="mt-2 border-t border-border-subtle pt-2 text-[11px] text-muted-foreground">
          {dateContext}
        </div>
      )}
    </div>
  );
}

// src/web/components/KpiCard.tsx
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  dateContext?: string;
  accent?: string;
  icon?: ReactNode;
  index?: number;
}

export default function KpiCard({ label, value, sub, dateContext, accent, icon, index = 0 }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-xs transition-all duration-200 ease-out hover:border-primary/40 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] animate-item-enter"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground transition-transform duration-200 group-hover:scale-110">{icon}</span>}
      </div>

      <div
        className="mt-1 font-display text-2xl font-bold transition-colors"
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

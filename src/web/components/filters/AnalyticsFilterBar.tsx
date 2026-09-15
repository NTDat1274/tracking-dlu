// src/web/components/filters/AnalyticsFilterBar.tsx
// Filter bar for Analytics with dynamic Class Select.
import type { CameraOption, VisitStatus } from "../../../data/types";
import { CameraSelect, DateRangeFilter, ClassSelect, ResetButton, StatusSelect } from "./FilterAtoms";

export interface AnalyticsFilterState {
  dateFrom: string;
  dateTo: string;
  cameraId: string;
  className: string;
  status: VisitStatus | "All";
}

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilterState;
  cameras: CameraOption[];
  classes: string[];
  resultCount: number;
  onChange: (filters: AnalyticsFilterState) => void;
  onReset: () => void;
}

export default function AnalyticsFilterBar({
  filters,
  cameras,
  classes,
  resultCount,
  onChange,
  onReset,
}: AnalyticsFilterBarProps) {
  const activeCamera = cameras.find((c) => c.id === filters.cameraId);
  const classList = classes || [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(from, to) => onChange({ ...filters, dateFrom: from, dateTo: to })}
        />
        <CameraSelect
          cameras={cameras}
          value={filters.cameraId}
          onChange={(id) => onChange({ ...filters, cameraId: id })}
        />
        <ClassSelect
          classes={classList}
          value={filters.className || ""}
          onChange={(cls) => onChange({ ...filters, className: cls })}
        />
        <StatusSelect
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
        />
        <ResetButton onClick={onReset} />
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">
        Đang xem: {filters.dateFrom} – {filters.dateTo} · {activeCamera?.label ?? "Tất cả camera"} · Lớp: {filters.className || "Tất cả"} · {resultCount} bản ghi
      </p>
    </div>
  );
}

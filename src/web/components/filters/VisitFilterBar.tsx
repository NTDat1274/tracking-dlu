// src/web/components/filters/VisitFilterBar.tsx
// Filter bar for Visits history with dynamic Class Select.
import type { CameraOption, VisitStatus } from "../../../data/types";
import { CameraSelect, DateRangeFilter, ClassSelect, ResetButton, SearchInput, StatusSelect } from "./FilterAtoms";

export interface VisitFilterState {
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  cameraId: string;
  className: string;
  status: VisitStatus | "All";
}

interface VisitFilterBarProps {
  filters: VisitFilterState;
  cameras: CameraOption[];
  classes: string[];
  resultCount: number;
  onChange: (filters: VisitFilterState) => void;
  onReset: () => void;
}

export default function VisitFilterBar({
  filters,
  cameras,
  classes,
  resultCount,
  onChange,
  onReset,
}: VisitFilterBarProps) {
  const classList = classes || [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onChange={(from, to) => onChange({ ...filters, dateFrom: from, dateTo: to })}
        />
        <SearchInput
          value={filters.searchQuery}
          onChange={(q) => onChange({ ...filters, searchQuery: q })}
          placeholder="Tìm theo tên hoặc mã SV..."
        />
        <StatusSelect
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
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
        <ResetButton onClick={onReset} />
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">{resultCount} kết quả lượt đến (sau bộ lọc)</p>
    </div>
  );
}

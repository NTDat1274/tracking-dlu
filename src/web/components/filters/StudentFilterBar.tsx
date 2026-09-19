// src/web/components/filters/StudentFilterBar.tsx
// Filter bar for Students directory with dynamic Class Select.
import type { StudentSortKey, SortDirection } from "../../../data/types";
import { ClassSelect, ResetButton, SearchInput } from "./FilterAtoms";
import { ArrowUp, ArrowDown } from "lucide-react";

export interface StudentFilterState {
  searchQuery: string;
  className: string;
  sortBy: StudentSortKey;
  sortDirection: SortDirection;
}

const SORT_OPTIONS: { key: StudentSortKey; label: string }[] = [
  { key: "totalVisits", label: "Lượt đến" },
  { key: "lastSeen", label: "Lần gần nhất" },
  { key: "avgWaitSecs", label: "T/g chờ TB" },
  { key: "servedRate", label: "Tỷ lệ phục vụ" },
];

interface StudentFilterBarProps {
  filters: StudentFilterState;
  classes: string[];
  resultCount: number;
  onChange: (filters: StudentFilterState) => void;
  onReset: () => void;
}

export default function StudentFilterBar({
  filters,
  classes,
  resultCount,
  onChange,
  onReset,
}: StudentFilterBarProps) {
  const classList = classes || [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          value={filters.searchQuery}
          onChange={(q) => onChange({ ...filters, searchQuery: q })}
          placeholder="Tìm theo tên hoặc mã SV..."
        />

        <ClassSelect
          classes={classList}
          value={filters.className || ""}
          onChange={(cls) => onChange({ ...filters, className: cls })}
        />

        <select
          aria-label="Sắp xếp theo"
          value={filters.sortBy}
          onChange={(e) => onChange({ ...filters, sortBy: e.target.value as StudentSortKey })}
          className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            onChange({ ...filters, sortDirection: filters.sortDirection === "asc" ? "desc" : "asc" })
          }
          aria-label="Đổi hướng sắp xếp"
          className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground flex items-center gap-1 hover:bg-muted"
        >
          {filters.sortDirection === "asc" ? (
            <><ArrowUp size={16} /> Tăng dần</>
          ) : (
            <><ArrowDown size={16} /> Giảm dần</>
          )}
        </button>

        <ResetButton onClick={onReset} />
      </div>

      <p className="mt-2.5 text-xs text-muted-foreground">{resultCount} sinh viên phù hợp</p>
    </div>
  );
}

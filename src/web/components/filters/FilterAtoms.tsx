// src/web/components/filters/FilterAtoms.tsx
import type { CameraOption, VisitStatus } from "../../../data/types";

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="date-from">
        Từ ngày
      </label>
      <input
        id="date-from"
        type="date"
        value={dateFrom}
        onChange={(e) => onChange(e.target.value, dateTo)}
        className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm"
      />
      <span className="text-muted-foreground">—</span>
      <label className="sr-only" htmlFor="date-to">
        Đến ngày
      </label>
      <input
        id="date-to"
        type="date"
        value={dateTo}
        onChange={(e) => onChange(dateFrom, e.target.value)}
        className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm"
      />
    </div>
  );
}

export function CameraSelect({
  cameras,
  value,
  onChange,
}: {
  cameras: CameraOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      aria-label="Chọn camera"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm"
    >
      <option value="">Tất cả camera</option>
      {cameras.map((cam) => (
        <option key={cam.id} value={cam.id}>
          {cam.label}
        </option>
      ))}
    </select>
  );
}

export function ClassSelect({
  classes,
  value,
  onChange,
}: {
  classes: string[];
  value: string;
  onChange: (className: string) => void;
}) {
  return (
    <select
      aria-label="Chọn lớp"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
    >
      <option value="">Tất cả lớp</option>
      {classes.map((cls) => (
        <option key={cls} value={cls}>
          {cls}
        </option>
      ))}
    </select>
  );
}


export function StatusSelect({
  value,
  onChange,
}: {
  value: VisitStatus | "All";
  onChange: (status: VisitStatus | "All") => void;
}) {
  const options: { value: VisitStatus | "All"; label: string }[] = [
    { value: "All", label: "Tất cả trạng thái" },
    { value: "Served", label: "Đã tiếp nhận" },
    { value: "Waiting", label: "Đang chờ" },
    { value: "Unattended", label: "Chưa tiếp nhận" },
  ];

  return (
    <select
      aria-label="Chọn trạng thái"
      value={value}
      onChange={(e) => onChange(e.target.value as VisitStatus | "All")}
      className="focus-ring rounded-md border border-border bg-card px-2 py-1.5 text-sm"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm theo tên hoặc mã SV...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      aria-label="Tìm kiếm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="focus-ring w-full sm:w-56 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
    />
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
    >
      Làm mới bộ lọc
    </button>
  );
}

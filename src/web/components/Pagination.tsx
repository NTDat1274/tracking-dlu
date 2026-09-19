// src/web/components/Pagination.tsx
const PAGE_SIZES = [10, 25, 50] as const;

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: 10 | 25 | 50;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: 10 | 25 | 50) => void;
}

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Trang {page} / {safeTotalPages} · {totalItems} bản ghi
      </span>

      <div className="flex items-center gap-2">
        <label htmlFor="page-size" className="text-muted-foreground">
          Số dòng/trang
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as 10 | 25 | 50)}
          className="focus-ring rounded-md border border-border bg-card px-2 py-1"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
          className="focus-ring rounded-md border border-border bg-card px-2.5 py-1 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
          className="focus-ring rounded-md border border-border bg-card px-2.5 py-1 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

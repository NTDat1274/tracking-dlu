// src/web/components/Pagination.tsx
// Responsive pagination with numbered page buttons and page size selector.
import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_PAGE_SIZES = [10, 25, 50] as const;

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizes?: readonly number[] | number[];
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: any) => void;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizes = DEFAULT_PAGE_SIZES,
  itemLabel = "bản ghi",
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const pages = getPageNumbers(page, safeTotalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground text-xs">
        Trang <span className="font-semibold text-foreground">{page}</span> / {safeTotalPages} · {totalItems} {itemLabel}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {/* Page size dropdown */}
        <div className="flex items-center gap-1.5 mr-1">
          <label htmlFor="page-size" className="text-muted-foreground text-xs hidden sm:inline">
            Hiển thị
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="focus-ring rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground cursor-pointer shadow-xs"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size} / trang
              </option>
            ))}
          </select>
        </div>

        {/* Page navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Trang trước"
            title="Trang trước"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            <ChevronLeft size={15} />
          </button>

          <div className="flex items-center gap-1">
            {pages.map((p, idx) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground select-none"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-label={`Trang ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`focus-ring flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                    p === page
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "border border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            disabled={page >= safeTotalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Trang sau"
            title="Trang sau"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

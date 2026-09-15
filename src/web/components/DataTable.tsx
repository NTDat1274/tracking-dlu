// src/web/components/DataTable.tsx
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-[900px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => {
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${col.className ?? ""}`}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="focus-ring flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      <span aria-hidden="true" className={active ? "text-primary" : "text-border"}>
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border-subtle last:border-0 ${i % 2 === 1 ? "bg-muted/40" : ""} ${onRowClick ? "cursor-pointer hover:bg-primary/5" : ""}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2.5 ${col.className ?? ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

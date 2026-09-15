// src/web/components/ExportModal.tsx
import { useEffect, useRef, useState } from "react";

type ExportFormat = "CSV" | "JSON" | "PDF";
const FORMATS: ExportFormat[] = ["CSV", "JSON", "PDF"];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({ open, onClose }: ExportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerElRef = useRef<Element | null>(null);

  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [dateFrom, setDateFrom] = useState("2026-09-01");
  const [dateTo, setDateTo] = useState("2026-09-04");
  const [statusFilters, setStatusFilters] = useState({ Served: true, Waiting: true, Unattended: true });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      triggerElRef.current = document.activeElement;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    setExporting(false);
    onClose();
    requestAnimationFrame(() => {
      if (triggerElRef.current instanceof HTMLElement) triggerElRef.current.focus();
    });
  }

  function handleExport() {
    setExporting(true);
    window.setTimeout(handleClose, 1200);
  }

  const counts: Record<keyof typeof statusFilters, number> = { Served: 31, Waiting: 9, Unattended: 7 };
  const total = Object.entries(statusFilters)
    .filter(([, v]) => v)
    .reduce((sum, [k]) => sum + counts[k as keyof typeof counts], 0);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="rounded-lg border border-border bg-card p-0 shadow-xl backdrop:bg-black/40"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-[380px] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data Export</p>
        <h2 id="export-dialog-title" className="font-display text-base font-semibold text-foreground">
          Xuất Event Log
        </h2>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Khoảng ngày</p>
        <div className="mt-1.5 flex gap-2">
          <label className="flex-1 text-xs">
            <span className="text-muted-foreground">Từ</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex-1 text-xs">
            <span className="text-muted-foreground">Đến</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Định dạng file</p>
        <div className="mt-1.5 flex gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`focus-ring flex-1 rounded-md border py-1.5 text-sm font-medium ${
                format === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trạng thái</p>
        <div className="mt-1.5 space-y-1.5">
          {(Object.keys(statusFilters) as (keyof typeof statusFilters)[]).map((key) => (
            <label key={key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={statusFilters[key]}
                  onChange={() => setStatusFilters((p) => ({ ...p, [key]: !p[key] }))}
                  className="h-4 w-4 accent-primary"
                />
                {key}
              </span>
              <span className="text-xs text-muted-foreground">{counts[key]} bản ghi</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex justify-between border-t border-border-subtle pt-3 text-xs text-muted-foreground">
          <span>Số lượng dự kiến</span>
          <span className="font-medium text-foreground">{total} bản ghi</span>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="focus-ring mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-blue-700 disabled:opacity-60"
        >
          {exporting ? "Đang xuất..." : `Xuất ${format}`}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="focus-ring mt-2 w-full rounded-md py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          Hủy
        </button>
      </div>
    </dialog>
  );
}

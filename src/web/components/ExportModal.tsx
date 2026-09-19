// src/web/components/ExportModal.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchVisitRecords } from "../../lib/supabase";
import { fmtDuration, type VisitRecord } from "../../data/types";

type ExportFormat = "CSV" | "PDF";
const FORMATS: ExportFormat[] = ["CSV", "PDF"];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({ open, onClose }: ExportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerElRef = useRef<Element | null>(null);

  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [statusFilters, setStatusFilters] = useState({ Served: true, Waiting: true, Unattended: true });
  const [exporting, setExporting] = useState(false);
  const [allRecords, setAllRecords] = useState<VisitRecord[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      fetchVisitRecords().then(setAllRecords);
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

  const baseFiltered = useMemo(() => {
    const start = new Date(dateFrom).getTime();
    const end = new Date(dateTo).getTime() + 86400000;
    return allRecords.filter((r) => {
      const t = new Date(r.enteredAt).getTime();
      return t >= start && t < end;
    });
  }, [allRecords, dateFrom, dateTo]);

  const counts = useMemo(() => {
    return baseFiltered.reduce(
      (acc, curr) => {
        const s = curr.status as keyof typeof statusFilters;
        if (acc[s] !== undefined) acc[s]++;
        return acc;
      },
      { Served: 0, Waiting: 0, Unattended: 0 }
    );
  }, [baseFiltered]);

  const filteredRecords = useMemo(() => {
    return baseFiltered.filter((r) => statusFilters[r.status as keyof typeof statusFilters]);
  }, [baseFiltered, statusFilters]);

  const total = Object.entries(statusFilters)
    .filter(([, v]) => v)
    .reduce((sum, [k]) => sum + counts[k as keyof typeof counts], 0);

  function exportCSV() {
    const headers = ["ID", "Mã SV", "Tên SV", "Lớp", "Giờ vào", "Giờ ra", "Thời lượng", "Trạng thái"];
    const rows = filteredRecords.map((r) => {
      const statusLabels: Record<string, string> = { Served: "Đã tiếp nhận", Waiting: "Đang chờ", Unattended: "Chưa tiếp nhận" };
      return [
        r.id,
        r.studentId,
        r.studentName,
        r.className === "Unknown" ? "Chưa có" : r.className,
        r.enteredAt,
        r.exitedAt || "",
        r.durationSeconds ? fmtDuration(r.durationSeconds) : "",
        statusLabels[r.status] || r.status,
      ];
    });
    const csvContent = "\uFEFF" + [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8-sig;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export_${dateFrom}_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function exportPDF() {
    const doc = new jsPDF("landscape");
    
    // Tải font Roboto (hỗ trợ Tiếng Việt) từ CDN
    const fontUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf";
    const response = await fetch(fontUrl);
    const buffer = await response.arrayBuffer();
    
    // Convert arraybuffer to base64
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Font = btoa(binary);
    
    doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto");

    doc.text("Báo cáo TrackingZ", 14, 15);
    doc.setFontSize(10);
    doc.text(`Từ ngày: ${dateFrom} - Đến ngày: ${dateTo}`, 14, 22);

    autoTable(doc, {
      startY: 25,
      styles: { font: "Roboto", fontStyle: "normal" },
      headStyles: { fillColor: [18, 113, 62] }, // DLU Green
      head: [["ID", "Mã SV", "Tên SV", "Lớp", "Giờ vào", "Giờ ra", "Thời lượng", "Trạng thái"]],
      body: filteredRecords.map((r) => {
        const statusLabels: Record<string, string> = { Served: "Đã tiếp nhận", Waiting: "Đang chờ", Unattended: "Chưa tiếp nhận" };
        return [
          r.id,
          r.studentId,
          r.studentName,
          r.className === "Unknown" ? "Chưa có" : r.className,
          new Date(r.enteredAt).toLocaleString(),
          r.exitedAt ? new Date(r.exitedAt).toLocaleString() : "",
          r.durationSeconds ? fmtDuration(r.durationSeconds) : "",
          statusLabels[r.status] || r.status,
        ];
      }),
    });

    doc.save(`export_${dateFrom}_${dateTo}.pdf`);
  }

  function handleExport() {
    setExporting(true);
    setTimeout(async () => {
      try {
        if (format === "CSV") exportCSV();
        else if (format === "PDF") await exportPDF();
      } catch (err) {
        console.error("Export error:", err);
      } finally {
        handleClose();
      }
    }, 500);
  }

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
      className="m-auto rounded-lg border border-border bg-card p-0 shadow-xl backdrop:bg-black/40"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-[380px] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Xuất Dữ Liệu</p>
        <h2 id="export-dialog-title" className="font-display text-base font-semibold text-foreground">
          Xuất Event Log
        </h2>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Khoảng ngày</p>
        <div className="mt-1.5 flex gap-2">
          <label className="flex-1 text-xs">
            <span className="text-muted-foreground">Từ ngày</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex-1 text-xs">
            <span className="text-muted-foreground">Đến ngày</span>
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
          {(Object.keys(statusFilters) as (keyof typeof statusFilters)[]).map((key) => {
            const statusLabels: Record<string, string> = { Served: "Đã tiếp nhận", Waiting: "Đang chờ", Unattended: "Chưa tiếp nhận" };
            return (
            <label key={key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={statusFilters[key]}
                  onChange={() => setStatusFilters((p) => ({ ...p, [key]: !p[key] }))}
                  className="h-4 w-4 accent-primary"
                />
                {statusLabels[key] || key}
              </span>
              <span className="text-xs text-muted-foreground">{counts[key]} bản ghi</span>
            </label>
          )})}
        </div>

        <div className="mt-4 flex justify-between border-t border-border-subtle pt-3 text-xs text-muted-foreground">
          <span>Số lượng dự kiến</span>
          <span className="font-medium text-foreground">{total} bản ghi</span>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="focus-ring mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {exporting ? "Đang xử lý..." : `Xuất ${format}`}
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

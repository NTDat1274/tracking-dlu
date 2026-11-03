// src/web/components/ExportModal.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchVisitRecords } from "../../lib/supabase";
import { fmtDuration, type VisitRecord } from "../../data/types";

type ExportFormat = "CSV" | "PDF";
const FORMATS: ExportFormat[] = ["CSV", "PDF"];

type ExportSectionKey = "history" | "charts" | "kpi";

const SECTION_DEFINITIONS: { key: ExportSectionKey; label: string; description: string }[] = [
  {
    key: "kpi",
    label: "Báo cáo KPI Tổng hợp",
    description: "Tổng quan các chỉ số quan trọng trong khoảng thời gian đã chọn",
  },
  {
    key: "charts",
    label: "Biểu đồ Thống kê (Donut/Bar Chart)",
    description: "Phân bố trạng thái và số lượt theo thời gian",
  },
  {
    key: "history",
    label: "Bảng Lịch sử lượt ra/vào",
    description: "Chi tiết từng lượt ra/vào theo khoảng ngày đã chọn",
  },
];

const DEFAULT_SECTION_ORDER: ExportSectionKey[] = ["kpi", "charts", "history"];

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
  const [enabledSections, setEnabledSections] = useState<Record<ExportSectionKey, boolean>>({
    history: true,
    charts: true,
    kpi: true,
  });
  const [sectionOrder, setSectionOrder] = useState<ExportSectionKey[]>(DEFAULT_SECTION_ORDER);

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

  const orderedActiveSections = useMemo<ExportSectionKey[]>(() => {
    return sectionOrder.filter((key) => enabledSections[key]);
  }, [sectionOrder, enabledSections]);

  function toggleSectionEnabled(key: ExportSectionKey) {
    setEnabledSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function moveSection(key: ExportSectionKey, direction: "up" | "down") {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

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

  /**
   * Chụp tất cả <canvas> đang hiển thị trên trang (dùng cho biểu đồ dạng canvas)
   * và tất cả <svg class="recharts-surface"> thành DataURL để nhúng vào PDF.
   * Trả về danh sách DataURL; nếu không tìm thấy gì thì trả mảng rỗng.
   */
  function captureChartImages(): string[] {
    const images: string[] = [];
    if (typeof document === "undefined") return images;

    // 1) Chụp các <canvas> (vd: Chart.js, biểu đồ canvas tùy biến)
    const canvases = Array.from(document.querySelectorAll("canvas"));
    for (const c of canvases) {
      try {
        if (c.width > 0 && c.height > 0) {
          images.push(c.toDataURL("image/png"));
        }
      } catch {
        // Bỏ qua nếu canvas bị tainted (CORS)
      }
    }

    // 2) Chụp các SVG của Recharts (Recharts render SVG, không phải canvas)
    const svgs = Array.from(
      document.querySelectorAll<SVGSVGElement>("svg.recharts-surface")
    );
    for (const svg of svgs) {
      try {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        const bbox = svg.getBoundingClientRect();
        const width = bbox.width || svg.clientWidth || 600;
        const height = bbox.height || svg.clientHeight || 300;
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("width", String(width));
        clone.setAttribute("height", String(height));
        const xml = new XMLSerializer().serializeToString(clone);
        const dataUrl =
          "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
        images.push(dataUrl);
      } catch {
        // Bỏ qua nếu serialize thất bại
      }
    }

    return images;
  }

  /**
   * Fallback: vẽ biểu đồ thanh đơn giản bằng jsPDF khi không capture được
   * SVG/canvas nào (giúp báo cáo PDF vẫn có hình minh họa trực quan).
   */
  function drawKpiBarChart(
    doc: jsPDF,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ) {
    const labels = [
      { name: "Đã tiếp nhận", value: counts.Served, color: [34, 139, 34] },
      { name: "Đang chờ", value: counts.Waiting, color: [218, 165, 32] },
      { name: "Chưa tiếp nhận", value: counts.Unattended, color: [178, 34, 34] },
    ];
    const max = Math.max(1, ...labels.map((l) => l.value));
    const labelWidth = 40;
    const barAreaWidth = maxWidth - labelWidth - 20;
    const rowHeight = Math.min(18, maxHeight / labels.length);

    doc.setFont("Roboto");
    doc.setFontSize(9);

    labels.forEach((item, idx) => {
      const rowY = y + idx * rowHeight;
      doc.setTextColor(50, 50, 50);
      doc.text(`${item.name}:`, x, rowY + rowHeight / 2);
      const barX = x + labelWidth;
      const barY = rowY + 4;
      const barH = rowHeight - 8;
      const filled = (item.value / max) * barAreaWidth;
      doc.setFillColor(230, 230, 230);
      doc.rect(barX, barY, barAreaWidth, barH, "F");
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(barX, barY, filled, barH, "F");
      doc.setTextColor(50, 50, 50);
      doc.text(String(item.value), barX + filled + 2, rowY + rowHeight / 2);
    });
  }

  async function exportPDF() {
    // Khổ A4 portrait, đơn vị mm
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;

    // ---- Font Roboto (hỗ trợ tiếng Việt) ----
    const fontUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf";
    try {
      const response = await fetch(fontUrl);
      const buffer = await response.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Font = btoa(binary);
      doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.setFont("Roboto");
    } catch (err) {
      console.warn("Không thể tải font Roboto, dùng font mặc định:", err);
    }

    // ---- HEADER trang bìa ----
    doc.setFont("Roboto");
    doc.setFontSize(14);
    doc.setTextColor(18, 113, 62); // DLU Green
    doc.text(
      "TRƯỜNG ĐẠI HỌC ĐÀ LẠT",
      pageWidth / 2,
      18,
      { align: "center" }
    );
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(
      "HỆ THỐNG ĐIỂM DANH THƯ VIỆN",
      pageWidth / 2,
      25,
      { align: "center" }
    );

    // Đường kẻ ngang phân cách header
    doc.setDrawColor(18, 113, 62);
    doc.setLineWidth(0.6);
    doc.line(marginX, 29, pageWidth - marginX, 29);

    // ---- Thông tin xuất ----
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const exportedAt = new Date().toLocaleString("vi-VN");
    const statusLabels: Record<string, string> = {
      Served: "Đã tiếp nhận",
      Waiting: "Đang chờ",
      Unattended: "Chưa tiếp nhận",
    };
    const activeStatuses = (Object.keys(statusFilters) as (keyof typeof statusFilters)[])
      .filter((k) => statusFilters[k])
      .map((k) => statusLabels[k as string] || k)
      .join(", ");

    doc.text(`Thời gian xuất: ${exportedAt}`, marginX, 36);
    doc.text(`Khoảng thời gian: Từ ${dateFrom} đến ${dateTo}`, marginX, 42);
    doc.text(`Bộ lọc trạng thái: ${activeStatuses || "(không)"}`, marginX, 48);

    // ---- Vẽ lần lượt các thành phần theo orderedActiveSections ----
    let cursorY = 56;
    const sectionLabelMap: Record<ExportSectionKey, string> = {
      kpi: "BÁO CÁO KPI TỔNG HỢP",
      charts: "BIỂU ĐỒ THỐNG KÊ",
      history: "BẢNG LỊCH SỬ RA/VÀO",
    };

    // Đảm bảo còn đủ chỗ trước khi vẽ; nếu không thì thêm trang mới
    const ensureSpace = (needed: number) => {
      if (cursorY + needed > pageHeight - 18) {
        doc.addPage();
        cursorY = 18;
      }
    };

    for (const sectionKey of orderedActiveSections) {
      ensureSpace(20);
      // Tiêu đề section
      doc.setFontSize(12);
      doc.setTextColor(18, 113, 62);
      doc.text(sectionLabelMap[sectionKey], marginX, cursorY);
      doc.setDrawColor(18, 113, 62);
      doc.setLineWidth(0.3);
      doc.line(marginX, cursorY + 2, pageWidth - marginX, cursorY + 2);
      cursorY += 8;

      if (sectionKey === "kpi") {
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const lines = [
          `Tổng lượt ra/vào trong khoảng: ${baseFiltered.length}`,
          `- Đã tiếp nhận (Served): ${counts.Served}`,
          `- Đang chờ (Waiting): ${counts.Waiting}`,
          `- Chưa tiếp nhận (Unattended): ${counts.Unattended}`,
          `- Sau khi áp dụng bộ lọc trạng thái: ${filteredRecords.length} bản ghi`,
        ];
        lines.forEach((line) => {
          ensureSpace(6);
          doc.text(line, marginX, cursorY);
          cursorY += 6;
        });
        cursorY += 4;
      } else if (sectionKey === "charts") {
        const chartImages = captureChartImages();
        if (chartImages.length > 0) {
          // Nhúng các ảnh biểu đồ đã chụp
          for (const dataUrl of chartImages) {
            ensureSpace(70);
            const imgW = contentWidth;
            const imgH = 60; // mm
            try {
              doc.addImage(dataUrl, "PNG", marginX, cursorY, imgW, imgH, undefined, "FAST");
            } catch {
              // Nếu là SVG không raster được, bỏ qua
              doc.setFontSize(9);
              doc.setTextColor(120, 120, 120);
              doc.text("(Không thể nhúng ảnh biểu đồ vào PDF)", marginX, cursorY + 4);
            }
            cursorY += imgH + 4;
          }
        } else {
          // Fallback: vẽ biểu đồ thanh đơn giản ngay trong PDF
          ensureSpace(50);
          drawKpiBarChart(doc, marginX, cursorY, contentWidth, 50);
          cursorY += 56;
        }
      } else if (sectionKey === "history") {
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        const body = filteredRecords.map((r) => [
          r.id,
          r.studentId,
          r.studentName,
          r.className === "Unknown" ? "Chưa có" : r.className,
          new Date(r.enteredAt).toLocaleString(),
          r.exitedAt ? new Date(r.exitedAt).toLocaleString() : "",
          r.durationSeconds ? fmtDuration(r.durationSeconds) : "",
          statusLabels[r.status as string] || r.status,
        ]);

        autoTable(doc, {
          startY: cursorY,
          margin: { left: marginX, right: marginX },
          styles: { font: "Roboto", fontStyle: "normal", fontSize: 8, cellPadding: 1.5 },
          headStyles: {
            fillColor: [18, 113, 62],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 20 },
            2: { cellWidth: 32 },
            3: { cellWidth: 22 },
            4: { cellWidth: 28 },
            5: { cellWidth: 28 },
            6: { cellWidth: 18 },
            7: { cellWidth: 20 },
          },
          head: [["ID", "Mã SV", "Tên SV", "Lớp", "Giờ vào", "Giờ ra", "Thời lượng", "Trạng thái"]],
          body: body.length > 0 ? body : [["(Không có bản ghi nào khớp bộ lọc)", "", "", "", "", "", "", ""]],
        });

        // Sau autoTable, lấy vị trí Y hiện tại để tiếp tục
        const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        cursorY = (lastTable?.finalY ?? cursorY) + 8;
      }
    }

    // ---- FOOTER: đánh số trang Trang X/Y trên mọi trang ----
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("Roboto");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Trang ${i}/${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
      doc.text(
        "Hệ thống Điểm danh Thư viện - Trường ĐH Đà Lạt",
        marginX,
        pageHeight - 8
      );
    }

    doc.save(`BaoCao_${dateFrom}_${dateTo}.pdf`);
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
      className="m-auto rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-modal-zoom"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-[85vw] max-w-[380px] p-5 animate-modal-zoom">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Xuất Dữ Liệu</p>
        <h2 id="export-dialog-title" className="font-display text-base font-semibold text-foreground">
          Xuất Event Log
        </h2>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Khoảng ngày</p>
        <div className="mt-1.5 flex flex-col sm:flex-row gap-2">
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

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thành phần xuất</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Chọn các nội dung sẽ đưa vào file báo cáo và sắp xếp thứ tự ưu tiên hiển thị (mục ở trên cùng sẽ xuất hiện trước trong file).
        </p>
        <ul className="mt-2 space-y-1.5">
          {sectionOrder.map((key, index) => {
            const def = SECTION_DEFINITIONS.find((s) => s.key === key);
            if (!def) return null;
            const isFirst = index === 0;
            const isLast = index === sectionOrder.length - 1;
            return (
              <li
                key={key}
                className="flex items-start justify-between gap-2 rounded-md border border-border-subtle bg-background/40 px-2 py-1.5"
              >
                <label className="flex flex-1 items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabledSections[key]}
                    onChange={() => toggleSectionEnabled(key)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block font-medium text-foreground">{def.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{def.description}</span>
                  </span>
                </label>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSection(key, "up")}
                    disabled={isFirst}
                    aria-label={`Đưa "${def.label}" lên trên`}
                    title="Đưa lên trên"
                    className="focus-ring h-6 w-6 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(key, "down")}
                    disabled={isLast}
                    aria-label={`Đưa "${def.label}" xuống dưới`}
                    title="Đưa xuống dưới"
                    className="focus-ring h-6 w-6 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ▼
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex justify-between border-t border-border-subtle pt-3 text-xs text-muted-foreground">
          <span>Số lượng dự kiến</span>
          <span className="font-medium text-foreground">{total} bản ghi</span>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || orderedActiveSections.length === 0}
          className="focus-ring mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.98] shadow-sm disabled:opacity-60 transition-all duration-200 cursor-pointer"
        >
          {exporting ? "Đang xử lý..." : `Xuất ${format}`}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="focus-ring mt-2 w-full rounded-xl py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          Hủy
        </button>
      </div>
    </dialog>
  );
}

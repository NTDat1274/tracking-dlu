// src/web/components/VisitDetailDrawer.tsx
// Slide-over Drawer for displaying detailed visit record, snapshot, and face crop.
import { useEffect } from "react";
import type { VisitRecord } from "../../data/types";
import { fmtDateTime, fmtDuration } from "../../data/types";
import StatusBadge from "./StatusBadge";
import { SnapshotImage, StudentAvatar } from "./AvatarFallback";

interface VisitDetailDrawerProps {
  record: (VisitRecord & { snapshotUrl?: string; bestCrop?: string }) | null;
  onClose: () => void;
}

export default function VisitDetailDrawer({ record, onClose }: VisitDetailDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slide-over-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md transform border-l border-border bg-card shadow-2xl transition-transform duration-300 sm:max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
              <h2 id="slide-over-title" className="font-display text-base font-bold text-foreground">
                Chi tiết lượt đến · {record.studentId}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Đóng bảng chi tiết"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div className="h-[calc(100vh-65px)] overflow-y-auto p-5 space-y-6">
            {/* Student Info Card */}
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <StudentAvatar
                  src={record.bestCrop || (record as any).portraitUrl}
                  name={record.studentName}
                  size="lg"
                />
                <div>
                  <p className="font-display text-base font-bold text-foreground">
                    {record.studentName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mã SV: <span className="font-mono text-primary font-bold">{record.studentId}</span> · Lớp: {record.className}
                  </p>
                </div>
              </div>
              <StatusBadge status={record.status} />
            </div>

            {/* AI Best Face Crop & Camera Snapshot */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bằng chứng nhận diện AI (Cloudinary)
              </h3>
              
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-foreground">Ảnh khuôn mặt (Best Crop)</p>
                  <SnapshotImage
                    src={record.bestCrop || (record as any).portraitUrl}
                    alt="Best face crop"
                    className="h-44 w-full"
                    label="Khuôn mặt rõ nhất"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-foreground">Snapshot toàn cảnh (Camera)</p>
                  <SnapshotImage
                    src={record.snapshotUrl}
                    alt="Full scene snapshot"
                    className="h-44 w-full"
                    label={record.cameraId}
                  />
                </div>
              </div>
            </div>

            {/* Detailed Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Mốc thời gian chi tiết
              </h3>

              <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Camera giám sát:</span>
                  <span className="font-semibold text-foreground">{record.cameraId} (Service Area)</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Thời điểm vào:</span>
                  <span className="font-semibold text-primary">{fmtDateTime(record.enteredAt)}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Thời điểm ra:</span>
                  <span className="font-semibold text-foreground">
                    {record.exitedAt ? fmtDateTime(record.exitedAt) : "Đang có mặt trong phòng"}
                  </span>
                </div>

                <div className="border-t border-border/50 pt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Thời gian chờ:</span>
                  <span className="font-semibold text-secondary">{fmtDuration(record.waitSeconds)}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Tổng thời gian lưu lại:</span>
                  <span className="font-bold text-foreground text-sm">
                    {fmtDuration(record.durationSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Metadata */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-[11px] text-muted-foreground space-y-1">
              <p>Mã bản ghi hệ thống: <span className="font-mono text-foreground">{record.id}</span></p>
              <p>Chế độ đồng bộ: <span className="text-primary font-medium">Supabase Realtime Stream</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// src/web/components/VisitDetailDrawer.tsx
// Slide-over Drawer for displaying detailed visit record, snapshot, and face crop.
import { useEffect, useState } from "react";
import type { VisitRecord } from "../../data/types";
import { fmtDateTime, fmtDuration } from "../../data/types";
import StatusBadge from "./StatusBadge";
import { X } from "lucide-react";
import { SnapshotImage, StudentAvatar } from "./AvatarFallback";

interface VisitDetailDrawerProps {
  record: (VisitRecord & { snapshotUrl?: string; bestCrop?: string }) | null;
  onClose: () => void;
}

export default function VisitDetailDrawer({ record, onClose }: VisitDetailDrawerProps) {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFullscreenImage(null);
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
        />

        <div className="absolute inset-y-0 right-0 flex max-w-full">
          <div className="w-full w-[400px] transform bg-card shadow-2xl transition-transform duration-300 sm:w-[450px]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-sm font-bold text-foreground">Chi tiết bản ghi</h2>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="h-[calc(100vh-65px)] overflow-y-auto p-5 space-y-6">
              {/* Student Info Card */}
              <div className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-background/60 p-4">
                <div className="flex w-2/3 items-center gap-3 pr-2">
                  <StudentAvatar
                    src={record.avatarUrl}
                    name={record.studentName}
                    size="lg"
                  />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-display text-base font-bold text-foreground break-words leading-tight">
                      {record.studentName}
                    </p>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Mã SV: <span className="font-mono text-primary font-bold">{record.studentId}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Lớp: {record.className === "Unknown" ? "Chưa có" : record.className}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex w-1/3 justify-end items-center">
                  <StatusBadge status={record.status} />
                </div>
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
                      onClick={() => setFullscreenImage(record.bestCrop || (record as any).portraitUrl)}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-foreground">Snapshot toàn cảnh (Camera)</p>
                    <SnapshotImage
                      src={record.snapshotUrl}
                      alt="Full scene snapshot"
                      className="h-44 w-full"
                      label={record.cameraId}
                      onClick={() => setFullscreenImage(record.snapshotUrl || null)}
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
      
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 md:p-12 cursor-zoom-out backdrop-blur-sm"
          onClick={() => setFullscreenImage(null)}
        >
          <img 
            src={fullscreenImage} 
            alt="Fullscreen view" 
            className="h-full w-full object-contain"
          />
          <button 
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenImage(null);
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}

// src/web/components/StudentDetailDrawer.tsx
// Slide-over Drawer for viewing comprehensive student dossier, KPI statistics, and visit history.
import { useEffect } from "react";
import type { StudentSummary, VisitRecord } from "../../data/types";
import { fmtDateTime, fmtDuration } from "../../data/types";
import StatusBadge from "./StatusBadge";
import { StudentAvatar } from "./AvatarFallback";
import { X, Edit2, Trash2, Calendar, CheckCircle2, Clock, UserCheck } from "lucide-react";

interface StudentDetailDrawerProps {
  student: (StudentSummary & { portraitUrl?: string }) | null;
  history: VisitRecord[];
  onClose: () => void;
  onEdit: (student: StudentSummary & { portraitUrl?: string }, e: React.MouseEvent) => void;
  onDelete: (student: StudentSummary, e: React.MouseEvent) => void;
}

export default function StudentDetailDrawer({
  student,
  history,
  onClose,
  onEdit,
  onDelete,
}: StudentDetailDrawerProps) {
  // Close drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop overlay with smooth blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-y-0 right-0 flex max-w-full">
        <aside className="w-[92vw] max-w-[560px] transform bg-card shadow-2xl transition-transform duration-300 flex flex-col h-full border-l border-border animate-fade-in-up">
          {/* Drawer Top Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0 bg-card">
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Hồ sơ chi tiết sinh viên</h2>
              <p className="text-xs text-muted-foreground">Thông tin trích xuất nhận diện AI & lịch sử vào/ra</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Đóng (Esc)"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Student Hero Profile Card */}
            <div className="rounded-2xl border border-border/80 bg-background/50 p-5 shadow-xs">
              <div className="flex items-start gap-4">
                <StudentAvatar src={student.portraitUrl} name={student.name} size="xl" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-bold text-foreground break-words leading-snug">
                    {student.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    MSSV: <span className="font-mono text-primary font-bold">{student.studentId}</span>
                    <span className="mx-1.5 text-muted-foreground/60">·</span>
                    <span>Lớp / Khoa: {student.className}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(e) => onEdit(student, e)}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} /> Sửa thông tin
                    </button>
                    <button
                      type="button"
                      onClick={(e) => onDelete(student, e)}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-offline/40 bg-offline/10 px-3 py-1.5 text-xs font-semibold text-offline hover:bg-offline/20 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} /> Xóa sinh viên
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 StatBlocks - KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Tổng lượt đến"
                value={String(student.totalVisits)}
                icon={<Calendar size={15} className="text-muted-foreground" />}
              />
              <StatCard
                label="Lượt tiếp nhận"
                value={String(student.servedCount)}
                icon={<CheckCircle2 size={15} className="text-primary" />}
              />
              <StatCard
                label="T/g chờ trung bình"
                value={fmtDuration(student.avgWaitSecs)}
                icon={<Clock size={15} className="text-secondary" />}
              />
              <StatCard
                label="Tỷ lệ tiếp nhận"
                value={`${student.totalVisits ? Math.round((student.servedCount / student.totalVisits) * 100) : 0}%`}
                icon={<UserCheck size={15} className="text-primary" />}
              />
            </div>

            {/* Visit History Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Lịch sử ra/vào phòng gần nhất
                </h4>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {history.length} bản ghi
                </span>
              </div>

              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Chưa có lượt đến nào được ghi nhận cho sinh viên này.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/80 bg-background/30 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground font-semibold whitespace-nowrap">
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Thời gian vào</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Thời gian ra</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Thời gian ở</th>
                          <th className="px-3.5 py-2.5 whitespace-nowrap">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {history.map((h) => (
                          <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3.5 py-2.5 text-foreground font-medium whitespace-nowrap">
                              {fmtDateTime(h.enteredAt)}
                            </td>
                            <td className="px-3.5 py-2.5 text-foreground font-medium whitespace-nowrap">
                              {h.exitedAt ? (
                                fmtDateTime(h.exitedAt)
                              ) : (
                                <span className="text-primary font-semibold">Đang ở</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-muted-foreground whitespace-nowrap">
                              {fmtDuration(h.durationSeconds)}
                            </td>
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              <StatusBadge status={h.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Tip */}
          <div className="border-t border-border px-6 py-3 bg-muted/20 text-center text-[11px] text-muted-foreground shrink-0">
            Mẹo: Nhấn <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground border border-border">Esc</kbd> hoặc click bên ngoài để đóng
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs">
      <div className="flex items-center justify-between text-muted-foreground text-[11px]">
        <span>{label}</span>
        {icon}
      </div>
      <p className="font-display text-lg font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

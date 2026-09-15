// src/web/pages/StudentsPage.tsx
// Comprehensive Student Enrolment and Directory Management with Cloudinary & Supabase.
import { useMemo, useState, useEffect } from "react";
import StudentFilterBar, { type StudentFilterState } from "../components/filters/StudentFilterBar";
import ConfirmDialog from "../components/ConfirmDialog";
import { NoResultState, EmptyState } from "../components/StateViews";
import { StudentCardSkeleton } from "../components/LoadingSkeleton";
import { StudentAvatar } from "../components/AvatarFallback";
import StudentModal, { type StudentFormData } from "../components/StudentModal";
import { fetchStudents, deleteStudentCascade, fetchVisitRecords, fetchDistinctClasses } from "../../lib/supabase";
import { fmtDateTime, fmtDuration, isWaitingTooLong, type StudentSummary, type VisitRecord } from "../../data/types";

interface StudentsPageProps {
  filters: StudentFilterState;
  onFiltersChange: (filters: StudentFilterState) => void;
  onReset: () => void;
}

export default function StudentsPage({ filters, onFiltersChange, onReset }: StudentsPageProps) {
  const [students, setStudents] = useState<Array<StudentSummary & { portraitUrl?: string }>>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editStudentData, setEditStudentData] = useState<StudentFormData | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StudentSummary | null>(null);

  // Load students, visits and distinct classes
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      const [stuData, visData, classList] = await Promise.all([
        fetchStudents(),
        fetchVisitRecords(),
        fetchDistinctClasses(),
      ]);
      if (mounted) {
        setStudents(stuData);
        setVisits(visData);
        setClasses(classList);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const targetClass = filters.className;
  const filtered = students.filter((s) => {
    if (targetClass && s.className.toLowerCase() !== targetClass.toLowerCase()) return false;
    if (
      filters.searchQuery &&
      !s.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
      !s.studentId.toLowerCase().includes(filters.searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      if (filters.sortBy === "servedRate") {
        av = a.totalVisits ? a.servedCount / a.totalVisits : 0;
        bv = b.totalVisits ? b.servedCount / b.totalVisits : 0;
      } else if (filters.sortBy === "lastSeen") {
        av = new Date(a.lastSeen).getTime();
        bv = new Date(b.lastSeen).getTime();
      } else {
        av = (a as any)[filters.sortBy];
        bv = (b as any)[filters.sortBy];
      }

      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return filters.sortDirection === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, filters.sortBy, filters.sortDirection]);

  const selected = students.find((s) => s.studentId === selectedId) ?? null;
  const history = visits.filter((r) => r.studentId === selectedId).slice(0, 8);

  function handleOpenAdd() {
    setEditStudentData(null);
    setModalOpen(true);
  }

  function handleOpenEdit(stu: StudentSummary & { portraitUrl?: string }, e: React.MouseEvent) {
    e.stopPropagation();
    setEditStudentData({
      student_id: stu.studentId,
      full_name: stu.name,
      class_name: stu.className,
      email: `${stu.studentId.toLowerCase()}@dlu.edu.vn`,
      portrait_url: stu.portraitUrl || "",
    });
    setModalOpen(true);
  }

  function handleOpenDelete(stu: StudentSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteCandidate(stu);
  }

  async function handleConfirmDelete() {
    if (!deleteCandidate) return;
    const targetId = deleteCandidate.studentId;

    // Clean up student and associated records
    await deleteStudentCascade(targetId);

    setStudents((prev) => prev.filter((s) => s.studentId !== targetId));
    setVisits((prev) => prev.filter((r) => r.studentId !== targetId));
    if (selectedId === targetId) setSelectedId(null);
    setDeleteCandidate(null);
  }

  function handleModalSuccess(saved: StudentFormData) {
    if (saved.class_name) {
      setClasses((prev) => Array.from(new Set([...prev, saved.class_name])).sort());
    }

    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.studentId === saved.student_id);
      const updated: StudentSummary & { portraitUrl?: string } = {
        studentId: saved.student_id,
        name: saved.full_name,
        className: saved.class_name,
        totalVisits: idx >= 0 ? prev[idx].totalVisits : 0,
        servedCount: idx >= 0 ? prev[idx].servedCount : 0,
        avgWaitSecs: idx >= 0 ? prev[idx].avgWaitSecs : 0,
        lastSeen: new Date().toISOString(),
        lastCameraId: "CAM-01",
        currentlyInArea: false,
        portraitUrl: saved.portrait_url,
      };

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header Bar with Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Danh sách Hồ sơ Sinh viên & Khuôn mặt
          </h2>
          <p className="text-xs text-muted-foreground">
            Quản lý hồ sơ trích xuất vector khuôn mặt cho mô hình nhận diện AI tại trường Đại học Đà Lạt
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="focus-ring flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm transition-opacity"
        >
          <span className="text-sm font-black">+</span>
          Thêm Sinh Viên Mới
        </button>
      </div>

      <StudentFilterBar
        filters={filters}
        classes={classes}
        resultCount={sorted.length}
        onChange={onFiltersChange}
        onReset={onReset}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StudentCardSkeleton key={i} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState message="Chưa có hồ sơ sinh viên nào. Vui lòng bấm '+ Thêm Sinh Viên Mới'." />
      ) : sorted.length === 0 ? (
        <NoResultState message="Không tìm thấy sinh viên phù hợp với từ khóa." onReset={onReset} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <div
              key={s.studentId}
              onClick={() => setSelectedId(s.studentId)}
              className={`rounded-2xl border bg-card p-4 transition-all duration-200 cursor-pointer ${
                selectedId === s.studentId
                  ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                  : "border-border hover:border-primary/50 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StudentAvatar src={s.portraitUrl} name={s.name} size="md" />
                  <div>
                    <p className="font-display text-sm font-bold text-foreground hover:text-primary transition-colors">
                      {s.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono text-foreground/90 font-medium">{s.studentId}</span> · {s.className}
                    </p>
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Chỉnh sửa sinh viên"
                    onClick={(e) => handleOpenEdit(s, e)}
                    className="focus-ring rounded-lg border border-border/80 p-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    title="Xóa sinh viên"
                    onClick={(e) => handleOpenDelete(s, e)}
                    className="focus-ring rounded-lg border border-offline/40 bg-offline/10 p-1.5 text-xs text-offline hover:bg-offline/20 transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                <span>Tổng lượt: <strong className="text-foreground">{s.totalVisits}</strong></span>
                <span>Đã tiếp nhận: <strong className="text-primary">{s.servedCount}</strong></span>
              </div>

              {isWaitingTooLong(s.currentStatus, s.currentWaitSeconds) && (
                <p className="mt-2 text-xs font-semibold text-secondary flex items-center gap-1">
                  <span>⚠</span> Chờ tiếp nhận quá 5 phút
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected Student Detail Panel */}
      {selected && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in-up">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <StudentAvatar src={selected.portraitUrl} name={selected.name} size="xl" />
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{selected.name}</h3>
                <p className="text-xs text-muted-foreground">
                  MSSV: <span className="font-mono text-primary font-bold">{selected.studentId}</span> · Lớp / Khoa: {selected.className}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleOpenEdit(selected, e)}
                    className="focus-ring inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    ✎ Sửa thông tin
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleOpenDelete(selected, e)}
                    className="focus-ring inline-flex items-center gap-1 rounded-lg border border-offline/40 bg-offline/10 px-3 py-1 text-xs font-semibold text-offline hover:bg-offline/20 transition-colors"
                  >
                    🗑 Xóa sinh viên
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="focus-ring rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕ Đóng
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBlock label="Tổng lượt đến" value={String(selected.totalVisits)} />
            <StatBlock label="Lượt tiếp nhận" value={String(selected.servedCount)} />
            <StatBlock label="T/g chờ trung bình" value={fmtDuration(selected.avgWaitSecs)} />
            <StatBlock
              label="Tỷ lệ tiếp nhận"
              value={`${selected.totalVisits ? Math.round((selected.servedCount / selected.totalVisits) * 100) : 0}%`}
            />
          </div>

          <h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Lịch sử ra/vào phòng của sinh viên
          </h4>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border/80">
            {history.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">Chưa có lượt đến nào được ghi nhận.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground font-semibold">
                    <th className="px-3 py-2.5">Thời gian vào</th>
                    <th className="px-3 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5">Thời gian ở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-3 py-2 text-foreground font-medium">{fmtDateTime(h.enteredAt)}</td>
                      <td className="px-3 py-2 text-primary font-semibold">{h.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDuration(h.durationSeconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Student Modal */}
      <StudentModal
        open={modalOpen}
        initialData={editStudentData}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      {/* Confirm Delete Dialog (Cascade cleanup) */}
      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="Xóa hồ sơ sinh viên?"
        message={`Bạn có chắc chắn muốn xóa sinh viên ${deleteCandidate?.name} (${deleteCandidate?.studentId})? Toàn bộ dữ liệu hồ sơ và các bản ghi lịch sử ra/vào liên quan sẽ được dọn dẹp sạch sẽ.`}
        confirmLabel="Xác nhận xóa sạch"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-base font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

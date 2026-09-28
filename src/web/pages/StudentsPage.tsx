// src/web/pages/StudentsPage.tsx
// Comprehensive Student Enrolment and Directory Management with Cloudinary & Supabase.
import { useMemo, useState, useEffect } from "react";
import StudentFilterBar, { type StudentFilterState } from "../components/filters/StudentFilterBar";
import ConfirmDialog from "../components/ConfirmDialog";
import { NoResultState, EmptyState } from "../components/StateViews";
import { StudentCardSkeleton } from "../components/LoadingSkeleton";
import { StudentAvatar } from "../components/AvatarFallback";
import StudentModal, { type StudentFormData } from "../components/StudentModal";
import StudentDetailDrawer from "../components/StudentDetailDrawer";
import Pagination from "../components/Pagination";
import { fetchStudents, deleteStudentCascade, fetchVisitRecords, fetchDistinctClasses } from "../../lib/supabase";
import { isWaitingTooLong, type StudentSummary, type VisitRecord } from "../../data/types";
import { Trash2, AlertTriangle, Edit2, Plus } from "lucide-react";

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

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(12);

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

  const enrichedStudents = useMemo(() => {
    return students.map((s) => {
      const stuVisits = visits.filter((v) => v.studentId === s.studentId);
      const totalVisits = stuVisits.length;
      const servedCount = stuVisits.filter((v) => v.status === "Served").length;
      let avgWaitSecs = 0;
      if (totalVisits > 0) {
        const sum = stuVisits.reduce((acc, v) => acc + (v.waitSeconds || 0), 0);
        avgWaitSecs = Math.round(sum / totalVisits);
      }
      return {
        ...s,
        totalVisits,
        servedCount,
        avgWaitSecs,
      };
    });
  }, [students, visits]);

  const targetClass = filters.className;
  const filtered = enrichedStudents.filter((s) => {
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

  // Compute pagination over sorted results
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const pageStudents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  function handleFiltersChange(newFilters: StudentFilterState) {
    setPage(1);
    onFiltersChange(newFilters);
  }

  function handleResetFilters() {
    setPage(1);
    onReset();
  }

  const selected = enrichedStudents.find((s) => s.studentId === selectedId) ?? null;
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
          <Plus size={16} className="shrink-0" />
          Thêm Sinh Viên Mới
        </button>
      </div>

      <StudentFilterBar
        filters={filters}
        classes={classes}
        resultCount={sorted.length}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <StudentCardSkeleton key={i} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState message="Chưa có hồ sơ sinh viên nào. Vui lòng bấm '+ Thêm Sinh Viên Mới'." />
      ) : sorted.length === 0 ? (
        <NoResultState message="Không tìm thấy sinh viên phù hợp với từ khóa." onReset={handleResetFilters} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {pageStudents.map((s) => (
              <div
                key={s.studentId}
                onClick={() => setSelectedId(s.studentId)}
                className={`group flex flex-col justify-between h-full rounded-2xl border bg-card p-4 transition-all duration-200 cursor-pointer ${
                  selectedId === s.studentId
                    ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/50 hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <StudentAvatar src={s.portraitUrl} name={s.name} size="md" className="shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <h3
                          title={s.name}
                          className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate"
                        >
                          {s.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          <span className="font-mono text-foreground/90 font-medium">{s.studentId}</span>
                          <span className="mx-1 text-muted-foreground/60">·</span>
                          <span>{s.className}</span>
                        </p>
                      </div>
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-0.5">
                      <button
                        type="button"
                        title="Chỉnh sửa sinh viên"
                        onClick={(e) => handleOpenEdit(s, e)}
                        className="focus-ring rounded-lg border border-border/80 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        title="Xóa sinh viên"
                        onClick={(e) => handleOpenDelete(s, e)}
                        className="focus-ring rounded-lg border border-offline/40 bg-offline/10 p-1.5 text-offline hover:bg-offline/20 hover:border-offline/60 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isWaitingTooLong(s.currentStatus, s.currentWaitSeconds) && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>Chờ tiếp nhận quá 5 phút</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <span>Tổng lượt: <strong className="text-foreground font-semibold">{s.totalVisits}</strong></span>
                  <span>Đã tiếp nhận: <strong className="text-primary font-semibold">{s.servedCount}</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Bar for manageable browsing */}
          {sorted.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={sorted.length}
                pageSize={pageSize}
                pageSizes={[12, 24, 48]}
                itemLabel="sinh viên"
                onPageChange={setPage}
                onPageSizeChange={(sz) => {
                  setPageSize(sz);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Slide-over Student Detail Drawer */}
      <StudentDetailDrawer
        student={selected}
        history={history}
        onClose={() => setSelectedId(null)}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
      />

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

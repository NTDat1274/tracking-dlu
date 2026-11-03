// src/web/pages/StudentApprovalPage.tsx
// Task 4.1 — Trang "Phê duyệt Hồ sơ Sinh viên" dành cho Admin.
//
// Cung cấp:
//   - Danh sách các hồ sơ chờ duyệt (status='pending') lấy từ
//     `pending_students` Supabase table.
//   - Hiển thị: Ảnh chụp Webcam, MSSV, Họ tên, Lớp, Email, thời điểm gửi.
//   - 03 hành động trên mỗi hồ sơ:
//       1) "Chấp nhận" (Approve)  -> promote sang `students` chính.
//       2) "Từ chối"   (Reject)   -> đánh status='rejected' kèm reviewNote.
//       3) "Duyệt tất cả ảnh hợp lệ" (Batch Approve) để Admin xử lý
//          nhanh danh sách 200+ hồ sơ trong một cú click.
//   - Realtime: tự động refresh khi có bản ghi mới từ Student Portal.

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Layers,
  Clock,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCheck,
  Hourglass,
  ImageOff,
  Hourglass as HourglassIcon,
} from "lucide-react";
import {
  fetchPendingStudents,
  subscribeToPendingStudents,
  approvePendingStudent,
  rejectPendingStudent,
  batchApproveValidPendingStudents,
} from "../../lib/supabase";
import type {
  PendingStudentRecord,
  PendingStudentStatus,
} from "../../data/types";
import { EmptyState, LoadingState, ErrorState } from "../components/StateViews";
import { StudentAvatar } from "../components/AvatarFallback";
import Pagination from "../components/Pagination";
import { useAuth } from "../../context/AuthContext";

type FilterKey = PendingStudentStatus | "all";

const FILTER_TABS: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
  { key: "pending", label: "Chờ duyệt", icon: <HourglassIcon size={14} /> },
  { key: "approved", label: "Đã duyệt", icon: <CheckCircle2 size={14} /> },
  { key: "rejected", label: "Đã từ chối", icon: <XCircle size={14} /> },
  { key: "all", label: "Tất cả", icon: <Layers size={14} /> },
];

export default function StudentApprovalPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PendingStudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [flashMsg, setFlashMsg] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  async function loadAll(filter: FilterKey = activeFilter) {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPendingStudents(filter);
      setRecords(list);
    } catch (err: any) {
      console.warn("Failed to load pending students:", err);
      setError(err?.message || "Không thể tải danh sách hồ sơ chờ duyệt.");
    } finally {
      setLoading(false);
    }
  }

  // Initial load + reload when filter changes
  useEffect(() => {
    loadAll(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Realtime subscription (any insert/update/delete -> refresh)
  useEffect(() => {
    const sub = subscribeToPendingStudents(() => {
      loadAll(activeFilter);
    });
    return () => {
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.student_id.toLowerCase().includes(q) ||
        (r.full_name || "").toLowerCase().includes(q) ||
        (r.class_name || "").toLowerCase().includes(q),
    );
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const stats = useMemo(() => {
    const pending = records.filter((r) => r.status === "pending").length;
    const approved = records.filter((r) => r.status === "approved").length;
    const rejected = records.filter((r) => r.status === "rejected").length;
    return { pending, approved, rejected };
  }, [records]);

  function flash(kind: "success" | "error" | "info", text: string) {
    setFlashMsg({ kind, text });
    setTimeout(() => setFlashMsg(null), 3500);
  }

  async function handleApprove(row: PendingStudentRecord) {
    if (processing[row.id]) return;
    setProcessing((p) => ({ ...p, [row.id]: true }));
    const res = await approvePendingStudent({
      pendingId: row.id,
      reviewedBy: user?.id,
    });
    setProcessing((p) => {
      const copy = { ...p };
      delete copy[row.id];
      return copy;
    });
    if (res.success) {
      flash("success", `Đã duyệt hồ sơ ${row.student_id} -> vào bảng students chính.`);
      loadAll(activeFilter);
    } else {
      flash("error", res.error || "Lỗi duyệt hồ sơ.");
    }
  }

  async function handleReject(row: PendingStudentRecord) {
    if (processing[row.id]) return;
    const reason = window.prompt(
      `Lý do từ chối hồ sơ ${row.student_id} - ${row.full_name}? (tuỳ chọn)`,
      "Ảnh Webcam chưa đạt yêu cầu chất lượng.",
    );
    if (reason === null) return; // user cancelled
    setProcessing((p) => ({ ...p, [row.id]: true }));
    const res = await rejectPendingStudent({
      pendingId: row.id,
      reviewedBy: user?.id,
      reviewNote: reason || undefined,
    });
    setProcessing((p) => {
      const copy = { ...p };
      delete copy[row.id];
      return copy;
    });
    if (res.success) {
      flash("info", `Đã từ chối hồ sơ ${row.student_id}.`);
      loadAll(activeFilter);
    } else {
      flash("error", res.error || "Lỗi từ chối hồ sơ.");
    }
  }

  async function handleBatchApprove() {
    if (batchRunning) return;
    if (!window.confirm(
      `Duyệt tất cả ${stats.pending} hồ sơ hợp lệ đang chờ? Hành động này sẽ promote các bản ghi sang bảng students chính.`,
    )) {
      return;
    }
    setBatchRunning(true);
    const res = await batchApproveValidPendingStudents({
      reviewedBy: user?.id,
    });
    setBatchRunning(false);
    if (res.error) {
      flash("error", res.error);
    } else {
      flash(
        "success",
        `Đã duyệt ${res.approved}/${stats.pending} hồ sơ. Bỏ qua ${res.skipped} ảnh không hợp lệ.`,
      );
      loadAll(activeFilter);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Phê duyệt Hồ sơ Sinh viên
          </h2>
          <p className="text-xs text-muted-foreground">
            Danh sách hồ sơ sinh viên gửi qua Cổng sinh viên — chờ Admin xác minh ảnh chụp Webcam trước khi
            đưa vào hệ thống AI nhận diện và đồng bộ về Desktop App.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadAll(activeFilter)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Tải lại danh sách"
          >
            <RefreshCw size={14} />
            Tải lại
          </button>
          <button
            type="button"
            onClick={handleBatchApprove}
            disabled={batchRunning || stats.pending === 0}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
            title="Duyệt tất cả ảnh hợp lệ trong danh sách chờ"
          >
            {batchRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCheck size={14} />
            )}
            Duyệt tất cả ảnh hợp lệ ({stats.pending})
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4 shadow-xs">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary">
            <Hourglass size={12} /> Chờ duyệt
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-foreground">
            {stats.pending}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cần xử lý trước khi hồ sơ tới Camera AI
          </p>
        </div>
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-xs">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <CheckCircle2 size={12} /> Đã duyệt
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-foreground">
            {stats.approved}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Đã đồng bộ về Desktop App
          </p>
        </div>
        <div className="rounded-2xl border border-offline/40 bg-offline/10 p-4 shadow-xs">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-offline">
            <XCircle size={12} /> Đã từ chối
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-foreground">
            {stats.rejected}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ảnh không đạt yêu cầu chất lượng
          </p>
        </div>
      </div>

      {/* Filter / Search row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => {
            const active = tab.key === activeFilter;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveFilter(tab.key);
                  setPage(1);
                }}
                className={`focus-ring inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center gap-1 rounded-xl border border-border bg-background px-2 text-xs text-muted-foreground">
            <Search size={13} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm MSSV, họ tên hoặc lớp..."
              className="w-44 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              aria-label="Tìm kiếm hồ sơ"
            />
          </div>
        </div>
      </div>

      {/* Flash banner */}
      {flashMsg && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs animate-fade-in ${
            flashMsg.kind === "success"
              ? "border-online/40 bg-online/10 text-online"
              : flashMsg.kind === "error"
              ? "border-offline/40 bg-offline/10 text-offline"
              : "border-secondary/40 bg-secondary/10 text-secondary"
          }`}
        >
          {flashMsg.kind === "error" ? (
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          )}
          <span>{flashMsg.text}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Đang tải danh sách hồ sơ chờ duyệt..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadAll(activeFilter)} />
      ) : filtered.length === 0 ? (
        <EmptyState message="Không có hồ sơ nào khớp với bộ lọc hiện tại." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
            {pageRecords.map((row, idx) => (
              <ApprovalCard
                key={row.id}
                row={row}
                busy={Boolean(processing[row.id])}
                onApprove={() => handleApprove(row)}
                onReject={() => handleReject(row)}
                indexInPage={idx}
              />
            ))}
          </div>

          {filtered.length > pageSize && (
            <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                pageSizes={[12, 24, 48]}
                itemLabel="hồ sơ"
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
    </div>
  );
}

interface ApprovalCardProps {
  row: PendingStudentRecord;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  indexInPage: number;
}

function ApprovalCard({ row, busy, onApprove, onReject, indexInPage }: ApprovalCardProps) {
  const hasPortrait = Boolean(row.portrait_url);
  const statusBadge = (() => {
    if (row.status === "approved")
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          <CheckCircle2 size={11} /> Đã duyệt
        </span>
      );
    if (row.status === "rejected")
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-offline/40 bg-offline/15 px-2 py-0.5 text-[10px] font-bold text-offline">
          <XCircle size={11} /> Đã từ chối
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
        <Clock size={11} /> Chờ duyệt
      </span>
    );
  })();

  return (
    <div
      style={{ animationDelay: `${(indexInPage % 12) * 50}ms` }}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm animate-item-enter"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {hasPortrait ? (
            <img
              src={row.portrait_url}
              alt={`Ảnh chụp Webcam của ${row.full_name}`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
              className="h-20 w-20 shrink-0 rounded-xl border border-border/80 object-cover shadow-xs"
            />
          ) : row.portrait_url ? (
            <StudentAvatar
              src={row.portrait_url}
              name={row.full_name}
              size="xl"
              className="h-20 w-20 border-2 border-border"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
              <ImageOff size={20} />
              <span className="mt-1 text-[10px]">Không có ảnh</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-sm font-bold text-foreground">
              {row.full_name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono text-foreground/90 font-medium">{row.student_id}</span>
              <span className="mx-1 text-muted-foreground/60">·</span>
              <span>{row.class_name || "—"}</span>
            </p>
            {row.email && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {row.email}
              </p>
            )}
          </div>
        </div>
        {statusBadge}
      </div>

      {row.review_note && (
        <div className="rounded-lg border border-offline/40 bg-offline/5 px-2.5 py-1.5 text-[11px] text-offline">
          <strong className="font-semibold">Ghi chú:</strong> {row.review_note}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock size={11} />
          Gửi lúc:{" "}
          <strong className="font-mono text-foreground">
            {row.created_at
              ? new Date(row.created_at).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "—"}
          </strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={busy || row.status !== "pending"}
          className="focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <CheckCircle2 size={13} />
          )}
          {row.status === "pending" ? "Chấp nhận" : row.status === "approved" ? "Đã duyệt" : "Đã từ chối"}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy || row.status !== "pending"}
          className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-offline/40 bg-offline/10 px-3 py-2 text-xs font-semibold text-offline hover:bg-offline/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <XCircle size={13} />
          Từ chối
        </button>
      </div>
    </div>
  );
}

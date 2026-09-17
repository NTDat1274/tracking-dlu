// src/web/pages/VisitsPage.tsx
// Filter pipeline: raw data -> date filter -> search -> status/camera/class filters -> sort -> pagination.
import { useMemo, useState, useEffect } from "react";
import VisitFilterBar, { type VisitFilterState } from "../components/filters/VisitFilterBar";
import DataTable, { type Column } from "../components/DataTable";
import Pagination from "../components/Pagination";
import StatusBadge from "../components/StatusBadge";
import { EmptyState, NoResultState } from "../components/StateViews";
import { TableSkeleton } from "../components/LoadingSkeleton";
import { StudentAvatar } from "../components/AvatarFallback";
import { fetchVisitRecords, fetchDistinctClasses, fetchDistinctCameras, subscribeToStudentRecords } from "../../lib/supabase";
import {
  fmtDuration,
  fmtTime,
  isWithinDateRange,
  type VisitRecord,
  type VisitSortKey,
  type SortDirection,
  type CameraOption,
} from "../../data/types";

interface VisitsPageProps {
  filters: VisitFilterState;
  onFiltersChange: (filters: VisitFilterState) => void;
  onReset: () => void;
  page: number;
  pageSize: 10 | 25 | 50;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: 10 | 25 | 50) => void;
  onSelectRecord: (record: VisitRecord) => void;
}

function formatCameraLabel(id: string): string {
  if (!id) return "Unknown";
  return id.replace("CAM-", "Camera ");
}

export default function VisitsPage({
  filters,
  onFiltersChange,
  onReset,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectRecord,
}: VisitsPageProps) {
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<VisitSortKey>("enteredAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Load from Supabase + Subscribe Realtime
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [data, classList, camList] = await Promise.all([fetchVisitRecords(), fetchDistinctClasses(), fetchDistinctCameras()]);
      if (mounted) {
        setRecords(data);
        setClasses(classList);
        setCameras(camList);
        setLoading(false);
      }
    }

    load();

    const sub = subscribeToStudentRecords(() => {
      Promise.all([fetchVisitRecords(), fetchDistinctClasses(), fetchDistinctCameras()]).then(([updated, updatedClasses, updatedCameras]) => {
        if (mounted) {
          setRecords(updated);
          setClasses(updatedClasses);
          setCameras(updatedCameras);
        }
      });
    });

    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, []);

  // 1. Date filter
  const dateFiltered = records.filter((r) =>
    isWithinDateRange(r.enteredAt, filters.dateFrom, filters.dateTo)
  );

  // 2. Search filter
  const searched = filters.searchQuery
    ? dateFiltered.filter(
        (r) =>
          r.studentName.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          r.studentId.toLowerCase().includes(filters.searchQuery.toLowerCase())
      )
    : dateFiltered;

  // 3. Status / Camera / Class filters
  const targetClass = filters.className;
  const filtered = searched.filter((r) => {
    if (filters.status !== "All" && r.status !== filters.status) return false;
    if (filters.cameraId && r.cameraId !== filters.cameraId) return false;
    if (targetClass && r.className !== targetClass) return false;
    return true;
  });

  // 4. Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey as keyof VisitRecord];
      const bv = b[sortKey as keyof VisitRecord];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // 5. Pagination
  const totalPages = Math.max(Math.ceil(sorted.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key as VisitSortKey);
      setSortDir("asc");
    }
  }

  // NOTE: Thay cột Khoa thành cột Lớp, bỏ Độ tin cậy AI
  const columns: Column<VisitRecord>[] = [
    {
      key: "student",
      header: "Sinh viên",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <StudentAvatar src={r.avatarUrl} name={r.studentName} size="sm" />
          <div>
            <p className="font-semibold text-foreground text-xs">{r.studentName}</p>
            <p className="text-[11px] text-muted-foreground">{r.studentId}</p>
          </div>
        </div>
      ),
    },
    { key: "className", header: "Lớp", sortable: true, render: (r) => r.className || "CTK44" },
    { key: "cameraId", header: "Camera", sortable: true, render: (r) => formatCameraLabel(r.cameraId) },
    { key: "enteredAt", header: "Giờ vào", sortable: true, render: (r) => fmtTime(r.enteredAt) },
    {
      key: "exitedAt",
      header: "Giờ ra",
      sortable: true,
      render: (r) => (r.exitedAt ? fmtTime(r.exitedAt) : "Đang ở"),
    },
    { key: "waitSeconds", header: "T/g chờ", sortable: true, render: (r) => fmtDuration(r.waitSeconds) },
    { key: "durationSeconds", header: "Tổng t/g", sortable: true, className: "whitespace-nowrap", render: (r) => fmtDuration(r.durationSeconds) },
    { key: "status", header: "Trạng thái", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Thao tác",
      className: "whitespace-nowrap w-24 text-right",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectRecord(r);
          }}
          className="focus-ring rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          Xem chi tiết →
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <VisitFilterBar
        filters={filters}
        cameras={cameras}
        classes={classes}
        resultCount={sorted.length}
        onChange={onFiltersChange}
        onReset={onReset}
      />

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : records.length === 0 ? (
        <EmptyState message="Chưa có dữ liệu lượt đến nào trong cơ sở dữ liệu." />
      ) : sorted.length === 0 ? (
        <NoResultState message="Không tìm thấy kết quả phù hợp với bộ lọc." onReset={onReset} />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          <DataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.id}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={(r) => onSelectRecord(r)}
          />
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={sorted.length}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}

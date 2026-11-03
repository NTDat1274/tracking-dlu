// src/web/components/WebApp.tsx
// Centralized state owner, namespaced per page to avoid cross-page filter bleed.
import { useMemo, useState } from "react";
import WebSidebar from "./WebSidebar";
import WebTopBar from "./WebTopBar";
import { ChevronRight, ChevronLeft } from "lucide-react";
import ExportModal from "./ExportModal";
import OverviewPage from "../pages/OverviewPage";
import AnalyticsPage from "../pages/AnalyticsPage";
import VisitsPage from "../pages/VisitsPage";
import StudentsPage from "../pages/StudentsPage";
import SettingsPage from "../pages/SettingsPage";
import StudentApprovalPage from "../pages/StudentApprovalPage";
import LoginPage from "../pages/LoginPage";
import StudentPortalPage from "../pages/StudentPortalPage";
import LecturerPortalPage from "../pages/LecturerPortalPage";
import VisitDetailDrawer from "./VisitDetailDrawer";
import { useAuth } from "../../context/AuthContext";
import type { AnalyticsFilterState } from "./filters/AnalyticsFilterBar";
import type { VisitFilterState } from "./filters/VisitFilterBar";
import type { StudentFilterState } from "./filters/StudentFilterBar";
import type { VisitRecord } from "../../data/types";

export type WebPage =
  | "overview"
  | "analytics"
  | "visits"
  | "students"
  | "approval"
  | "settings";
export type WebModal = "export" | null;

const getTodayStr = () => new Date().toISOString().split("T")[0];
const getMonthAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
};

const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilterState = {
  dateFrom: getMonthAgoStr(),
  dateTo: getTodayStr(),
  cameraId: "",
  className: "",
  status: "All",
};

const DEFAULT_VISIT_FILTERS: VisitFilterState = {
  dateFrom: getMonthAgoStr(),
  dateTo: getTodayStr(),
  searchQuery: "",
  cameraId: "",
  className: "",
  status: "All",
};

const DEFAULT_STUDENT_FILTERS: StudentFilterState = {
  searchQuery: "",
  className: "",
  sortBy: "totalVisits",
  sortDirection: "desc",
};

// ===== Task 1.3: Protected Route - State-Based Routing =====
// Định tuyến Admin dựa trên state `page` (overview | analytics | visits |
// students | settings) làm NGUỒN CHÍNH duy nhất điều khiển giao diện, không
// còn đồng bộ hai chiều với URL pathname nữa để tránh vòng lặp re-render.
export default function WebApp() {
  const { user, loading, role } = useAuth();
  const [page, setPage] = useState<WebPage>("overview");
  const [modal, setModal] = useState<WebModal>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewStudentPortal, setPreviewStudentPortal] = useState(false);

  // Selected visit record for slide-over drawer
  const [selectedRecord, setSelectedRecord] = useState<VisitRecord | null>(null);

  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilterState>(DEFAULT_ANALYTICS_FILTERS);
  const [visitFilters, setVisitFilters] = useState<VisitFilterState>(DEFAULT_VISIT_FILTERS);
  const [studentFilters, setStudentFilters] = useState<StudentFilterState>(DEFAULT_STUDENT_FILTERS);

  const [visitPage, setVisitPage] = useState(1);
  const [visitPageSize, setVisitPageSize] = useState<10 | 25 | 50>(10);

  function goToWaitingList() {
    setVisitFilters({ ...DEFAULT_VISIT_FILTERS, status: "Waiting" });
    setVisitPage(1);
    setPage("visits");
  }

  const layoutClass = useMemo(
    () => (sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"),
    [sidebarCollapsed]
  );

  // Loading Screen while auth state or role is resolving
  if (loading || (user && !role)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary font-black animate-pulse">
            DLU
          </div>
          <p className="text-xs font-semibold text-muted-foreground animate-pulse">
            Đang xác thực quyền truy cập hệ thống...
          </p>
        </div>
      </div>
    );
  }

  // Protected Route Guard (State-Based):
  //   - Chưa đăng nhập -> render LoginPage (để LoginPage tự xử lý URL).
  //   - role = 'student' hoặc admin đang preview student portal -> StudentPortalPage.
  //   - role = 'lecturer' -> LecturerPortalPage.
  //   - role = 'admin' -> render Admin Dashboard với Sidebar/TopBar/main page
  //     tương ứng với state `page`.
  // Toàn bộ định tuyến nội bộ admin do state `page` điều khiển; URL pathname
  // không còn là nguồn chính, do đó không xảy ra vòng lặp re-render.
  if (!user) {
    return (
      <div className="animate-page-enter h-full w-full">
        <LoginPage />
      </div>
    );
  }

  // Student Route Guard or Admin Preview
  if (role === "student" || previewStudentPortal) {
    return (
      <div className="animate-page-enter h-full w-full">
        <StudentPortalPage
          onBackToAdmin={() => setPreviewStudentPortal(false)}
        />
      </div>
    );
  }

  // Lecturer Route Guard
  // LecturerPortalPage cung cấp 2 tab: (1) Hồ sơ & ảnh AI,
  // (2) Tra cứu lịch sử ra/vào khoa (read-only). Không có quyền
  // thêm/sửa/xóa dữ liệu sinh viên hay cấu hình hệ thống như Admin.
  if (role === "lecturer") {
    return (
      <div className="animate-page-enter h-full w-full">
        <LecturerPortalPage />
      </div>
    );
  }

  // Only render Admin Dashboard if role is strictly 'admin'
  if (role !== "admin") {
    return (
      <div className="animate-page-enter h-full w-full">
        <LoginPage />
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-background text-foreground ${layoutClass}`}>
      <WebSidebar
        page={page}
        onNavigate={setPage}
        collapsed={sidebarCollapsed}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WebTopBar
          page={page}
          onOpenDrawer={() => setDrawerOpen(true)}
          onExport={() => setModal("export")}
          onOpenStudentPortal={() => setPreviewStudentPortal(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div key={page} className="animate-page-enter">
            {page === "overview" && (
              <OverviewPage
                onViewWaitingList={goToWaitingList}
                onSelectRecord={setSelectedRecord}
              />
            )}

            {page === "analytics" && (
              <AnalyticsPage
                filters={analyticsFilters}
                onFiltersChange={setAnalyticsFilters}
                onReset={() => setAnalyticsFilters(DEFAULT_ANALYTICS_FILTERS)}
              />
            )}

            {page === "visits" && (
              <VisitsPage
                filters={visitFilters}
                onFiltersChange={(f) => {
                  setVisitFilters(f);
                  setVisitPage(1);
                }}
                onReset={() => {
                  setVisitFilters(DEFAULT_VISIT_FILTERS);
                  setVisitPage(1);
                }}
                page={visitPage}
                pageSize={visitPageSize}
                onPageChange={setVisitPage}
                onPageSizeChange={(size) => {
                  setVisitPageSize(size);
                  setVisitPage(1);
                }}
                onSelectRecord={setSelectedRecord}
              />
            )}

            {page === "students" && (
              <StudentsPage
                filters={studentFilters}
                onFiltersChange={setStudentFilters}
                onReset={() => setStudentFilters(DEFAULT_STUDENT_FILTERS)}
              />
            )}

            {page === "approval" && <StudentApprovalPage />}

            {page === "settings" && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Slide-over Detail Drawer */}
      <VisitDetailDrawer
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      {/* Export Report Modal */}
      <ExportModal open={modal === "export"} onClose={() => setModal(null)} />

      {/* Sidebar toggle button on tablet */}
      <button
        type="button"
        onClick={() => setSidebarCollapsed((c) => !c)}
        className="focus-ring fixed bottom-4 left-4 hidden rounded-full border border-border bg-card p-2 text-xs text-muted-foreground shadow-sm md:block xl:hidden cursor-pointer"
        aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );
}

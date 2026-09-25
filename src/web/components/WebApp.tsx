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
import LoginPage from "../pages/LoginPage";
import StudentPortalPage from "../pages/StudentPortalPage";
import VisitDetailDrawer from "./VisitDetailDrawer";
import { useAuth } from "../../context/AuthContext";
import type { AnalyticsFilterState } from "./filters/AnalyticsFilterBar";
import type { VisitFilterState } from "./filters/VisitFilterBar";
import type { StudentFilterState } from "./filters/StudentFilterBar";
import type { VisitRecord } from "../../data/types";

export type WebPage = "overview" | "analytics" | "visits" | "students" | "settings";
export type WebModal = "export" | null;

const getTodayStr = () => new Date().toISOString().split("T")[0];
const getWeekAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
};

const DEFAULT_ANALYTICS_FILTERS: AnalyticsFilterState = {
  dateFrom: getWeekAgoStr(),
  dateTo: getTodayStr(),
  cameraId: "",
  className: "",
  status: "All",
};

const DEFAULT_VISIT_FILTERS: VisitFilterState = {
  dateFrom: getWeekAgoStr(),
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

  // Protected Route Guard: If not logged in, render LoginPage
  if (!user) {
    return <LoginPage />;
  }

  // Student Route Guard or Admin Preview
  if (role === "student" || previewStudentPortal) {
    return (
      <StudentPortalPage
        onBackToAdmin={() => setPreviewStudentPortal(false)}
      />
    );
  }

  // Only render Admin Dashboard if role is strictly 'admin'
  if (role !== "admin") {
    return <LoginPage />;
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

          {page === "settings" && <SettingsPage />}
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

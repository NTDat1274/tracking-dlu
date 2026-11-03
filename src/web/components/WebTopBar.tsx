// src/web/components/WebTopBar.tsx
// Header bar with role status, page title, portal switch and export action.
import type { WebPage } from "./WebApp";
import { useAuth } from "../../context/AuthContext";
import ThemeSwitcher from "./ThemeSwitcher";
import { Menu, Download, GraduationCap, ShieldCheck } from "lucide-react";

const TITLES: Record<WebPage, string> = {
  overview: "Tổng quan phòng ban",
  analytics: "Phân tích số liệu",
  visits: "Lịch sử lượt đến",
  students: "Hồ sơ sinh viên",
  approval: "Phê duyệt hồ sơ sinh viên",
  settings: "Cấu hình hệ thống",
};

interface WebTopBarProps {
  page: WebPage;
  onOpenDrawer: () => void;
  onExport: () => void;
  onOpenStudentPortal?: () => void;
}

export default function WebTopBar({
  page,
  onOpenDrawer,
  onExport,
  onOpenStudentPortal,
}: WebTopBarProps) {
  const { user, role } = useAuth();
  // "Xuất báo cáo" should ONLY appear on visits and analytics pages
  const canExport = page === "visits" || page === "analytics";

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-xs">
      <div className="flex flex-1 items-center gap-3 min-w-0 pr-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Mở menu điều hướng"
          className="focus-ring rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted md:hidden flex shrink-0 items-center justify-center cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-base font-bold text-foreground sm:text-lg truncate">
            {TITLES[page] || "Hệ thống Quản lý"}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* Switch to Student Portal (Admin preview feature) */}
        {role === "admin" && onOpenStudentPortal && (
          <button
            type="button"
            onClick={onOpenStudentPortal}
            className="focus-ring flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs"
            title="Xem trước giao diện Cổng thông tin Sinh viên"
            aria-label="Xem trước Cổng sinh viên"
          >
            <GraduationCap size={16} />
            <span className="hidden sm:inline">Cổng Sinh Viên</span>
          </button>
        )}

        {/* Theme Switcher Button */}
        <ThemeSwitcher />

        {/* User Role Badge */}
        {user && (
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-1.5 sm:flex transition-colors">
            <span
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                role === "admin"
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary/15 text-secondary"
              }`}
            >
              <ShieldCheck size={12} />
              {role === "admin" ? "Quản trị viên" : "Sinh viên"}
            </span>
            <span className="text-xs font-medium text-muted-foreground max-w-[140px] truncate">
              {user.email}
            </span>
          </div>
        )}

        {/* Export Report button: ONLY on visits and analytics */}
        {canExport && (
          <button
            type="button"
            onClick={onExport}
            className="focus-ring flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Download size={16} />
            <span>Xuất báo cáo</span>
          </button>
        )}
      </div>
    </header>
  );
}

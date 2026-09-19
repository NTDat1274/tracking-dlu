// src/web/components/WebTopBar.tsx
import type { WebPage } from "./WebApp";
import { useAuth } from "../../context/AuthContext";

const TITLES: Record<WebPage, string> = {
  overview: "Tổng quan phòng ban",
  analytics: "Phân tích số liệu",
  visits: "Lịch sử lượt đến",
  students: "Hồ sơ sinh viên",
  settings: "Cấu hình hệ thống",
};

interface WebTopBarProps {
  page: WebPage;
  onOpenDrawer: () => void;
  onExport: () => void;
}

import ThemeSwitcher from "./ThemeSwitcher";
import { Menu, Download } from "lucide-react";

export default function WebTopBar({ page, onOpenDrawer, onExport }: WebTopBarProps) {
  const { user } = useAuth();
  // "Xuất báo cáo" should ONLY appear on visits and analytics pages
  const canExport = page === "visits" || page === "analytics";

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Mở menu điều hướng"
          className="focus-ring rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted md:hidden flex items-center justify-center"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="font-display text-base font-bold text-foreground sm:text-lg">
            {TITLES[page] || "Hệ thống Quản lý"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Switcher Button */}
        <ThemeSwitcher />

        {/* User Badge */}
        {user && (
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1 sm:flex">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              {user.email}
            </span>
          </div>
        )}

        {/* Export Report button: ONLY on visits and analytics */}
        {canExport && (
          <button
            type="button"
            onClick={onExport}
            className="focus-ring flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm transition-opacity"
          >
            <Download size={16} />
            Xuất báo cáo
          </button>
        )}
      </div>
    </header>
  );
}

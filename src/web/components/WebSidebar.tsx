// src/web/components/WebSidebar.tsx
import type { WebPage } from "./WebApp";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS: { key: WebPage; label: string; icon: string }[] = [
  { key: "overview", label: "Tổng quan", icon: "❖" },
  { key: "analytics", label: "Phân tích số liệu", icon: "▤" },
  { key: "visits", label: "Lịch sử lượt đến", icon: "⏱" },
  { key: "students", label: "Quản lý sinh viên", icon: "👤" },
  { key: "settings", label: "Cấu hình Cloud", icon: "⚙" },
];

interface WebSidebarProps {
  page: WebPage;
  onNavigate: (page: WebPage) => void;
  collapsed: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export default function WebSidebar({
  page,
  onNavigate,
  collapsed,
  drawerOpen,
  onCloseDrawer,
}: WebSidebarProps) {
  const { signOut, user } = useAuth();

  const content = (
    <nav aria-label="Điều hướng chính" className="flex h-full flex-col justify-between p-3">
      <div className="space-y-1">
        {/* Brand Header */}
        <div className={`mb-5 px-2 pt-2 ${collapsed ? "text-center" : ""}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 font-display font-black text-primary text-sm shadow-xs">
              DLU
            </div>
            {!collapsed && (
              <div>
                <p className="font-display text-sm font-bold tracking-tight text-foreground">
                  TrackingZ <span className="text-primary font-normal text-xs">AI</span>
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">Admin Portal · DLU</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav links */}
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = page === item.key;
            return (
              <button
                key={item.key}
                type="button"
                title={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  onNavigate(item.key);
                  onCloseDrawer();
                }}
                className={`focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <span aria-hidden="true" className="w-5 text-center text-sm">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Profile & Logout */}
      <div className="border-t border-border/80 pt-3 space-y-2">
        {!collapsed && user && (
          <div className="px-2 py-1">
            <p className="truncate text-xs font-medium text-foreground">{user.email}</p>
            <p className="text-[10px] text-muted-foreground">Cán bộ quản trị</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            signOut();
            onCloseDrawer();
          }}
          title="Đăng xuất"
          className={`focus-ring flex w-full items-center gap-2.5 rounded-xl border border-offline/30 bg-offline/10 px-3 py-2 text-xs font-semibold text-offline hover:bg-offline/20 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span aria-hidden="true" className="w-5 text-center text-sm">⏻</span>
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-border bg-card md:block ${
          collapsed ? "w-16" : "w-60"
        } transition-all duration-200`}
      >
        {content}
      </aside>

      {/* Drawer for small screens */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Đóng menu"
            onClick={onCloseDrawer}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}

// src/web/components/ThemeSwitcher.tsx
// Quick theme switcher button (Light / Dark).
import { useTheme } from "../../context/ThemeContext";

export default function ThemeSwitcher({ className = "" }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      aria-label="Đổi giao diện sáng/tối"
      className={`focus-ring flex items-center justify-center rounded-xl border border-border bg-card p-2 text-foreground hover:bg-muted transition-colors shadow-xs ${className}`}
    >
      {isDark ? (
        <span className="text-sm" aria-hidden="true">☀️</span>
      ) : (
        <span className="text-sm" aria-hidden="true">🌙</span>
      )}
    </button>
  );
}

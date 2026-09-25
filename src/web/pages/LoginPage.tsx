// src/web/pages/LoginPage.tsx
// Trang Xác thực Đăng nhập & Đăng ký Sinh viên phong cách Swiss Modernism 2.0 (DLU Branding).
// Tuân thủ: ui-ux-pro-max, frontend-design, vercel-react-best-practices, web-design-guidelines.
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Shield,
  AlertTriangle,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const { signIn, signUp, sessionExpiredMsg, clearSessionExpiredMsg } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleTabChange = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg("");
    setSuccessMsg("");
    clearSessionExpiredMsg();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    clearSessionExpiredMsg();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMsg("Vui lòng nhập địa chỉ email.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Mật khẩu phải có tối thiểu 6 ký tự.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setErrorMsg("Mật khẩu xác nhận không khớp.");
        return;
      }
    }

    setLoading(true);

    if (mode === "signin") {
      const res = await signIn(trimmedEmail, password);
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.error || "Email hoặc mật khẩu không chính xác.");
      }
    } else {
      const res = await signUp(trimmedEmail, password);
      setLoading(false);
      if (res.success) {
        setSuccessMsg(
          "Đăng ký thành công! Hệ thống đang chuyển bạn vào Cổng thông tin Sinh viên..."
        );
      } else {
        setErrorMsg(res.error || "Không thể đăng ký tài khoản. Vui lòng thử lại.");
      }
    }
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4 py-8">
      {/* Background ambient accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl transition-all duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
            <span className="font-display text-2xl font-black text-primary tracking-wider">
              DLU
            </span>
          </div>

          <h1 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
            {mode === "signin"
              ? "Cổng Thông Tin & Quản Trị"
              : "Đăng Ký Tài Khoản Sinh Viên"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Trường Đại học Đà Lạt · TrackingZ AI Verification System
          </p>
          <div className="page-title-accent mt-2" />
        </div>

        {/* Tab Switcher - Swiss Modernism minimal segmented control */}
        <div
          role="tablist"
          aria-label="Chế độ xác thực"
          className="mt-6 flex rounded-xl border border-border/80 bg-muted/50 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => handleTabChange("signin")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
              mode === "signin"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn size={15} className="shrink-0" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => handleTabChange("signup")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
              mode === "signup"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus size={15} className="shrink-0" />
            <span>Đăng ký sinh viên</span>
          </button>
        </div>

        {/* Notification alerts */}
        {sessionExpiredMsg ? (
          <div className="mt-4 rounded-xl border border-secondary/50 bg-secondary/10 p-3 text-xs text-secondary flex items-start gap-2">
            <Shield size={16} className="shrink-0 mt-0.5" />
            <span>{sessionExpiredMsg}</span>
          </div>
        ) : null}

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-offline/40 bg-offline/10 p-3 text-xs text-offline flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {successMsg ? (
          <div className="mt-4 rounded-xl border border-online/40 bg-online/10 p-3 text-xs text-online flex items-start gap-2">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        ) : null}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-foreground mb-1.5"
            >
              {mode === "signin"
                ? "Email đăng nhập"
                : "Email sinh viên trường (@dlu.edu.vn)"}
              <span className="text-offline ml-1">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@dlu.edu.vn"
              className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-foreground"
              >
                Mật khẩu <span className="text-offline">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                {showPassword ? (
                  <>
                    <EyeOff size={13} />
                    <span>Ẩn</span>
                  </>
                ) : (
                  <>
                    <Eye size={13} />
                    <span>Hiện</span>
                  </>
                )}
              </button>
            </div>

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
            {mode === "signup" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tối thiểu 6 ký tự để bảo vệ tài khoản.
              </p>
            )}
          </div>

          {mode === "signup" && (
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                Xác nhận lại mật khẩu <span className="text-offline">*</span>
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
              />
            </div>
          )}

          {mode === "signup" && (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
              <GraduationCap size={16} className="shrink-0 text-primary mt-0.5" />
              <span>
                Sau khi đăng ký, bạn sẽ được chuyển đến trang cập nhật hồ sơ để điền
                MSSV, Lớp và tải ảnh khuôn mặt chuẩn nhận diện AI.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="focus-ring mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 shadow-md disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : null}
            {loading
              ? mode === "signin"
                ? "Đang xác thực..."
                : "Đang tạo tài khoản..."
              : mode === "signin"
              ? "Đăng nhập hệ thống"
              : "Hoàn tất đăng ký sinh viên"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
          <span>TrackingZ Web Admin & Student Portal &copy; 2026 DLU</span>
        </div>
      </div>
    </div>
  );
}

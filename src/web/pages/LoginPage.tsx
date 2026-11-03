// src/web/pages/LoginPage.tsx
// Trang Xác thực Đăng nhập & Đăng ký Sinh viên phong cách Swiss Modernism 2.0 (DLU Branding).
// Tuân thủ: ui-ux-pro-max, frontend-design, vercel-react-best-practices, web-design-guidelines.
import React, { useEffect, useState } from "react";
import { useAuth, getDefaultLandingPathForRole } from "../../context/AuthContext";
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
  const { signIn, signUp, sessionExpiredMsg, clearSessionExpiredMsg, user, role } = useAuth();
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
  const [isShaking, setIsShaking] = useState(false);
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);

  // Tự động điều hướng đúng trang sau khi Login thành công.
  // Khi user & role đã sẵn sàng trong AuthContext, LoginPage thông báo
  // cho WebApp thông qua callback onAuthenticated để chuyển state tới
  // đúng portal: admin -> /overview, lecturer -> /lecturer-portal,
  // student -> /student-portal. Nếu prop không được cung cấp (tương thích
  // ngược), vẫn dùng window.location để điều hướng dạng soft fallback.
  useEffect(() => {
    if (user && role) {
      const landingPath = getDefaultLandingPathForRole(role);
      if (landingPath !== "/login") {
        try {
          window.history.replaceState({}, "", landingPath);
        } catch (navErr) {
          console.warn("Không thể cập nhật URL sau đăng nhập:", navErr);
        }
      }
    }
  }, [user, role]);

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
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 450);
      setErrorMsg("Vui lòng nhập địa chỉ email.");
      return;
    }

    if (password.length < 6) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 450);
      setErrorMsg("Mật khẩu phải có tối thiểu 6 ký tự.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 450);
        setErrorMsg("Mật khẩu xác nhận không khớp.");
        return;
      }
    }

    setLoading(true);

    if (mode === "signin") {
      const res = await signIn(trimmedEmail, password);
      if (!res.success) {
        setLoading(false);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 450);
        setErrorMsg(res.error || "Email hoặc mật khẩu không chính xác.");
      } else {
        // Trigger smooth login success state
        setIsLoginSuccess(true);
        // Loading state can be set to false so button isn't stuck
        setLoading(false);
      }
    } else {
      const res = await signUp(trimmedEmail, password);
      setLoading(false);
      if (res.success) {
        setIsLoginSuccess(true);
        setSuccessMsg(
          "Đăng ký thành công! Hệ thống đang chuyển bạn vào Cổng thông tin Sinh viên..."
        );
      } else {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 450);
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

      <div className={`relative w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl transition-all duration-300 ${
        isShaking ? "animate-shake border-offline/60 shadow-offline/10" : ""
      }`}>
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
        {!isLoginSuccess && (
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] ${
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus size={15} className="shrink-0" />
              <span>Đăng ký sinh viên</span>
            </button>
          </div>
        )}

        {/* Notification alerts */}
        {sessionExpiredMsg && !isLoginSuccess ? (
          <div className="mt-4 rounded-xl border border-secondary/50 bg-secondary/10 p-3 text-xs text-secondary flex items-start gap-2 animate-item-enter">
            <Shield size={16} className="shrink-0 mt-0.5" />
            <span>{sessionExpiredMsg}</span>
          </div>
        ) : null}

        {errorMsg && !isLoginSuccess ? (
          <div className="mt-4 rounded-xl border border-offline/40 bg-offline/10 p-3 text-xs text-offline flex items-start gap-2 animate-item-enter">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {successMsg && !isLoginSuccess ? (
          <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs text-primary flex items-start gap-2 animate-item-enter">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        ) : null}

        {/* Success Transition View or Form Container */}
        {isLoginSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/40 animate-success-pop shadow-lg shadow-primary/10">
              <CheckCircle2 size={44} className="stroke-[2.5]" />
            </div>

            <h2 className="mt-5 font-display text-lg font-bold text-foreground animate-item-enter">
              {mode === "signin" ? "Đăng nhập thành công!" : "Tạo tài khoản thành công!"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs animate-item-enter">
              {mode === "signin"
                ? "Hệ thống đang đồng bộ dữ liệu phân quyền và chuyển hướng..."
                : "Hệ thống đang chuẩn bị hồ sơ và chuyển đến Cổng Sinh Viên..."}
            </p>

            {/* Smooth animated progress bar */}
            <div className="mt-6 w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                <div className="h-full rounded-full bg-primary animate-progress-fill" />
              </div>
            </div>
          </div>
        ) : (
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
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
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
              className="focus-ring mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 hover:scale-[1.01] active:scale-[0.98] shadow-md disabled:opacity-50 transition-all cursor-pointer"
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
        )}

        {/* Footer */}
        <div className="mt-6 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
          <span>TrackingZ Web Admin & Student Portal &copy; 2026 DLU</span>
        </div>
      </div>
    </div>
  );
}

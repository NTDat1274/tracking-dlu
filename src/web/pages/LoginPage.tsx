// src/web/pages/LoginPage.tsx
// Secure Login Page styled with DLU Dark Slate Branding.
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Shield, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const { signIn, sessionExpiredMsg, clearSessionExpiredMsg } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    clearSessionExpiredMsg();
    setLoading(true);

    const res = await signIn(email, password);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || "Email hoặc mật khẩu không chính xác.");
    }
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
      {/* Background ambient accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl animate-fade-in-up">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
            <span className="font-display text-2xl font-black text-primary">DLU</span>
          </div>

          <h1 className="mt-4 font-display text-xl font-bold tracking-tight text-foreground">
            Hệ thống quản lý sinh viên
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Trường Đại học Đà Lạt · TrackingZ AI Admin Portal
          </p>
          <div className="page-title-accent mt-2" />
        </div>

        {sessionExpiredMsg ? (
          <div className="mt-5 rounded-xl border border-secondary/50 bg-secondary/10 p-3 text-xs text-secondary flex items-start gap-2">
            <Shield size={16} className="shrink-0 mt-0.5" />
            <span>{sessionExpiredMsg}</span>
          </div>
        ) : null}

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-offline/40 bg-offline/10 p-3 text-xs text-offline flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
              Email Quản trị viên
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@dlu.edu.vn"
              className="focus-ring w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-foreground">
                Mật khẩu
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="focus-ring w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="focus-ring mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 shadow-md disabled:opacity-50 transition-all"
          >
            {loading ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : null}
            {loading ? "Đang xác thực..." : "Đăng nhập hệ thống"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
          <span>TrackingZ Web Admin Dashboard &copy; 2026</span>
        </div>
      </div>
    </div>
  );
}

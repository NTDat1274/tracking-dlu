// src/web/pages/StudentPortalPage.tsx
// Cổng Thông Tin Sinh Viên DLU - Tự khai báo hồ sơ, tải ảnh khuôn mặt chuẩn AI InsightFace và tra cứu lịch sử.
// Tuân thủ toàn diện: ui-ux-pro-max, frontend-design, vercel-react-best-practices, web-design-guidelines.
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { uploadImageToCloudinary } from "../../lib/cloudinary";
import {
  saveStudentSelfProfile,
  fetchStudentPersonalProfile,
  fetchStudentPersonalVisits,
} from "../../lib/supabase";
import { StudentAvatar } from "../components/AvatarFallback";
import StatusBadge from "../components/StatusBadge";
import ThemeSwitcher from "../components/ThemeSwitcher";
import {
  fmtDateTime,
  fmtDuration,
  type VisitRecord,
} from "../../data/types";
import {
  GraduationCap,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  LogOut,
  Camera,
  ArrowLeft,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";

interface StudentPortalPageProps {
  onBackToAdmin?: () => void;
}

type TabType = "profile" | "history";

export default function StudentPortalPage({ onBackToAdmin }: StudentPortalPageProps) {
  const { user, account, role, signOut, refreshAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // Profile data state
  const [studentId, setStudentId] = useState(account?.student_id || "");
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [portraitUrl, setPortraitUrl] = useState("");

  // Upload & Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // History & Metrics state
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(() => Boolean(account?.student_id));

  // Load existing profile & visits if student_id is linked
  const loadData = useCallback(async (currentStuId?: string | null) => {
    const idToFetch = currentStuId || account?.student_id;
    if (!idToFetch) {
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setLoadingHistory(true);

    try {
      // Async-parallel: Fetch profile and visits simultaneously
      const [profileData, visitsData] = await Promise.all([
        fetchStudentPersonalProfile(idToFetch),
        fetchStudentPersonalVisits(idToFetch),
      ]);

      if (profileData) {
        setStudentId(profileData.studentId);
        setFullName(profileData.name);
        setClassName(profileData.className);
        if (profileData.email) setEmail(profileData.email);
        if (profileData.portraitUrl) {
          setPortraitUrl(profileData.portraitUrl);
          setPreviewUrl(profileData.portraitUrl);
        }
      }

      setVisits(visitsData);
    } catch (err) {
      console.warn("Lỗi tải thông tin sinh viên:", err);
    } finally {
      setLoadingProfile(false);
      setLoadingHistory(false);
    }
  }, [account?.student_id]);

  useEffect(() => {
    let mounted = true;
    const idToFetch: string = account?.student_id || "";
    if (!idToFetch) {
      return;
    }

    async function init() {
      try {
        const [profileData, visitsData] = await Promise.all([
          fetchStudentPersonalProfile(idToFetch),
          fetchStudentPersonalVisits(idToFetch),
        ]);
        if (!mounted) return;
        if (profileData) {
          setStudentId(profileData.studentId);
          setFullName(profileData.name);
          setClassName(profileData.className);
          if (profileData.email) setEmail(profileData.email);
          if (profileData.portraitUrl) {
            setPortraitUrl(profileData.portraitUrl);
            setPreviewUrl(profileData.portraitUrl);
          }
        }
        setVisits(visitsData);
      } catch (err) {
        console.warn("Lỗi tải thông tin sinh viên:", err);
      } finally {
        if (mounted) {
          setLoadingProfile(false);
          setLoadingHistory(false);
        }
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [account?.student_id]);

  // Handle local photo selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setFormError("Vui lòng chọn file hình ảnh (JPG, PNG, WEBP).");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFormError("");
    }
  };

  // Submit profile to Supabase & Cloudinary
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const cleanStuId = studentId.trim();
    const cleanName = fullName.trim();
    const cleanClass = className.trim();
    const cleanEmail = email.trim();

    if (!cleanStuId) {
      setFormError("Vui lòng nhập Mã số sinh viên (MSSV).");
      return;
    }
    if (!cleanName) {
      setFormError("Vui lòng nhập Họ và tên sinh viên.");
      return;
    }
    if (!previewUrl && !portraitUrl && !selectedFile) {
      setFormError("Vui lòng tải lên ảnh chân dung khuôn mặt để hệ thống AI nhận diện.");
      return;
    }

    if (!user) {
      setFormError("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = portraitUrl;

    // 1. Upload photo to Cloudinary if new file selected
    if (selectedFile) {
      try {
        const uploadRes = await uploadImageToCloudinary(selectedFile);
        if (uploadRes.success && uploadRes.url) {
          finalImageUrl = uploadRes.url;
          setPortraitUrl(uploadRes.url);
        } else {
          setFormError(uploadRes.error || "Không thể tải ảnh lên Cloudinary.");
          setIsSubmitting(false);
          return;
        }
      } catch (err: any) {
        setFormError(err.message || "Lỗi tải ảnh chân dung.");
        setIsSubmitting(false);
        return;
      }
    }

    // 2. Save to Supabase and link to user account
    const saveRes = await saveStudentSelfProfile({
      student_id: cleanStuId,
      full_name: cleanName,
      class_name: cleanClass,
      email: cleanEmail,
      portrait_url: finalImageUrl,
      userId: user.id,
    });

    setIsSubmitting(false);

    if (saveRes.success) {
      setFormSuccess("Hồ sơ sinh viên và ảnh AI đã được lưu thành công vào hệ thống!");
      await refreshAccount();
      // Reload visits in case they were mapped to this student ID
      loadData(cleanStuId);
    } else {
      setFormError(saveRes.error || "Lỗi lưu hồ sơ vào Supabase.");
    }
  };

  const isProfileComplete = Boolean(studentId && fullName && (portraitUrl || previewUrl));
  const totalVisits = visits.length;
  const servedVisits = visits.filter((v) => v.status === "Served").length;
  const waitingVisits = visits.filter((v) => v.status === "Waiting").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar - Swiss Modernism clean header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 shadow-xs">
              <span className="font-display text-base font-black text-primary">DLU</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-sm font-bold text-foreground truncate">
                Cổng Thông Tin Sinh Viên
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                Trường Đại học Đà Lạt · Hệ thống nhận diện AI TrackingZ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {role === "admin" && onBackToAdmin && (
              <button
                type="button"
                onClick={onBackToAdmin}
                className="focus-ring flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                title="Quay lại giao diện Admin"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Về Admin</span>
              </button>
            )}

            <ThemeSwitcher />

            <button
              type="button"
              onClick={signOut}
              className="focus-ring flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Đăng xuất tài khoản"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-8 py-6 space-y-6">
        {/* Status Readiness Banner */}
        <section aria-label="Trạng thái hồ sơ">
          {loadingProfile ? (
            <div className="h-20 w-full animate-pulse rounded-2xl border border-border/80 bg-muted/40" />
          ) : isProfileComplete ? (
            <div className="rounded-2xl border border-online/30 bg-online/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-online/20 text-online mt-0.5">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-sm font-bold text-foreground">
                      Hồ sơ AI đã hoàn tất & sẵn sàng
                    </h2>
                    <span className="rounded-full bg-online/15 px-2 py-0.5 text-[10px] font-bold text-online">
                      Đã kích hoạt
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    MSSV: <strong className="font-mono text-foreground">{studentId}</strong> · {fullName} {className ? `· Lớp ${className}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Camera AI tại văn phòng khoa sẽ tự động nhận diện khuôn mặt và ghi nhận lượt đến của bạn.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <StudentAvatar src={portraitUrl || previewUrl} name={fullName} size="lg" className="border-2 border-online/40" />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/20 text-secondary mt-0.5">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-foreground">
                    Chưa hoàn tất ảnh chân dung nhận diện
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vui lòng nhập MSSV và tải lên ảnh chân dung khuôn mặt trực diện để camera tự động nhận diện bạn khi đến phòng khoa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="focus-ring shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm"
              >
                Cập nhật ngay
              </button>
            </div>
          )}
        </section>

        {/* Tab Navigation Segmented Bar */}
        <nav
          role="tablist"
          aria-label="Các mục sinh viên"
          className="flex rounded-xl border border-border/80 bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "profile"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck size={16} />
            <span>Hồ sơ & Ảnh nhận diện AI</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock size={16} />
            <span>Lịch sử ra vào ({visits.length})</span>
          </button>
        </nav>

        {/* TAB 1: PROFILE & FACE PORTRAIT UPLOAD */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Portrait Upload Guide & Preview (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <Camera size={16} className="text-primary" />
                  Ảnh chân dung khuôn mặt
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dữ liệu trích xuất vector cho mô hình AI InsightFace
                </p>
              </div>

              {/* Photo Frame with Face Guide */}
              <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/50 p-6 text-center group hover:border-primary/60 transition-colors">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Ảnh chân dung xem trước"
                      className="h-48 w-36 rounded-xl object-cover shadow-md border-2 border-primary/40"
                    />
                    <div className="absolute inset-0 rounded-xl ring-2 ring-primary/30 pointer-events-none" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                      <Camera size={32} />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      Chưa có ảnh chân dung
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                      Bấm nút bên dưới để chọn ảnh thẻ hoặc ảnh chụp trực diện
                    </p>
                  </div>
                )}

                {/* Upload action button */}
                <div className="mt-4 w-full">
                  <input
                    type="file"
                    id="student-portrait-file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="student-portrait-file"
                    className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>{previewUrl ? "Thay đổi ảnh khác" : "Chọn ảnh từ thiết bị"}</span>
                  </label>
                </div>
              </div>

              {/* AI Photo Guidelines Checklist (ui-ux-pro-max & swiss modernism) */}
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2.5 text-xs">
                <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Info size={14} className="text-primary" /> Tiêu chuẩn ảnh AI
                </p>
                <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="shrink-0 text-online mt-0.5" />
                    <span>Chụp thẳng trực diện, rõ hai mắt và nét mặt.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="shrink-0 text-online mt-0.5" />
                    <span>Ánh sáng đủ rõ, không bị ngược sáng hoặc bóng đổ.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="shrink-0 text-online mt-0.5" />
                    <span>Không đeo khẩu trang, kính râm hoặc che khuất mặt.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Information Form (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <GraduationCap size={16} className="text-primary" />
                  Thông tin cá nhân sinh viên
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Thông tin sẽ được đồng bộ trực tiếp lên hệ thống quản lý khoa
                </p>
              </div>

              {formError && (
                <div className="rounded-xl border border-offline/40 bg-offline/10 p-3.5 text-xs text-offline flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="rounded-xl border border-online/40 bg-online/10 p-3.5 text-xs text-online flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSubmitProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="student_id"
                      className="block text-xs font-semibold text-foreground mb-1.5"
                    >
                      Mã số sinh viên (MSSV) <span className="text-offline">*</span>
                    </label>
                    <input
                      id="student_id"
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="VD: 2212390"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Mã định danh duy nhất của bạn tại trường DLU.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="class_name"
                      className="block text-xs font-semibold text-foreground mb-1.5"
                    >
                      Lớp / Khóa học
                    </label>
                    <input
                      id="class_name"
                      type="text"
                      placeholder="VD: CTK44, CTK45"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="full_name"
                    className="block text-xs font-semibold text-foreground mb-1.5"
                  >
                    Họ và tên đầy đủ <span className="text-offline">*</span>
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn An"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-foreground mb-1.5"
                  >
                    Email liên hệ
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="VD: 2212390@dlu.edu.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  />
                </div>

                <div className="border-t border-border/80 pt-4 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="focus-ring flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-md disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {isSubmitting ? "Đang xử lý & tải ảnh..." : "Lưu & Đồng bộ hồ sơ AI"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: PERSONAL VISIT HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards for Student */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Tổng lượt đến khoa</p>
                <p className="font-display text-2xl font-bold text-foreground mt-1">
                  {totalVisits}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Số lần camera ghi nhận</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Lượt đã tiếp nhận</p>
                <p className="font-display text-2xl font-bold text-primary mt-1">
                  {servedVisits}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cán bộ đã hỗ trợ xử lý</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Đang chờ phục vụ</p>
                <p className="font-display text-2xl font-bold text-secondary mt-1">
                  {waitingVisits}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Hiện đang có mặt trong phòng</p>
              </div>
            </div>

            {/* Visits History Table / List */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/80 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Nhật ký các lần đến văn phòng khoa
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dữ liệu thời gian thực được hệ thống camera AI tự động lưu trữ
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {visits.length} bản ghi
                </span>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Đang tải lịch sử ra vào...
                </div>
              ) : visits.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                    <Calendar size={24} />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Chưa có lượt ra/vào nào được ghi nhận
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Khi bạn đến văn phòng khoa, hệ thống camera AI sẽ tự động nhận diện và cập nhật nhật ký tại đây.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/30">
                        <th className="px-4 py-3">Thời gian đến</th>
                        <th className="px-4 py-3">Thời gian ra</th>
                        <th className="px-4 py-3">Thời gian ở</th>
                        <th className="px-4 py-3">Camera</th>
                        <th className="px-4 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {visits.map((v) => (
                        <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-foreground font-medium">
                            {fmtDateTime(v.enteredAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {v.exitedAt ? fmtDateTime(v.exitedAt) : "Đang có mặt"}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {fmtDuration(v.durationSeconds)}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {v.cameraId}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={v.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

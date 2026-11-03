// src/web/pages/LecturerPortalPage.tsx
// Cổng Thông Tin & Tra Cứu Dành Riêng Cho Giảng Viên.
// Read-only đối với dữ liệu sinh viên + hỗ trợ khai báo hồ sơ + ảnh AI chân dung.
// Tuân thủ: ui-ux-pro-max, frontend-design, vercel-react-best-practices, web-design-guidelines.
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { uploadImageToCloudinary } from "../../lib/cloudinary";
import {
  fetchVisitRecords,
  fetchDistinctCameras,
  upsertLecturer,
  fetchLecturerByCode,
} from "../../lib/supabase";
import {
  fmtDateTime,
  fmtDuration,
  type VisitRecord,
  type CameraOption,
} from "../../data/types";
import { StudentAvatar, SnapshotImage } from "../components/AvatarFallback";
import StatusBadge from "../components/StatusBadge";
import ThemeSwitcher from "../components/ThemeSwitcher";
import VisitDetailDrawer from "../components/VisitDetailDrawer";
import {
  Briefcase,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCircle2,
  Upload,
  Eye,
  Search,
  RefreshCw,
  Sparkles,
  Info,
  LogOut,
  GraduationCap,
  Calendar,
  History,
  ImageIcon,
} from "lucide-react";

interface LecturerPortalPageProps {
  /**
   * Bấm "Về Admin" chỉ hiển thị khi Admin đang xem trước cổng giảng viên.
   * Giảng viên thuần túy không nhận prop này.
   */
  onBackToAdmin?: () => void;
}

type TabType = "profile" | "history";

/**
 * Cau truc ho so giang vien luu RAM-ONLY (Task 5.1).
 * [Task 5.1] TUYET DOI KHONG dung localStorage/sessionStorage/Cookies de luu
 * thong tin nhay cam. Map RAM nay chi ton tai trong phien lam viec va tu dong
 * bien mat hoan toan khi F5 hoac dong tab.
 */
interface LecturerLocalProfile {
  lecturer_code: string;
  full_name: string;
  department: string;
  email: string;
  avatar_url: string;
  updated_at: string;
}

const LECTURER_PROFILE_CACHE_KEY_UNUSED = "trackingz_lecturer_profiles";
// [Task 5.1] RAM-only cache cho ho so giang vien (khong persist xuong dia).
const lecturerProfileRamCache = new Map<string, LecturerLocalProfile>();

const DEPARTMENT_SUGGESTIONS = [
  "Khoa Công nghệ thông tin",
  "Khoa Quản trị Kinh doanh",
  "Khoa Ngôn ngữ & Văn hóa",
  "Khoa Kỹ thuật",
  "Khoa Sư phạm",
  "Khoa Lý luận Chính trị",
  "Phòng Đào tạo",
  "Phòng Công tác Sinh viên",
  "Khác",
];

function readLocalProfiles(): Record<string, LecturerLocalProfile> {
  // [Task 5.1] Chi doc tu RAM (khong doc localStorage de tranh ro ri du lieu).
  void LECTURER_PROFILE_CACHE_KEY_UNUSED;
  if (typeof window === "undefined") return {};
  try {
    const out: Record<string, LecturerLocalProfile> = {};
    lecturerProfileRamCache.forEach((profile, userId) => {
      out[userId] = profile;
    });
    return out;
  } catch (err) {
    console.warn("Không thể đọc lecturer profile từ RAM cache:", err);
    return {};
  }
}

function writeLocalProfile(userId: string, profile: LecturerLocalProfile): void {
  // [Task 5.1] Chi ghi vao RAM (tu mat khi F5/close tab).
  if (typeof window === "undefined") return;
  try {
    lecturerProfileRamCache.set(userId, profile);
  } catch (err) {
    console.warn("Không thể ghi lecturer profile vào RAM cache:", err);
  }
}

export default function LecturerPortalPage({ onBackToAdmin }: LecturerPortalPageProps) {
  const { user, account, role, signOut, refreshAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // ======= TAB 1: Profile & AI Portrait =======
  const [lecturerCode, setLecturerCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  // ======= TAB 2: Read-Only Visit History =======
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cameraFilter, setCameraFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<VisitRecord | null>(null);

  // Hydrate profile from local cache on mount
  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    try {
      const all = readLocalProfiles();
      const cached = all[user.id];
      if (cached) {
        setLecturerCode(cached.lecturer_code || "");
        setFullName(cached.full_name || "");
        setDepartment(cached.department || "");
        setEmail(cached.email || user.email || "");
        setAvatarUrl(cached.avatar_url || "");
        setPreviewUrl(cached.avatar_url || "");
      } else if (account?.email) {
        setEmail(account.email);
      }
    } catch (err) {
      console.warn("Lỗi load lecturer profile:", err);
    } finally {
      setLoadingProfile(false);
    }

    // Also pull from Supabase `lecturers` table if user already declared a code earlier
    const pullFromCloud = async () => {
      try {
        const all = readLocalProfiles();
        const cachedCode = all[user.id]?.lecturer_code?.trim();
        if (!cachedCode) return;
        const remote = await fetchLecturerByCode(cachedCode);
        if (!remote) return;
        setLecturerCode(remote.lecturer_code || "");
        setFullName(remote.full_name || "");
        setDepartment(remote.department || "");
        setAvatarUrl(remote.avatar_url || "");
        setPreviewUrl(remote.avatar_url || "");
      } catch (err) {
        console.warn("Lỗi đồng bộ hồ sơ giảng viên từ Supabase:", err);
      }
    };
    pullFromCloud();
  }, [user, account?.email]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const [records, cameraList] = await Promise.all([
        fetchVisitRecords(),
        fetchDistinctCameras(),
      ]);
      setVisits(records);
      setCameras(cameraList);
    } catch (err: any) {
      console.warn("Lỗi tải lịch sử ra/vào:", err);
      setHistoryError(err?.message || "Không thể tải dữ liệu lịch sử ra/vào.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Vui lòng chọn file hình ảnh (JPG, PNG, WEBP).");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFormError("");
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const cleanCode = lecturerCode.trim();
    const cleanName = fullName.trim();
    const cleanDept = department.trim();
    const cleanEmail = email.trim();

    if (!cleanCode) {
      setFormError("Vui lòng nhập Mã giảng viên.");
      return;
    }
    if (!cleanName) {
      setFormError("Vui lòng nhập Họ và tên giảng viên.");
      return;
    }
    if (!previewUrl && !avatarUrl && !selectedFile) {
      setFormError("Vui lòng tải lên ảnh chân dung khuôn mặt để hệ thống AI nhận diện.");
      return;
    }
    if (!user) {
      setFormError("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = avatarUrl;

    try {
      if (selectedFile) {
        const uploadRes = await uploadImageToCloudinary(selectedFile, "trackingz/portraits");
        if (uploadRes.success && uploadRes.url) {
          finalImageUrl = uploadRes.url;
          setAvatarUrl(uploadRes.url);
        } else {
          setFormError(uploadRes.error || "Không thể tải ảnh lên Cloudinary.");
          setIsSubmitting(false);
          return;
        }
      }

      const profile: LecturerLocalProfile = {
        lecturer_code: cleanCode,
        full_name: cleanName,
        department: cleanDept,
        email: cleanEmail,
        avatar_url: finalImageUrl,
        updated_at: new Date().toISOString(),
      };

      writeLocalProfile(user.id, profile);

      // Also upsert to Supabase `lecturers` table (cloud source-of-truth)
      try {
        const res = await upsertLecturer({
          lecturer_code: cleanCode,
          full_name: cleanName,
          department: cleanDept,
          avatar_url: finalImageUrl,
        });
        if (!res.success) {
          console.warn("Supabase upsertLecturer warning:", res.error);
          setFormSuccess(
            "Hồ sơ đã được lưu cục bộ, nhưng không đồng bộ được lên Supabase: " +
              (res.error || "lỗi không xác định"),
          );
        } else {
          setFormSuccess(
            "Hồ sơ giảng viên & ảnh AI đã được lưu thành công trên Supabase Cloud! Hệ thống sẽ dùng ảnh này để AI nhận diện.",
          );
        }
      } catch (cloudErr: any) {
        console.warn("Lỗi đồng bộ Supabase:", cloudErr);
        setFormSuccess(
          "Hồ sơ đã được lưu cục bộ, nhưng gặp lỗi khi đồng bộ Supabase: " +
            (cloudErr?.message || "không xác định"),
        );
      }

      await refreshAccount();
    } catch (err: any) {
      setFormError(err?.message || "Lỗi không xác định khi lưu hồ sơ giảng viên.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== Filtering for the read-only history table =====
  const filteredVisits = visits.filter((v) => {
    if (cameraFilter !== "all" && v.cameraId !== cameraFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      const haystack = `${v.studentId} ${v.studentName} ${v.className}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const isProfileComplete = Boolean(lecturerCode && fullName && (avatarUrl || previewUrl));
  const totalVisits = visits.length;
  const servedVisits = visits.filter((v) => v.status === "Served").length;
  const waitingVisits = visits.filter((v) => v.status === "Waiting").length;
  const unattendedVisits = visits.filter((v) => v.status === "Unattended").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 shadow-xs">
              <GraduationCap size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-sm font-bold text-foreground truncate">
                Cổng Giảng Viên · Trường Đại học Đà Lạt
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                Hồ sơ cá nhân & tra cứu lịch sử ra/vào khoa · TrackingZ AI
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

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-8 py-6 space-y-6">
        {/* Profile Status Banner */}
        <section aria-label="Trạng thái hồ sơ giảng viên">
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
                      Hồ sơ & ảnh AI đã sẵn sàng
                    </h2>
                    <span className="rounded-full bg-online/15 px-2 py-0.5 text-[10px] font-bold text-online">
                      Đã kích hoạt
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mã GV: <strong className="font-mono text-foreground">{lecturerCode}</strong>
                    {" · "}
                    {fullName}
                    {department ? (
                      <>
                        {" · "}
                        <span className="italic">{department}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Camera AI tại văn phòng khoa sẽ tự động nhận diện khuôn mặt và ghi nhận lượt đến của bạn.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <StudentAvatar
                  src={avatarUrl || previewUrl}
                  name={fullName || lecturerCode || "GV"}
                  size="lg"
                  className="border-2 border-online/40"
                />
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
                    Chưa hoàn tất hồ sơ & ảnh AI
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vui lòng nhập Mã GV, Họ tên, Khoa/Phòng ban và tải lên ảnh chân dung trực diện để AI nhận diện.
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

        {/* Tab Navigation */}
        <nav
          role="tablist"
          aria-label="Các mục giảng viên"
          className="flex rounded-xl border border-border/80 bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer ${
              activeTab === "profile"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCircle2 size={16} />
            <span>Hồ sơ & Ảnh AI Giảng viên</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] cursor-pointer ${
              activeTab === "history"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History size={16} />
            <span>Tra cứu Lịch sử Ra/Vào ({totalVisits})</span>
          </button>
        </nav>

        {/* TAB 1: PROFILE & AI PORTRAIT */}
        {activeTab === "profile" && (
          <div key="profile" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-page-enter">
            {/* Left column: Portrait Upload */}
            <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <Camera size={16} className="text-primary" />
                  Ảnh chân dung khuôn mặt
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tải lên Cloudinary folder <span className="font-mono text-foreground">trackingz/portraits</span> ·
                  Vector 512-D trích xuất cho AI
                </p>
              </div>

              {/* Portrait Preview */}
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
                      Chọn ảnh thẻ hoặc ảnh chụp trực diện rõ hai mắt
                    </p>
                  </div>
                )}

                <div className="mt-4 w-full">
                  <input
                    type="file"
                    id="lecturer-portrait-file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="lecturer-portrait-file"
                    className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <Upload size={15} />
                    <span>{previewUrl ? "Thay đổi ảnh khác" : "Chọn ảnh từ thiết bị"}</span>
                  </label>
                </div>
              </div>

              {/* Photo Guidelines */}
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
                    <span>Ánh sáng đủ rõ, không ngược sáng hoặc bóng đổ.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="shrink-0 text-online mt-0.5" />
                    <span>Không đeo khẩu trang, kính râm hoặc che khuất mặt.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right column: Information Form */}
            <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
              <div className="border-b border-border/60 pb-3">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <Briefcase size={16} className="text-primary" />
                  Thông tin giảng viên
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dữ liệu được đồng bộ với hệ thống quản lý khoa DLU
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
                      htmlFor="lecturer_code"
                      className="block text-xs font-semibold text-foreground mb-1.5"
                    >
                      Mã giảng viên <span className="text-offline">*</span>
                    </label>
                    <input
                      id="lecturer_code"
                      type="text"
                      required
                      placeholder="VD: GV2212"
                      value={lecturerCode}
                      onChange={(e) => setLecturerCode(e.target.value)}
                      className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Mã định danh duy nhất của bạn tại trường.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="department"
                      className="block text-xs font-semibold text-foreground mb-1.5"
                    >
                      Khoa / Phòng ban
                    </label>
                    <input
                      id="department"
                      type="text"
                      list="department-suggestions"
                      placeholder="VD: Khoa Công nghệ thông tin"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="focus-ring w-full h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors"
                    />
                    <datalist id="department-suggestions">
                      {DEPARTMENT_SUGGESTIONS.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
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
                    placeholder="VD: Nguyễn Văn B"
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
                    placeholder="VD: nguyenvanb@dlu.edu.vn"
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
                    {isSubmitting ? "Đang xử lý & tải ảnh..." : "Lưu hồ sơ & đồng bộ ảnh AI"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: READ-ONLY VISIT HISTORY */}
        {activeTab === "history" && (
          <div key="history" className="space-y-6 animate-page-enter">
            {/* Read-only notice */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs text-primary flex items-start gap-2">
              <Eye size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong className="font-bold">Chế độ chỉ xem (Read-Only):</strong> Giảng viên chỉ có quyền tra cứu lịch sử ra/vào. Không có quyền Thêm / Sửa / Xóa dữ liệu hay cấu hình hệ thống.
              </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Tổng lượt ghi nhận</p>
                <p className="font-display text-2xl font-bold text-foreground mt-1">{totalVisits}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sinh viên ra/vào khoa</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Đã tiếp nhận</p>
                <p className="font-display text-2xl font-bold text-primary mt-1">{servedVisits}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cán bộ đã hỗ trợ</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Đang chờ</p>
                <p className="font-display text-2xl font-bold text-secondary mt-1">{waitingVisits}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sinh viên hiện có mặt</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Chưa tiếp nhận</p>
                <p className="font-display text-2xl font-bold text-offline mt-1">{unattendedVisits}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Bỏ qua / quá hạn</p>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                      Tìm kiếm
                    </label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="MSSV / Họ tên / Lớp..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="focus-ring w-full h-10 rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                      Camera
                    </label>
                    <select
                      value={cameraFilter}
                      onChange={(e) => setCameraFilter(e.target.value)}
                      className="focus-ring w-full h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground transition-colors"
                    >
                      <option value="all">Tất cả Camera</option>
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                      Trạng thái
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="focus-ring w-full h-10 rounded-xl border border-border bg-background px-3 text-xs text-foreground transition-colors"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="Served">Đã tiếp nhận</option>
                      <option value="Waiting">Đang chờ</option>
                      <option value="Unattended">Chưa tiếp nhận</option>
                      <option value="Exited">Đã ra</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadHistory}
                  className="focus-ring flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw size={14} />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {/* History Table */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border/80 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Nhật ký sinh viên ra/vào khoa
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dữ liệu thời gian thực được ghi nhận tự động bởi hệ thống camera AI
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Hiển thị {filteredVisits.length} / {visits.length} bản ghi
                </span>
              </div>

              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                  Đang tải lịch sử ra vào...
                </div>
              ) : historyError ? (
                <div className="p-8 text-center">
                  <AlertCircle size={28} className="mx-auto mb-2 text-offline" />
                  <p className="text-xs font-semibold text-offline">{historyError}</p>
                  <button
                    type="button"
                    onClick={loadHistory}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <RefreshCw size={13} /> Thử lại
                  </button>
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                    <Calendar size={24} />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Không có dữ liệu phù hợp
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {visits.length === 0
                      ? "Chưa có lượt ra/vào nào được ghi nhận trong hệ thống."
                      : "Không tìm thấy bản ghi nào khớp với bộ lọc hiện tại."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/30">
                        <th className="px-4 py-3">Sinh viên</th>
                        <th className="px-4 py-3">Thời gian vào</th>
                        <th className="px-4 py-3">Thời gian ra</th>
                        <th className="px-4 py-3">Thời lưu lại</th>
                        <th className="px-4 py-3">Camera</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Ảnh chụp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredVisits.slice(0, 100).map((v) => (
                        <tr
                          key={v.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedRecord(v)}
                          title="Bấm để xem chi tiết"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <StudentAvatar
                                src={v.avatarUrl}
                                name={v.studentName}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate max-w-[180px]">
                                  {v.studentName}
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {v.studentId} · {v.className}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">
                            {fmtDateTime(v.enteredAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {v.exitedAt ? (
                              fmtDateTime(v.exitedAt)
                            ) : (
                              <span className="text-primary font-semibold">Đang có mặt</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground whitespace-nowrap">
                            {fmtDuration(v.durationSeconds)}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {v.cameraId}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={v.status} />
                          </td>
                          <td className="px-4 py-3">
                            {(v as any).snapshotUrl || (v as any).bestCrop ? (
                              <SnapshotImage
                                src={(v as any).snapshotUrl || (v as any).bestCrop}
                                alt={`Snapshot của ${v.studentName}`}
                                className="h-9 w-12"
                                label=""
                              />
                            ) : (
                              <div className="flex h-9 w-12 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground/60">
                                <ImageIcon size={14} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredVisits.length > 100 && (
                    <div className="border-t border-border/60 px-4 py-3 text-center text-[11px] text-muted-foreground">
                      Đang hiển thị 100 bản ghi đầu tiên. Hãy thu hẹp bộ lọc để xem chi tiết hơn.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KPI Footer Hint */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Clock size={13} />
                <span>
                  Dữ liệu realtime từ camera AI · Cập nhật lần cuối: {loadingHistory ? "Đang tải..." : fmtDateTime(new Date().toISOString())}
                </span>
              </div>
              <span className="font-medium">
                Tổng số camera giám sát: <span className="text-primary">{cameras.length}</span>
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Read-Only Visit Detail Drawer */}
      <VisitDetailDrawer
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

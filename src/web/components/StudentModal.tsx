// src/web/components/StudentModal.tsx
// Modal for adding or editing a student with Webcam portrait capture (Task 4.1)
// + Supabase submission. File uploads have been disabled by design — every
// snapshot must come from `getUserMedia` so admins can guarantee consistent
// face-on, well-lit portraits before they reach the AI pipeline.
import React, { useState } from "react";
import { uploadImageToCloudinary } from "../../lib/cloudinary";
import { upsertStudent, submitPendingStudent } from "../../lib/supabase";
import { StudentAvatar } from "./AvatarFallback";
import WebcamCapture from "./WebcamCapture";
import { Hourglass, X } from "lucide-react";

export interface StudentFormData {
  student_id: string;
  full_name: string;
  class_name: string;
  email: string;
  portrait_url: string;
}

interface StudentModalProps {
  open: boolean;
  initialData?: StudentFormData | null;
  onClose: () => void;
  onSuccess: (saved: StudentFormData) => void;
  /**
   * When true (default for the "Thêm sinh viên" Admin flow) the form
   * writes into the staging `pending_students` table instead of
   * `upsertStudent`. Required by Task 4.1 — the new-student path
   * must always route through the Admin approval queue.
   */
  requireApproval?: boolean;
  /** Caller-provided callback fired after a successful pending submission
   *  so the parent (e.g. the approval page) can refresh immediately. */
  onSubmittedPending?: (saved: StudentFormData) => void;
}

interface StudentModalFormBodyProps {
  initialData?: StudentFormData | null;
  onClose: () => void;
  onSuccess: (saved: StudentFormData) => void;
  requireApproval: boolean;
  onSubmittedPending?: (saved: StudentFormData) => void;
}

function StudentModalForm({
  initialData,
  onClose,
  onSuccess,
  requireApproval,
  onSubmittedPending,
}: StudentModalFormBodyProps) {
  const [formData, setFormData] = useState<StudentFormData>(() => ({
    student_id: initialData?.student_id || "",
    full_name: initialData?.full_name || "",
    class_name: initialData?.class_name || "",
    email: initialData?.email || "",
    portrait_url: initialData?.portrait_url || "",
  }));

  // Task 4.1: file `<input type="file">` đã bị KHOÁ hoàn toàn. Ảnh chỉ
  // đến từ component `WebcamCapture` dưới dạng Blob + data URL.
  const [webcamBlob, setWebcamBlob] = useState<Blob | null>(null);
  const [webcamPreviewUrl, setWebcamPreviewUrl] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>(() => initialData?.portrait_url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [submittedToQueue, setSubmittedToQueue] = useState(false);

  const isEditing = Boolean(initialData?.student_id);

  const handleWebcamCapture = ({ blob, dataUrl }: { blob: Blob; dataUrl: string }) => {
    setWebcamBlob(blob);
    setWebcamPreviewUrl(dataUrl);
    setPreviewUrl(dataUrl);
    setErrorMsg("");
  };

  const handleWebcamReset = () => {
    setWebcamBlob(null);
    setWebcamPreviewUrl("");
    setPreviewUrl(formData.portrait_url || "");
    setErrorMsg("");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.student_id.trim()) {
      setErrorMsg("Vui lòng nhập Mã số sinh viên.");
      return;
    }
    if (!formData.full_name.trim()) {
      setErrorMsg("Vui lòng nhập Họ tên sinh viên.");
      return;
    }
    if (!webcamBlob && !formData.portrait_url) {
      setErrorMsg(
        "Vui lòng bật Webcam chụp ảnh khuôn mặt trước khi lưu hồ sơ.",
      );
      return;
    }

    setIsSubmitting(true);
    let uploadedUrl = formData.portrait_url;

    // 1. Upload ảnh chụp Webcam lên Cloudinary (nếu có frame mới)
    if (webcamBlob) {
      try {
        const file = new File([webcamBlob], "webcam-portrait.jpg", {
          type: "image/jpeg",
        });
        const uploadRes = await uploadImageToCloudinary(file);
        if (uploadRes.success && uploadRes.url) {
          uploadedUrl = uploadRes.url;
        } else {
          setErrorMsg(uploadRes.error || "Không thể tải ảnh lên Cloudinary.");
          setIsSubmitting(false);
          return;
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Lỗi tải ảnh");
        setIsSubmitting(false);
        return;
      }
    }

    // 2. Tạo payload chung
    const payload: StudentFormData = {
      student_id: formData.student_id.trim(),
      full_name: formData.full_name.trim(),
      class_name: formData.class_name.trim(),
      email: formData.email.trim(),
      portrait_url: uploadedUrl,
    };

    // 3. Theo Task 4.1: với sinh viên mới và ở chế độ yêu cầu duyệt,
    //    ghi vào `pending_students` (status='pending') thay vì upsert
    //    trực tiếp. Ngược lại (đang edit), giữ hành vi cũ để tương
    //    thích với luồng chỉnh sửa đã có.
    if (requireApproval && !isEditing) {
      const res = await submitPendingStudent({
        student_id: payload.student_id,
        full_name: payload.full_name,
        class_name: payload.class_name,
        email: payload.email,
        portrait_url: payload.portrait_url,
      });
      setIsSubmitting(false);
      if (res.success) {
        setSubmittedToQueue(true);
        onSubmittedPending?.(payload);
        // Keep the modal open briefly so the user sees the success hint,
        // then auto-close after a short delay (UX consistency).
        setTimeout(() => {
          onSuccess(payload);
          onClose();
        }, 1400);
      } else {
        setErrorMsg(res.error || "Không thể gửi hồ sơ chờ duyệt.");
      }
      return;
    }

    const res = await upsertStudent(payload);
    setIsSubmitting(false);

    if (res.success) {
      onSuccess(payload);
      onClose();
    } else {
      setErrorMsg(res.error || "Không thể lưu hồ sơ sinh viên vào Supabase.");
    }
  }

  return (
    <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-modal-zoom">
      <div className="flex items-center justify-between border-b border-border/80 p-6 pb-4 shrink-0">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {isEditing ? "Chỉnh sửa thông tin sinh viên" : "Đăng ký sinh viên mới"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hồ sơ sinh viên và dữ liệu khuôn mặt cho mô hình AI InsightFace
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="focus-ring rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="overflow-y-auto p-6 pt-4 space-y-4">
        {errorMsg ? (
        <div className="mt-4 rounded-lg border border-offline/40 bg-offline/10 p-3 text-xs text-offline">
          {errorMsg}
        </div>
      ) : null}

      {submittedToQueue && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-online/40 bg-online/10 p-3 text-xs text-online">
          <Hourglass size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Đã gửi hồ sơ vào bảng chờ duyệt.</p>
            <p className="mt-0.5 text-[11px]">
              Quản trị viên sẽ xem xét và duyệt ảnh Webcam trên trang "Phê duyệt hồ sơ".
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Portrait Photo via WebcamCapture (Task 4.1) */}
        <div className="rounded-xl border border-border/70 bg-background/50 p-4">
          <label className="block text-xs font-semibold text-foreground mb-2">
            Ảnh chân dung (Portrait / Nhận diện khuôn mặt)
          </label>
          <div className="flex items-center gap-4">
            <StudentAvatar
              src={previewUrl}
              name={formData.full_name || "SV"}
              size="xl"
              className="h-20 w-20 border-2 border-primary/40"
            />

            <div className="flex-1">
              {/* KHÔNG còn `<input type="file">` ở đây — đã bị khoá. */}
              {previewUrl && !webcamPreviewUrl && (
                <p className="text-[11px] text-muted-foreground">
                  Ảnh chân dung hiện tại đã được lưu trước đó. Bạn có thể chụp lại ảnh Webcam bên dưới để thay thế.
                </p>
              )}
              {!previewUrl && !webcamPreviewUrl && (
                <p className="text-[11px] text-muted-foreground">
                  Bật Webcam và chụp ảnh khuôn mặt trực diện để hệ thống AI nhận diện.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3">
            <WebcamCapture
              onCapture={handleWebcamCapture}
              onReset={handleWebcamReset}
              compact
              fileUploadDisabled
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="student_id" className="block text-xs font-semibold text-foreground mb-1">
              Mã sinh viên (MSSV) <span className="text-offline">*</span>
            </label>
            <input
              id="student_id"
              type="text"
              required
              disabled={isEditing}
              placeholder="VD: 2212390"
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="class_name" className="block text-xs font-semibold text-foreground mb-1">
              Lớp / Khóa
            </label>
            <input
              id="class_name"
              type="text"
              placeholder="VD: CTK44, CTK45"
              value={formData.class_name}
              onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
              className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        <div>
          <label htmlFor="full_name" className="block text-xs font-semibold text-foreground mb-1">
            Họ và tên sinh viên <span className="text-offline">*</span>
          </label>
          <input
            id="full_name"
            type="text"
            required
            placeholder="VD: Nguyễn Văn An"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1">
            Email liên hệ
          </label>
          <input
            id="email"
            type="email"
            placeholder="VD: 2212390@dlu.edu.vn"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/80 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="focus-ring rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 hover:scale-[1.01] active:scale-[0.98] shadow-sm disabled:opacity-50 transition-all duration-200 cursor-pointer"
          >
            {isSubmitting ? <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : null}
            {isSubmitting
              ? "Đang xử lý & Tải ảnh..."
              : isEditing
              ? "Lưu thay đổi"
              : requireApproval
              ? "Gửi Admin phê duyệt"
              : "Lưu sinh viên"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

export default function StudentModal({
  open,
  initialData,
  onClose,
  onSuccess,
  requireApproval = true,
  onSubmittedPending,
}: StudentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in cursor-pointer" onClick={onClose} />

      <StudentModalForm
        key={initialData ? initialData.student_id : "new_student"}
        initialData={initialData}
        onClose={onClose}
        onSuccess={onSuccess}
        requireApproval={requireApproval}
        onSubmittedPending={onSubmittedPending}
      />
    </div>
  );
}

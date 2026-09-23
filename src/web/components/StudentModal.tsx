// src/web/components/StudentModal.tsx
// Modal for adding or editing a student with Cloudinary portrait upload and Supabase save.
import React, { useState } from "react";
import { uploadImageToCloudinary } from "../../lib/cloudinary";
import { upsertStudent } from "../../lib/supabase";
import { StudentAvatar } from "./AvatarFallback";
import { X } from "lucide-react";

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
}

function StudentModalForm({
  initialData,
  onClose,
  onSuccess,
}: {
  initialData?: StudentFormData | null;
  onClose: () => void;
  onSuccess: (saved: StudentFormData) => void;
}) {
  const [formData, setFormData] = useState<StudentFormData>(() => ({
    student_id: initialData?.student_id || "",
    full_name: initialData?.full_name || "",
    class_name: initialData?.class_name || "",
    email: initialData?.email || "",
    portrait_url: initialData?.portrait_url || "",
  }));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(() => initialData?.portrait_url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const isEditing = Boolean(initialData?.student_id);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Vui lòng chọn file hình ảnh (JPG, PNG, WEBP).");
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setErrorMsg("");
    }
  }

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

    setIsSubmitting(true);
    let uploadedUrl = formData.portrait_url;

    // 1. Upload photo to Cloudinary if a new file was chosen
    if (selectedFile) {
      try {
        const uploadRes = await uploadImageToCloudinary(selectedFile);
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

    // 2. Save student record to Supabase
    const payload = {
      student_id: formData.student_id.trim(),
      full_name: formData.full_name.trim(),
      class_name: formData.class_name.trim(),
      email: formData.email.trim(),
      portrait_url: uploadedUrl,
    };

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
    <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-fade-in-up">
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Portrait Photo Upload & Preview */}
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
              <input
                type="file"
                id="portrait-file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="portrait-file"
                className="focus-ring inline-block cursor-pointer rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                {previewUrl ? "Thay đổi ảnh..." : "Chọn ảnh từ máy..."}
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ảnh mặt trực diện, rõ nét, định dạng JPG/PNG. Sẽ tự động tải lên Cloudinary.
              </p>
            </div>
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
            className="focus-ring rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : null}
            {isSubmitting ? "Đang xử lý & Tải ảnh..." : isEditing ? "Lưu thay đổi" : "Lưu sinh viên"}
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
}: StudentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />

      <StudentModalForm
        key={initialData ? initialData.student_id : "new_student"}
        initialData={initialData}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}

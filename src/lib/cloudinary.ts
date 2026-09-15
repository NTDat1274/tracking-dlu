// src/lib/cloudinary.ts
// Direct client-side image upload to Cloudinary.
import { getCloudConfig } from "./config";

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  publicId?: string;
  error?: string;
}

/**
 * Uploads an image file to Cloudinary.
 * Falls back to a local DataURL preview if Cloudinary credentials are not yet configured.
 */
export async function uploadImageToCloudinary(
  file: File,
  folder = "trackingz/portraits"
): Promise<CloudinaryUploadResult> {
  const config = getCloudConfig();
  const cloudName = config.cloudinaryCloudName?.trim();
  const uploadPreset = config.cloudinaryUploadPreset?.trim();

  // If credentials are not provided, generate a local base64 Data URL
  if (!cloudName || !uploadPreset) {
    console.warn("Cloudinary not configured. Generating local Data URL for preview.");
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          success: true,
          url: reader.result as string,
          error: "Cloudinary chưa được cấu hình. Đang dùng ảnh nội bộ để chạy thử nghiệm.",
        });
      };
      reader.onerror = () => {
        resolve({
          success: false,
          url: "",
          error: "Không thể đọc file ảnh.",
        });
      };
      reader.readAsDataURL(file);
    });
  }

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    if (folder) {
      formData.append("folder", folder);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `HTTP ${response.status}: Upload failed`;
      console.error("Cloudinary upload failed:", errMsg);
      // Generate local preview so user action doesn't get blocked
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            success: true,
            url: reader.result as string,
            error: `Lỗi Cloudinary (${errMsg}). Đã dùng ảnh xem trước tạm thời.`,
          });
        };
        reader.readAsDataURL(file);
      });
    }

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (err: any) {
    console.error("Network error during Cloudinary upload:", err);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          success: true,
          url: reader.result as string,
          error: "Lỗi kết nối Cloudinary. Đã dùng ảnh xem trước tạm thời.",
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

// src/lib/config.ts
// Centralized Cloud Configuration Manager for Supabase & Cloudinary.
// Supports safe obfuscation in LocalStorage with fallback to Vite Environment variables (.env.local).

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryUploadPreset: string;
}

const STORAGE_KEY = "trackingz_cloud_config_secure";
const STORAGE_LEGACY_KEY = "trackingz_cloud_config";

// Default configurations (Vite env fallback from .env.local)
const DEFAULT_CONFIG: CloudConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  cloudinaryCloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: import.meta.env.VITE_CLOUDINARY_API_KEY || "",
  cloudinaryUploadPreset:
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
    "trackingz_presets",
};

// Simple obfuscation helpers to avoid plain-text exposure in browser developer tools
function obfuscate(str: string): string {
  if (!str) return "";
  try {
    return btoa(encodeURIComponent(str));
  } catch {
    return str;
  }
}

function deobfuscate(str: string): string {
  if (!str) return "";
  try {
    return decodeURIComponent(atob(str));
  } catch {
    return str;
  }
}

export function getCloudConfig(): CloudConfig {
  // Always prioritize environment variables if set in .env.local
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        supabaseUrl:
          envUrl ||
          deobfuscate(parsed.supabaseUrl) ||
          DEFAULT_CONFIG.supabaseUrl,
        supabaseAnonKey:
          envKey ||
          deobfuscate(parsed.supabaseAnonKey) ||
          DEFAULT_CONFIG.supabaseAnonKey,
        cloudinaryCloudName:
          deobfuscate(parsed.cloudinaryCloudName) ||
          DEFAULT_CONFIG.cloudinaryCloudName,
        cloudinaryApiKey:
          deobfuscate(parsed.cloudinaryApiKey) ||
          DEFAULT_CONFIG.cloudinaryApiKey,
        cloudinaryUploadPreset:
          deobfuscate(parsed.cloudinaryUploadPreset) ||
          DEFAULT_CONFIG.cloudinaryUploadPreset,
      };
    }

    // Legacy fallback migration
    const legacy = localStorage.getItem(STORAGE_LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated: CloudConfig = {
        supabaseUrl: envUrl || parsed.supabaseUrl || DEFAULT_CONFIG.supabaseUrl,
        supabaseAnonKey:
          envKey || parsed.supabaseAnonKey || DEFAULT_CONFIG.supabaseAnonKey,
        cloudinaryCloudName:
          parsed.cloudinaryCloudName || DEFAULT_CONFIG.cloudinaryCloudName,
        cloudinaryApiKey:
          parsed.cloudinaryApiKey || DEFAULT_CONFIG.cloudinaryApiKey,
        cloudinaryUploadPreset:
          parsed.cloudinaryUploadPreset ||
          DEFAULT_CONFIG.cloudinaryUploadPreset,
      };
      saveCloudConfig(migrated);
      localStorage.removeItem(STORAGE_LEGACY_KEY);
      return migrated;
    }
  } catch (err) {
    console.error("Failed to parse cloud config:", err);
  }

  return DEFAULT_CONFIG;
}

export function saveCloudConfig(config: CloudConfig): void {
  if (typeof window === "undefined") return;
  try {
    const obfuscated = {
      supabaseUrl: obfuscate(config.supabaseUrl),
      supabaseAnonKey: obfuscate(config.supabaseAnonKey),
      cloudinaryCloudName: obfuscate(config.cloudinaryCloudName),
      cloudinaryApiKey: obfuscate(config.cloudinaryApiKey),
      cloudinaryUploadPreset: obfuscate(config.cloudinaryUploadPreset),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obfuscated));
    window.dispatchEvent(
      new CustomEvent("cloud_config_updated", { detail: config }),
    );
  } catch (err) {
    console.error("Failed to save cloud config:", err);
  }
}

/**
 * Tests connection to the configured Supabase project.
 */
export async function testSupabaseConnection(
  url?: string,
  anonKey?: string,
): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const cfg = getCloudConfig();
  const testUrl = (url ?? cfg.supabaseUrl).trim();
  const testKey = (anonKey ?? cfg.supabaseAnonKey).trim();

  if (!testUrl || !testKey) {
    return {
      success: false,
      message: "Vui lòng điền đầy đủ Supabase Project URL và Anon API Key.",
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch(`${testUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: testKey,
        Authorization: `Bearer ${testKey}`,
      },
    });

    const latency = Date.now() - startTime;
    if (response.ok || response.status === 200 || response.status === 404) {
      return {
        success: true,
        message: `Kết nối thành công tới Supabase! (Độ trễ: ${latency}ms)`,
        latencyMs: latency,
      };
    } else {
      let errorMessage = `Máy chủ phản hồi mã lỗi HTTP ${response.status}: ${response.statusText}`;
      if (response.status === 401) {
        errorMessage = "Lỗi 401 (Unauthorized): API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại khóa 'anon' public key.";
      } else if (response.status === 403) {
        errorMessage = "Lỗi 403 (Forbidden): Không có quyền truy cập. Vui lòng kiểm tra RLS (Row Level Security).";
      }
      return {
        success: false,
        message: errorMessage,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Không thể kết nối đến ${testUrl}. Chi tiết lỗi: ${err?.message || "Lỗi mạng"}`,
    };
  }
}

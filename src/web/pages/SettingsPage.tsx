// src/web/pages/SettingsPage.tsx
// Cloud Connection Settings with Security Masking (Hide/Show toggle) & .env.local recommendation.
import { useState } from "react";
import { getCloudConfig, saveCloudConfig, testSupabaseConnection, type CloudConfig } from "../../lib/config";
import { Shield, Check, AlertTriangle, EyeOff, Eye } from "lucide-react";

export default function SettingsPage() {
  const [config, setConfig] = useState<CloudConfig>(() => getCloudConfig());
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(config.supabaseUrl, config.supabaseAnonKey);
    setTesting(false);
    setTestResult(res);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveCloudConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Cấu hình Hệ thống & Kết nối Cloud</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Thiết lập thông tin dự án Supabase và dịch vụ lưu trữ đa phương tiện Cloudinary cho Web Admin TrackingZ
        </p>
        <div className="page-title-accent" />
      </div>

      {/* Security Advisory Notice */}
      <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4 text-xs text-foreground flex items-start gap-3">
        <Shield className="text-secondary" size={20} />
        <div className="space-y-1">
          <p className="font-bold text-secondary">Khuyến nghị Bảo mật Tối ưu:</p>
          <p className="text-muted-foreground">
            Các API Key được tự động che dấu bằng dấu chấm tròn (<span className="font-mono">••••••••</span>). 
            Trong môi trường vận hành chính thức, khuyến khích cấu hình trực tiếp vào tệp <code className="rounded bg-muted px-1.5 py-0.5 text-primary font-mono font-semibold">.env.local</code> 
            để ngăn ngừa rò rỉ thông qua trình duyệt người dùng.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-xs font-semibold text-primary flex items-center gap-2 animate-fade-in-up">
          <Check size={16} className="inline" /> Đã lưu cấu hình an toàn vào hệ thống. Các kết nối mới sẽ áp dụng ngay lập tức.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Supabase Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-sm">
                S
              </div>
              <div>
                <h2 className="font-display text-sm font-bold text-foreground">Supabase PostgreSQL & Auth</h2>
                <p className="text-[11px] text-muted-foreground">Cơ sở dữ liệu đám mây và xác thực phân quyền Admin</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !config.supabaseUrl || !config.supabaseAnonKey}
              className="focus-ring flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all duration-200 cursor-pointer"
            >
              {testing && <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
              {testing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
            </button>
          </div>

          {testResult && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
                testResult.success
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-offline/40 bg-offline/10 text-offline"
              }`}
            >
              <span className="flex items-center gap-1">{testResult.success ? <Check size={16} /> : <AlertTriangle size={16} />}</span>
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Supabase Project URL (SUPABASE_URL)
              </label>
              <input
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={config.supabaseUrl}
                onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
                className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  Supabase Anon Key (SUPABASE_ANON_KEY)
                </label>
                <button
                  type="button"
                  onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  className="focus-ring flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <span className="flex items-center gap-1">{showSupabaseKey ? <><EyeOff size={14}/> Ẩn key</> : <><Eye size={14}/> Hiện key</>}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showSupabaseKey ? "text" : "password"}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={config.supabaseAnonKey}
                  onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
                  className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground tracking-wider"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cloudinary Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/15 text-secondary font-bold text-sm">
              C
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">Cloudinary Media Storage</h2>
              <p className="text-[11px] text-muted-foreground">
                Lưu trữ ảnh snapshot camera và ảnh chân dung nhận diện khuôn mặt
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Cloud Name (CLOUDINARY_CLOUD_NAME)
              </label>
              <input
                type="text"
                placeholder="VD: dlu-trackingz"
                value={config.cloudinaryCloudName}
                onChange={(e) => setConfig({ ...config, cloudinaryCloudName: e.target.value })}
                className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  API Key (CLOUDINARY_API_KEY)
                </label>
                <button
                  type="button"
                  onClick={() => setShowCloudinaryKey(!showCloudinaryKey)}
                  className="focus-ring flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <span className="flex items-center gap-1">{showCloudinaryKey ? <><EyeOff size={14}/> Ẩn</> : <><Eye size={14}/> Hiện</>}</span>
                </button>
              </div>
              <input
                type={showCloudinaryKey ? "text" : "password"}
                placeholder="•••••••••••••••"
                value={config.cloudinaryApiKey}
                onChange={(e) => setConfig({ ...config, cloudinaryApiKey: e.target.value })}
                className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground tracking-wider"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Upload Preset (Unsigned Preset)
              </label>
              <input
                type="text"
                placeholder="VD: trackingz_preset"
                value={config.cloudinaryUploadPreset}
                onChange={(e) => setConfig({ ...config, cloudinaryUploadPreset: e.target.value })}
                className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="focus-ring flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] shadow-md transition-all duration-200 cursor-pointer"
          >
            Lưu Cấu Hình An Toàn
          </button>
        </div>
      </form>
    </div>
  );
}

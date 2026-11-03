// src/web/components/WebcamCapture.tsx
// Chụp ảnh chân dung trực tiếp qua Camera thiết bị (PC & Mobile).
// Tối ưu chuẩn ảnh thẻ sinh viên 3:4, khuôn mặt tự nhiên, không viền đen nhân tạo.
// Tuân thủ toàn diện: ui-ux-pro-max, frontend-design, vercel-react-best-practices.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Camera,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Lock,
  SwitchCamera,
  ShieldAlert,
  Timer,
  X,
} from "lucide-react";

import {
  classifyCameraError,
  requestMediaStreamWithFallback,
  stopMediaStreamTracks,
  analyzeLumaValues,
  type CameraStatus,
  type BrightnessCheck,
} from "./WebcamCaptureLogic";

export interface WebcamCaptureProps {
  /** Callback trả về ảnh đã chụp dưới dạng JPEG Blob + data URL. */
  onCapture: (payload: { blob: Blob; dataUrl: string }) => void;
  /** Callback khi người dùng bấm chụp lại. */
  onReset?: () => void;
  /** Callback khi người dùng muốn đóng camera (nếu đã có ảnh trước đó). */
  onCancel?: () => void;
  /** Tỉ lệ khung hình (mặc định = 3/4 cho ảnh thẻ chân dung). */
  aspectRatio?: number;
  /** Chế độ thu gọn khi nhúng vào modal hẹp. */
  compact?: boolean;
  /** Hiển thị nhãn tính năng upload file đã bị khóa. */
  fileUploadDisabled?: boolean;
}

/**
 * Phân tích độ sáng và độ nét của ảnh chụp (Downscale canvas + Luma mean + Stddev).
 */
function analyzeBrightness(dataUrl: string): Promise<BrightnessCheck> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const target = 96;
        const ratio = Math.min(target / img.width, target / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ avgLuma: 128, stddev: 30, isAcceptable: true });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const samples: number[] = [];
        for (let i = 0; i < data.length; i += 4) {
          // Rec. 601 standard luma
          const luma =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          samples.push(luma);
        }
        resolve(analyzeLumaValues(samples));
      } catch (err) {
        console.warn("Lỗi phân tích độ sáng ảnh:", err);
        resolve({ avgLuma: 128, stddev: 30, isAcceptable: true });
      }
    };
    img.onerror = () =>
      resolve({ avgLuma: 128, stddev: 30, isAcceptable: true });
    img.src = dataUrl;
  });
}

/**
 * Chụp khung hình từ thẻ <video> thành ảnh chân dung tự nhiên (JPEG Blob + dataUrl).
 * Giữ nguyên màu sắc và nét mặt tự nhiên tỉ lệ 3:4, KHÔNG cắt xén viền đen,
 * KHÔNG vẽ vòng tròn nhân tạo đè lên mặt người dùng.
 */
function snapFrame(
  video: HTMLVideoElement,
  width: number,
  height: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Không thể khởi tạo canvas đồ họa."));
      return;
    }

    // 1. Áp dụng object-fit: cover để giữ tỉ lệ khuôn mặt chuẩn tự nhiên
    const vw = video.videoWidth || width;
    const vh = video.videoHeight || height;
    const scale = Math.max(width / vw, height / vh);
    const dx = (width - vw * scale) / 2;
    const dy = (height - vh * scale) / 2;
    const dw = vw * scale;
    const dh = vh * scale;

    // 2. Vẽ trực tiếp khung hình tự nhiên, không cắt đen xung quanh
    ctx.drawImage(video, dx, dy, dw, dh);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không thể mã hoá ảnh chụp JPEG."));
          return;
        }
        resolve({ blob, dataUrl });
      },
      "image/jpeg",
      0.95,
    );
  });
}

export default function WebcamCapture({
  onCapture,
  onReset,
  onCancel,
  aspectRatio = 3 / 4,
  compact = false,
  fileUploadDisabled = true,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<BrightnessCheck | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Kiểm tra thiết bị có nhiều camera (camera trước & sau trên điện thoại)
  useEffect(() => {
    let active = true;
    async function checkDevices() {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          if (active) {
            setHasMultipleCameras(videoDevices.length > 1);
          }
        }
      } catch (err) {
        console.warn("Không thể liệt kê thiết bị camera:", err);
      }
    }
    checkDevices();
    return () => {
      active = false;
    };
  }, []);

  // Giải phóng MediaStream tracks khi unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        stopMediaStreamTracks(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  // Khởi động Camera
  const startCamera = useCallback(async (mode: "user" | "environment" = facingMode) => {
    if (streamRef.current) {
      stopMediaStreamTracks(streamRef.current);
      streamRef.current = null;
    }

    setStatus("requesting");
    setErrorMsg("");
    setSnapshotUrl(null);
    setBrightness(null);

    const isSecure =
      typeof window !== "undefined"
        ? window.isSecureContext ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        : true;

    try {
      const stream = await requestMediaStreamWithFallback(
        mode,
        navigator.mediaDevices,
        isSecure,
      );

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Lỗi tự động phát video:", playErr);
        }
      }

      setStatus("ready");
    } catch (err: any) {
      console.warn("Khởi động camera thất bại:", err);
      const classified = classifyCameraError(err, isSecure);
      setStatus(classified.status);
      setErrorMsg(classified.message);
    }
  }, [facingMode]);

  // Đổi camera trước / sau (chuyên dụng trên điện thoại)
  const toggleFacingMode = useCallback(() => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Dừng camera và đóng
  const handleStopAndCancel = useCallback(() => {
    if (streamRef.current) {
      stopMediaStreamTracks(streamRef.current);
      streamRef.current = null;
    }
    setStatus("idle");
    onCancel?.();
  }, [onCancel]);

  // Chụp ảnh chân dung
  const performCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    // Chuẩn kích thước ảnh chân dung 3:4 chất lượng cao
    const targetW = 480;
    const targetH = Math.round(targetW / aspectRatio);

    try {
      const capture = await snapFrame(video, targetW, targetH);

      // Tắt camera sau khi chụp để tiết kiệm pin
      if (streamRef.current) {
        stopMediaStreamTracks(streamRef.current);
        streamRef.current = null;
      }

      setSnapshotUrl(capture.dataUrl);
      setStatus("captured");
      setIsAnalyzing(true);

      const check = await analyzeBrightness(capture.dataUrl);
      setBrightness(check);
      setIsAnalyzing(false);

      onCapture(capture);
    } catch (err: any) {
      console.error("Chụp ảnh thất bại:", err);
      setErrorMsg(err?.message || "Lỗi xử lý ảnh chụp, vui lòng thử lại.");
      setStatus("ready");
    }
  }, [aspectRatio, onCapture]);

  // Hẹn giờ đếm ngược 3 giây
  const startCountdown = useCallback(() => {
    if (status !== "ready") return;
    setCountdown(3);
    let remaining = 3;
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        setCountdown(null);
        performCapture();
      } else {
        setCountdown(remaining);
      }
    }, 700);
  }, [status, performCapture]);

  // Chụp lại
  const handleRetake = useCallback(() => {
    setSnapshotUrl(null);
    setBrightness(null);
    onReset?.();
    startCamera(facingMode);
  }, [onReset, startCamera, facingMode]);

  const isLive = status === "ready";
  const isReviewing = status === "captured";

  const brightnessLabel = useMemo(() => {
    if (!brightness) return null;
    if (!brightness.isAcceptable) {
      if (brightness.avgLuma < 35) return "Ảnh hơi tối";
      if (brightness.avgLuma > 220) return "Ảnh quá sáng / ngược sáng";
      return "Khuôn mặt chưa rõ nét";
    }
    return "Độ sáng & nét mặt đạt chuẩn";
  }, [brightness]);

  return (
    <div className={`flex w-full flex-col gap-3 ${compact ? "text-xs" : "text-sm"}`}>
      {/* Khung hiển thị Camera Viewport (Tỉ lệ 3:4 chuẩn chân dung) */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-md ${
          compact ? "aspect-[3/4] max-h-80" : "aspect-[3/4] max-w-sm mx-auto"
        }`}
      >
        {/* Live Video */}
        {!isReviewing && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              isLive ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Khung xem trước ảnh chụp tự nhiên */}
        {isReviewing && snapshotUrl && (
          <img
            src={snapshotUrl}
            alt="Ảnh chân dung đã chụp"
            className="h-full w-full object-cover animate-success-pop"
          />
        )}

        {/* Trạng thái Chờ (Idle State) - Thiết kế thanh lịch, sáng rõ trên cả 2 theme */}
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center backdrop-blur-xs">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-card text-primary shadow-xs">
              <Camera size={28} />
            </div>

            <div className="space-y-1">
              <p className="font-display font-bold text-foreground text-sm">
                Chụp ảnh chân dung
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Mở camera thiết bị để chụp ảnh chân dung khuôn mặt trực tiếp.
              </p>
            </div>

            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="focus-ring mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 transition-all cursor-pointer"
            >
              <Camera size={15} />
              Bật Camera chụp ảnh
            </button>

            {fileUploadDisabled && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/90 px-2.5 py-0.5 text-[10px] text-muted-foreground">
                <Lock size={10} />
                Tính năng tải file ảnh từ máy đã được khoá.
              </p>
            )}
          </div>
        )}

        {/* Trạng thái Đang kết nối hoặc Bị lỗi (Luôn dùng text trắng nổi bật trên nền đen) */}
        {status !== "idle" && !isLive && !isReviewing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-5 text-center text-white backdrop-blur-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-sm">
              {status === "requesting" ? (
                <Loader2 size={28} className="animate-spin text-primary" />
              ) : status === "insecure" ? (
                <ShieldAlert size={28} className="text-amber-400" />
              ) : (
                <AlertTriangle size={28} className="text-red-400" />
              )}
            </div>

            <div className="space-y-1 max-w-xs text-white">
              <p className="font-bold text-sm text-white">
                {status === "requesting"
                  ? "Đang kết nối Camera..."
                  : status === "denied"
                  ? "Quyền Camera bị từ chối"
                  : status === "unavailable"
                  ? "Không tìm thấy thiết bị Camera"
                  : status === "insecure"
                  ? "Yêu cầu kết nối an toàn (HTTPS)"
                  : "Lỗi khởi động Camera"}
              </p>

              <p className="text-[12px] text-slate-300">
                {status === "requesting"
                  ? "Trình duyệt đang mở camera, vui lòng xác nhận cấp quyền nếu được hỏi..."
                  : errorMsg}
              </p>
            </div>

            {status !== "requesting" && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 cursor-pointer"
                >
                  <Camera size={14} />
                  Thử lại
                </button>
                {onCancel && (
                  <button
                    type="button"
                    onClick={handleStopAndCancel}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                  >
                    Đóng
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Khung hướng dẫn Oval HUD mượt mà (Chỉ hiển thị khi đang live video) */}
        {isLive && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {/* Lớp viền Oval HUD thanh lịch */}
            <div
              className="relative rounded-[50%] border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(7,9,12,0.4)] transition-all"
              style={{
                width: "72%",
                height: "76%",
              }}
            >
              <div className="absolute left-1/2 -top-3 -translate-x-1/2 rounded-full border border-white/40 bg-black/75 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase backdrop-blur-xs shadow-xs">
                Đặt khuôn mặt vào đây
              </div>
            </div>
          </div>
        )}

        {/* Nút lật camera trước / sau (Đặc thù điện thoại) */}
        {isLive && hasMultipleCameras && (
          <button
            type="button"
            onClick={toggleFacingMode}
            className="focus-ring absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-black/60 text-white hover:bg-black/85 transition-colors backdrop-blur-xs cursor-pointer shadow-md"
            title="Đổi camera trước / sau"
            aria-label="Đổi camera trước / sau"
          >
            <SwitchCamera size={18} />
          </button>
        )}

        {/* Nút đóng camera khi đang live */}
        {isLive && onCancel && (
          <button
            type="button"
            onClick={handleStopAndCancel}
            className="focus-ring absolute top-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-black/60 text-white hover:bg-black/85 transition-colors backdrop-blur-xs cursor-pointer shadow-md"
            title="Đóng camera"
            aria-label="Đóng camera"
          >
            <X size={18} />
          </button>
        )}

        {/* Màn hình đếm ngược */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs">
            <span className="font-display text-7xl font-black text-white drop-shadow-lg animate-success-pop">
              {countdown}
            </span>
          </div>
        )}

        {/* Trạng thái phân tích chất lượng ảnh */}
        {isAnalyzing && isReviewing && (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-xs shadow-md">
              <Loader2 size={13} className="animate-spin text-primary" />
              Đang phân tích chất lượng ảnh AI...
            </span>
          </div>
        )}
      </div>

      {/* Đánh giá độ sáng & độ nét sau khi chụp */}
      {isReviewing && brightness && brightnessLabel && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all max-w-sm mx-auto w-full ${
            brightness.isAcceptable
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {brightness.isAcceptable ? (
            <CheckCircle2 size={15} className="shrink-0" />
          ) : (
            <AlertTriangle size={15} className="shrink-0" />
          )}
          <span className="font-semibold">{brightnessLabel}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            Luma={Math.round(brightness.avgLuma)} · σ={brightness.stddev.toFixed(1)}
          </span>
        </div>
      )}

      {/* Thanh nút bấm hành động (Action Controls - Chỉ hiện khi đang Live hoặc đang Xem lại) */}
      {(isLive || isReviewing) && (
        <div className="flex items-center justify-center gap-2 max-w-sm mx-auto w-full pt-1">
          {isLive && (
            <>
              <button
                type="button"
                onClick={performCapture}
                className="focus-ring flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm transition-all cursor-pointer"
              >
                <Camera size={15} />
                Chụp ảnh ngay
              </button>

              <button
                type="button"
                onClick={startCountdown}
                className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Hẹn giờ 3 giây rồi tự động chụp"
              >
                <Timer size={15} />
                Hẹn giờ 3s
              </button>
            </>
          )}

          {isReviewing && (
            <button
              type="button"
              onClick={handleRetake}
              className="focus-ring flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw size={14} />
              Chụp lại bằng Camera
            </button>
          )}
        </div>
      )}
    </div>
  );
}

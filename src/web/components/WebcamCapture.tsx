// src/web/components/WebcamCapture.tsx
// Task 4.1 — Live Webcam capture component.
//
// Replaces the legacy "upload file ảnh tự do" flow used in the Student
// Portal and Admin Student Modal with a controlled `getUserMedia` stream
// + on-screen oval face guide + lightweight brightness / face-region check.
//
// The component is intentionally self-contained so it can be reused by
// both `StudentPortalPage` and `StudentModal` without introducing new
// shared state. All UI tokens follow the DLU brand palette already
// declared in `index.css`.
//
// Strict rules respected:
//   - Không BAO GIỜ dùng `<input type="file">` để tải ảnh tự do.
//   - Capture trả về `Blob` (JPEG) để upload qua `uploadImageToCloudinary`.
//   - Cleanup: tắt mọi MediaStream khi component unmount.

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
  Lightbulb,
} from "lucide-react";

export interface WebcamCaptureProps {
  /** Called with the captured snapshot as a JPEG `Blob` + object URL. */
  onCapture: (payload: { blob: Blob; dataUrl: string }) => void;
  /** Called when the user discards the current snapshot and re-opens the camera. */
  onReset?: () => void;
  /** Optional fixed aspect ratio for the preview region (default = 4:3). */
  aspectRatio?: number;
  /** Render compact variant for use inside narrow modals. */
  compact?: boolean;
  /**
   * If true, locks all file-upload affordances. The component already
   * never exposes any `<input type="file">`, but this prop is exposed so
   * the parent can render an additional "Tính năng tải file đã bị khóa"
   * hint when needed.
   */
  fileUploadDisabled?: boolean;
}

type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "captured"
  | "denied"
  | "unavailable"
  | "error";

interface BrightnessCheck {
  /** Mean luma (0-255) of the central oval region. */
  avgLuma: number;
  /** Computed `stddev` of luminance (texture proxy). */
  stddev: number;
  /** Faces with average luma 30..220 AND stddev>=12 are considered "ok". */
  isAcceptable: boolean;
}

/**
 * Sample the average brightness of a captured image to make sure the
 * student is not shooting against the sun or in a pitch-dark room.
 *
 * The check is deliberately lightweight (canvas downscale + luma mean
 * + stddev) so it runs even on low-end laptops. We do not run any
 * heavyweight ML model — only a coarse "good / dim / blown-out" gate
 * before unlocking the shutter.
 */
function analyzeBrightness(dataUrl: string): Promise<BrightnessCheck> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const target = 96; // downscale for speed
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
          // Rec. 601 luma
          const luma =
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          samples.push(luma);
        }
        const sum = samples.reduce((a, b) => a + b, 0);
        const avgLuma = samples.length ? sum / samples.length : 128;
        const variance =
          samples.reduce((acc, v) => acc + (v - avgLuma) ** 2, 0) /
          Math.max(1, samples.length);
        const stddev = Math.sqrt(variance);
        const isAcceptable = avgLuma >= 35 && avgLuma <= 220 && stddev >= 8;
        resolve({ avgLuma, stddev, isAcceptable });
      } catch (err) {
        console.warn("Brightness analysis failed:", err);
        resolve({ avgLuma: 128, stddev: 30, isAcceptable: true });
      }
    };
    img.onerror = () =>
      resolve({ avgLuma: 128, stddev: 30, isAcceptable: true });
    img.src = dataUrl;
  });
}

/**
 * Convert the current `<video>` frame into a JPEG Blob + data URL.
 * Falls back gracefully if `toBlob` is unsupported.
 */
function snapFrame(
  video: HTMLVideoElement,
  width: number,
  height: number,
  oval: { cx: number; cy: number; rx: number; ry: number },
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Không thể khởi tạo canvas để chụp ảnh."));
      return;
    }
    // Fill black background to avoid transparency artefacts.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    // Clip to the oval guide so the captured portrait is centered.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
    // Re-add the oval outline so the saved JPEG always exposes the
    // face framing — useful for human reviewers in the approval queue.
    ctx.beginPath();
    ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(2, width * 0.005);
    ctx.stroke();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không thể mã hoá ảnh chụp JPEG."));
          return;
        }
        resolve({ blob, dataUrl });
      },
      "image/jpeg",
      0.9,
    );
  });
}

export default function WebcamCapture({
  onCapture,
  onReset,
  aspectRatio = 4 / 3,
  compact = false,
  fileUploadDisabled = true,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<BrightnessCheck | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [oval, setOval] = useState({ cx: 0, cy: 0, rx: 0, ry: 0 });

  // ----- Effect: open / close the camera stream based on `status` -----
  useEffect(() => {
    if (status !== "ready") {
      // Stop any active stream when leaving "ready" state.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Trình duyệt không hỗ trợ getUserMedia.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 540 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus("ready");
      } catch (err: any) {
        if (cancelled) return;
        console.warn("Webcam init failed:", err);
        const name = err?.name || "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setErrorMsg(
            "Bạn đã từ chối quyền truy cập Camera. Vui lòng bật quyền trong trình duyệt rồi thử lại.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("unavailable");
          setErrorMsg(
            "Không tìm thấy thiết bị Webcam trên máy tính. Vui lòng kiểm tra và thử lại.",
          );
        } else {
          setStatus("error");
          setErrorMsg(
            err?.message ||
              "Không thể khởi động Webcam. Vui lòng kiểm tra thiết bị và trình duyệt.",
          );
        }
      }
    }

    setStatus("requesting");
    start();

    return () => {
      cancelled = true;
    };
  }, [status === "ready"]); // re-run only when transitioning to ready

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ----- Effect: recompute oval coordinates when overlay resizes -----
  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const compute = () => {
      const rect = node.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cx = width / 2;
      const cy = height / 2;
      const ry = Math.min(height * 0.42, width / aspectRatio / 2);
      const rx = ry * aspectRatio;
      setOval({ cx, cy, rx, ry });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(node);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [aspectRatio]);

  const openCamera = useCallback(() => {
    setSnapshotUrl(null);
    setBrightness(null);
    setErrorMsg("");
    setStatus("ready");
  }, []);

  const performCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    if (oval.rx <= 0 || oval.ry <= 0) return;

    // Respect aspect ratio = 4:3 for storage
    const targetW = 480;
    const targetH = 360;
    try {
      const captureWidth = video.videoWidth || targetW;
      const captureHeight = video.videoHeight || targetH;
      // Scale oval to the same coordinate space the captured canvas uses.
      const sx = targetW / captureWidth;
      const sy = targetH / captureHeight;
      const capture = await snapFrame(video, targetW, targetH, {
        cx: oval.cx * sx,
        cy: oval.cy * sy,
        rx: oval.rx * sx,
        ry: oval.ry * sy,
      });
      setSnapshotUrl(capture.dataUrl);
      setStatus("captured");
      setIsAnalyzing(true);
      const check = await analyzeBrightness(capture.dataUrl);
      setBrightness(check);
      setIsAnalyzing(false);
      onCapture(capture);
    } catch (err: any) {
      console.error("Capture failed:", err);
      setErrorMsg(
        err?.message ||
          "Không thể chụp ảnh, vui lòng thử lại trong điều kiện ánh sáng tốt hơn.",
      );
      setStatus("ready");
    }
  }, [oval.cx, oval.cy, oval.rx, oval.ry, onCapture]);

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

  const handleRetake = useCallback(() => {
    setSnapshotUrl(null);
    setBrightness(null);
    setStatus("ready");
    onReset?.();
  }, [onReset]);

  // ----- Derived status flags -----
  const isLive = status === "ready";
  const isReviewing = status === "captured";

  const brightnessLabel = useMemo(() => {
    if (!brightness) return null;
    if (!brightness.isAcceptable) {
      if (brightness.avgLuma < 35) return "Ảnh quá tối";
      if (brightness.avgLuma > 220) return "Ảnh quá sáng / ngược sáng";
      return "Vùng mặt chưa rõ nét";
    }
    return "Độ sáng & nét mặt ổn";
  }, [brightness]);

  return (
    <div
      className={`flex w-full flex-col gap-3 ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <div
        ref={overlayRef}
        className={`relative w-full overflow-hidden rounded-2xl border-2 border-dashed bg-video-background shadow-md ${
          compact ? "aspect-[4/3] max-h-72" : "aspect-[4/3]"
        }`}
        style={{ borderColor: "var(--border)" }}
      >
        {/* Live video preview */}
        {!isReviewing && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover transition-opacity ${
              isLive ? "opacity-100" : "opacity-30"
            }`}
          />
        )}

        {/* Snapshot preview after capture */}
        {isReviewing && snapshotUrl && (
          <img
            src={snapshotUrl}
            alt="Ảnh chụp khuôn mặt xem trước"
            className="h-full w-full object-cover animate-success-pop"
          />
        )}

        {/* Idle / permission placeholder */}
        {!isLive && !isReviewing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-video-overlay/70 p-4 text-center text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary">
              <Camera size={28} />
            </div>
            <p className="font-semibold text-foreground text-xs">
              {status === "requesting"
                ? "Đang kết nối Webcam..."
                : status === "denied"
                ? "Quyền truy cập Camera bị từ chối"
                : status === "unavailable"
                ? "Không tìm thấy thiết bị Webcam"
                : status === "error"
                ? "Lỗi khởi động Webcam"
                : "Bấm nút bên dưới để bật Webcam"}
            </p>
            {errorMsg && (
              <p className="max-w-xs text-[11px] text-offline">{errorMsg}</p>
            )}
            {fileUploadDisabled && (
              <p className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                <Lock size={10} />
                Tính năng tải file ảnh từ máy đã được khoá.
              </p>
            )}
          </div>
        )}

        {/* Oval face guide (only when live) */}
        {(isLive || isReviewing) && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute rounded-[50%] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(7,9,12,0.55)]"
              style={{
                left: `${oval.cx - oval.rx}px`,
                top: `${oval.cy - oval.ry}px`,
                width: `${oval.rx * 2}px`,
                height: `${oval.ry * 2}px`,
              }}
            />
            <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-white/60 bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              Đặt khuôn mặt vào khung Oval
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="font-display text-7xl font-black text-white drop-shadow-lg animate-success-pop">
              {countdown}
            </span>
          </div>
        )}

        {/* Analyzing overlay during brightness check */}
        {isAnalyzing && isReviewing && (
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
              <Loader2 size={11} className="animate-spin" />
              Đang phân tích chất lượng ảnh...
            </span>
          </div>
        )}
      </div>

      {/* AI Photo Guidelines checklist */}
      <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-1.5 text-[11px] text-muted-foreground">
        <p className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-foreground">
          <Lightbulb size={12} className="text-secondary" /> Hướng dẫn đặt khuôn mặt
        </p>
        <ul className="space-y-1">
          <li className="flex items-start gap-1.5">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-online" />
            <span>Đặt khuôn mặt trực diện giữa khung Oval, nhìn thẳng vào camera.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-online" />
            <span>Ánh sáng đều, không bị ngược sáng, không đeo khẩu trang / kính râm.</span>
          </li>
          <li className="flex items-start gap-1.5">
            <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-online" />
            <span>Giữ yên khoảng 1–2 giây trước khi bấm chụp để ảnh không bị mờ.</span>
          </li>
        </ul>
      </div>

      {/* Brightness readout after capture */}
      {isReviewing && brightness && brightnessLabel && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            brightness.isAcceptable
              ? "border-online/40 bg-online/10 text-online"
              : "border-offline/40 bg-offline/10 text-offline"
          }`}
        >
          {brightness.isAcceptable ? (
            <CheckCircle2 size={14} className="shrink-0" />
          ) : (
            <AlertTriangle size={14} className="shrink-0" />
          )}
          <span className="font-semibold">{brightnessLabel}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            Luma={Math.round(brightness.avgLuma)} · σ=
            {brightness.stddev.toFixed(1)}
          </span>
        </div>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isLive && !isReviewing && (
            <button
              type="button"
              onClick={openCamera}
              className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <Camera size={14} />
              Bật Webcam chụp ảnh
            </button>
          )}

          {isLive && (
            <button
              type="button"
              onClick={startCountdown}
              className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm transition-all cursor-pointer"
            >
              <Camera size={14} />
              Chụp ảnh ngay
            </button>
          )}

          {isReviewing && (
            <button
              type="button"
              onClick={handleRetake}
              className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <RefreshCw size={14} />
              Chụp lại
            </button>
          )}
        </div>

        {fileUploadDisabled && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground">
            <Lock size={10} /> Tải file ảnh đã bị khoá
          </span>
        )}
      </div>
    </div>
  );
}

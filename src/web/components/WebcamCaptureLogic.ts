// src/web/components/WebcamCaptureLogic.ts
// Pure helper functions and domain logic for Webcam capture,
// designed for robust mobile/desktop camera handling, fallback constraints,
// face-oval framing calculation, and brightness analysis.

export interface OvalDimensions {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface BrightnessCheck {
  avgLuma: number;
  stddev: number;
  isAcceptable: boolean;
}

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "captured"
  | "denied"
  | "unavailable"
  | "insecure"
  | "error";

export interface CameraErrorInfo {
  status: CameraStatus;
  message: string;
}

/**
 * Computes oval guide dimensions centered in a container.
 */
export function computeOvalDimensions(
  width: number,
  height: number,
  aspectRatio: number = 4 / 3,
): OvalDimensions {
  if (width <= 0 || height <= 0) {
    return { cx: 0, cy: 0, rx: 0, ry: 0 };
  }
  const cx = width / 2;
  const cy = height / 2;
  const ry = Math.min(height * 0.42, width / aspectRatio / 2);
  const rx = ry * aspectRatio;
  return { cx, cy, rx, ry };
}

/**
 * Maps the container oval coordinates into the canvas resolution coordinate space.
 */
export function computeCanvasOval(
  containerOval: OvalDimensions,
  containerWidth: number,
  containerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): OvalDimensions {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return {
      cx: canvasWidth / 2,
      cy: canvasHeight / 2,
      rx: canvasWidth * 0.35,
      ry: canvasHeight * 0.4,
    };
  }
  const nx = containerOval.cx / containerWidth;
  const ny = containerOval.cy / containerHeight;
  const nrx = containerOval.rx / containerWidth;
  const nry = containerOval.ry / containerHeight;

  return {
    cx: nx * canvasWidth,
    cy: ny * canvasHeight,
    rx: nrx * canvasWidth,
    ry: nry * canvasHeight,
  };
}

/**
 * Classifies getUserMedia and browser errors into user-friendly status and Vietnamese guidance.
 */
export function classifyCameraError(
  err: any,
  isSecureContext: boolean = true,
): CameraErrorInfo {
  if (!isSecureContext || err?.name === "InsecureContextError") {
    return {
      status: "insecure",
      message:
        "Camera yêu cầu kết nối bảo mật (HTTPS hoặc localhost). Trên điện thoại, vui lòng truy cập qua HTTPS.",
    };
  }

  const name = err?.name || "";
  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    name === "PermissionDeniedError"
  ) {
    return {
      status: "denied",
      message:
        "Bạn đã từ chối quyền truy cập Camera. Vui lòng bật quyền camera trong cài đặt trình duyệt rồi thử lại.",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      status: "unavailable",
      message:
        "Không tìm thấy thiết bị Webcam trên thiết bị. Vui lòng kiểm tra và thử lại.",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      status: "error",
      message:
        "Camera đang được ứng dụng khác sử dụng hoặc bị khóa. Vui lòng đóng các ứng dụng dùng camera và thử lại.",
    };
  }

  return {
    status: "error",
    message:
      err?.message ||
      "Không thể khởi động Camera. Vui lòng kiểm tra thiết bị và cài đặt trình duyệt.",
  };
}

/**
 * Requests media stream with progressive 3-tier fallback for optimal mobile and desktop compatibility:
 * Tier 1: Ideal 1280x720 + facingMode
 * Tier 2: facingMode only (resolves OverconstrainedError on portrait mobile devices)
 * Tier 3: video: true (most permissive fallback)
 */
export async function requestMediaStreamWithFallback(
  facingMode: "user" | "environment" = "user",
  mediaDevices?: any,
  isSecureContext: boolean = true,
): Promise<MediaStream> {
  const md =
    mediaDevices ||
    (typeof navigator !== "undefined" ? navigator.mediaDevices : null);

  if (!isSecureContext) {
    const err = new Error(
      "Camera yêu cầu kết nối bảo mật (HTTPS hoặc localhost).",
    );
    err.name = "InsecureContextError";
    throw err;
  }

  if (!md?.getUserMedia) {
    const err = new Error("Trình duyệt không hỗ trợ MediaDevices getUserMedia.");
    err.name = "NotFoundError";
    throw err;
  }

  // Tier 1: High quality + facingMode
  const tier1Constraints = {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  try {
    return await md.getUserMedia(tier1Constraints);
  } catch (err1: any) {
    // If user explicitly denied, do not retry
    if (
      err1?.name === "NotAllowedError" ||
      err1?.name === "SecurityError" ||
      err1?.name === "PermissionDeniedError"
    ) {
      throw err1;
    }

    // Tier 2: facingMode only
    const tier2Constraints = {
      video: {
        facingMode: { ideal: facingMode },
      },
      audio: false,
    };

    try {
      return await md.getUserMedia(tier2Constraints);
    } catch (err2: any) {
      if (
        err2?.name === "NotAllowedError" ||
        err2?.name === "SecurityError" ||
        err2?.name === "PermissionDeniedError"
      ) {
        throw err2;
      }

      // Tier 3: Pure video fallback
      const tier3Constraints = {
        video: true,
        audio: false,
      };
      return await md.getUserMedia(tier3Constraints);
    }
  }
}

/**
 * Cleanly stops all tracks on a MediaStream to turn off the physical camera light and save battery.
 */
export function stopMediaStreamTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    const tracks = stream.getTracks();
    for (const track of tracks) {
      track.stop();
    }
  } catch (err) {
    console.warn("Lỗi khi dừng media stream tracks:", err);
  }
}

/**
 * Calculates luminance mean and standard deviation from sampled grayscale values.
 */
export function analyzeLumaValues(samples: number[]): BrightnessCheck {
  if (!samples || samples.length === 0) {
    return { avgLuma: 128, stddev: 30, isAcceptable: true };
  }
  const sum = samples.reduce((a, b) => a + b, 0);
  const avgLuma = sum / samples.length;
  const variance =
    samples.reduce((acc, v) => acc + (v - avgLuma) ** 2, 0) /
    Math.max(1, samples.length);
  const stddev = Math.sqrt(variance);
  const isAcceptable = avgLuma >= 35 && avgLuma <= 220 && stddev >= 8;
  return { avgLuma, stddev, isAcceptable };
}

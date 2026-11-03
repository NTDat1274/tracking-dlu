// src/web/components/CameraHeartbeatMonitor.tsx
// Realtime Camera Heartbeat Monitor Card.
// Displays all cameras from the Supabase `cameras` table with:
//   - LED indicator (blinking green for Online, solid red for Offline)
//   - Camera ID / Label / FPS
//   - "Last seen" countdown derived from `last_active_at`
//   - Auto-flips to Offline if no heartbeat arrives within ~90s
//
// Data is provided by the parent (OverviewPage) via props; the component
// itself only renders UI and a per-second tick to refresh the "age"
// counter without re-fetching from Supabase.

import { useEffect, useMemo, useState } from "react";
import { Camera, Wifi, WifiOff, Activity } from "lucide-react";
import type { CameraHeartbeatRecord } from "../../lib/supabase";
import { CAMERA_HEARTBEAT_TIMEOUT_MS } from "../../lib/supabase";

interface CameraHeartbeatMonitorProps {
  cameras: CameraHeartbeatRecord[];
  loading?: boolean;
}

/**
 * Format a positive number of seconds as `Xs / Xm Xs / Xh Xm`
 * for compact human-readable "last seen" labels.
 */
function formatAge(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s trước`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) {
    return remSec > 0 ? `${minutes}m ${remSec}s trước` : `${minutes}m trước`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m trước` : `${hours}h trước`;
}

export default function CameraHeartbeatMonitor({
  cameras,
  loading = false,
}: CameraHeartbeatMonitorProps) {
  // Local tick to recompute "age" every second without re-fetching.
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recompute online state locally so the UI reflects the latest tick.
  const now = Date.now();
  const enriched = useMemo(() => {
    return cameras.map((cam) => {
      let ageSeconds = cam.ageSeconds;
      if (cam.lastActiveMs !== null) {
        ageSeconds = Math.max(0, Math.floor((now - cam.lastActiveMs) / 1000));
      }
      const expired =
        cam.lastActiveMs === null ||
        now - cam.lastActiveMs > CAMERA_HEARTBEAT_TIMEOUT_MS;
      const isOnline = cam.rawStatus === "Offline" ? false : !expired;
      return { ...cam, ageSeconds, isOnline };
    });
  }, [cameras, now]);

  const onlineCount = enriched.filter((c) => c.isOnline).length;
  const offlineCount = enriched.length - onlineCount;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`relative flex h-3 w-3 ${
              onlineCount > 0 ? "" : "opacity-60"
            }`}
          >
            {onlineCount > 0 && (
              <>
                <span className="animate-heartbeat-glow absolute inline-flex h-full w-full rounded-full bg-primary/50"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary shadow-xs"></span>
              </>
            )}
            {onlineCount === 0 && (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-offline"></span>
            )}
          </span>
          <div>
            <h2 className="font-display text-sm font-bold text-foreground">
              Giám sát Camera Realtime (Heartbeat)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Tự động chuyển Offline nếu mất tín hiệu &gt; 90 giây
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-primary border border-primary/40 transition-all duration-200 hover:scale-[1.02]">
            <Wifi size={12} /> {onlineCount} Online
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-offline/15 px-2.5 py-0.5 text-offline border border-offline/40 transition-all duration-200 hover:scale-[1.02]">
            <WifiOff size={12} /> {offlineCount} Offline
          </span>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
          Đang tải danh sách camera…
        </div>
      ) : enriched.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
          Chưa có camera nào đăng ký trong hệ thống.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {enriched.map((cam, idx) => (
            <li
              key={cam.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-200 ease-out hover:scale-[1.01] hover:shadow-xs animate-item-enter ${
                cam.isOnline
                  ? "border-primary/30 bg-primary/5 hover:border-primary/50"
                  : "border-offline/30 bg-offline/5 hover:border-offline/50"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* LED indicator: smooth glowing green when online, solid red when offline */}
                <span
                  aria-label={cam.isOnline ? "Online" : "Offline"}
                  title={cam.isOnline ? "Online" : "Offline"}
                  className="relative flex h-3 w-3 shrink-0 items-center justify-center"
                >
                  {cam.isOnline ? (
                    <>
                      <span className="animate-heartbeat-glow absolute inline-flex h-full w-full rounded-full bg-primary/50"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-offline"></span>
                  )}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Camera
                      size={13}
                      className={`shrink-0 ${
                        cam.isOnline ? "text-primary" : "text-offline"
                      }`}
                    />
                    <p className="text-xs font-semibold text-foreground truncate">
                      {cam.id}
                    </p>
                    <span className="text-[10px] text-muted-foreground truncate">
                      · {cam.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Activity size={10} />
                    <span>
                      {cam.isOnline
                        ? `Heartbeat ${formatAge(cam.ageSeconds)}`
                        : cam.lastActiveMs === null
                          ? "Chưa có tín hiệu"
                          : `Mất tín hiệu ${formatAge(cam.ageSeconds)}`}
                    </span>
                    <span className="mx-1">·</span>
                    <span>{cam.fps} FPS</span>
                  </div>
                </div>
              </div>

              <span
                className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  cam.isOnline
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-offline/15 text-offline border-offline/40"
                }`}
              >
                {cam.isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                {cam.isOnline ? "Online" : "Offline"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

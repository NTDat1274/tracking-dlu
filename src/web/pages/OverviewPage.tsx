// src/web/pages/OverviewPage.tsx
// Realtime Monitoring Dashboard with Live Occupants, Ticking Stopwatch, and Supabase Subscription.
import { useState, useEffect, useMemo } from "react";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import BarChart from "../charts/BarChart";

import { KpiSkeleton, TableSkeleton } from "../components/LoadingSkeleton";
import { StudentAvatar } from "../components/AvatarFallback";
import { fetchVisitRecords, subscribeToStudentRecords, fetchDistinctCameras } from "../../lib/supabase";
import { getCloudConfig } from "../../lib/config";
import { fmtDuration, fmtTime, type VisitRecord, type CameraOption } from "../../data/types";

interface OverviewPageProps {
  onViewWaitingList: () => void;
  onSelectRecord?: (record: VisitRecord) => void;
}

export default function OverviewPage({ onViewWaitingList, onSelectRecord }: OverviewPageProps) {
  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // 1. Fetch initial records
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      const data = await fetchVisitRecords();
      const cams = await fetchDistinctCameras();
      if (mounted) {
        setRecords(data);
        setCameras(cams);
        setLoading(false);
      }
    }

    loadData();

    // 2. Supabase Realtime Subscription
    const sub = subscribeToStudentRecords(() => {
      // Re-fetch records on changes (INSERT/UPDATE/DELETE)
      fetchVisitRecords().then((updated) => {
        if (mounted) setRecords(updated);
      });
      fetchDistinctCameras().then((cams) => {
        if (mounted) setCameras(cams);
      });
    });

    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, []);

  // 3. Ticking clock every 1 second for live occupants stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Poll live camera status every 5 seconds
  useEffect(() => {
    let mounted = true;
    const timer = setInterval(() => {
      fetchDistinctCameras().then((cams) => {
        if (mounted) setCameras(cams);
      });
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const weeklyData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    records.forEach(r => {
      if (!r.enteredAt) return;
      const date = new Date(r.enteredAt);
      if (!isNaN(date.getTime())) {
        counts[date.getDay()] += 1;
      }
    });
    return [
      { label: "T2", value: counts[1] },
      { label: "T3", value: counts[2] },
      { label: "T4", value: counts[3] },
      { label: "T5", value: counts[4] },
      { label: "T6", value: counts[5] },
      { label: "T7", value: counts[6] },
      { label: "CN", value: counts[0] },
    ];
  }, [records]);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  // Filter occupants currently in room (status is Waiting or no exitedAt)
  const currentOccupants = records.filter(
    (r) => !r.exitedAt || r.status === "Waiting"
  );

  const servedRecords = records.filter((r) => r.status === "Served");
  const waitingRecords = records.filter((r) => r.status === "Waiting");
  const unattendedRecords = records.filter((r) => r.status === "Unattended");

  const totalVisits = records.length;
  const avgDuration =
    totalVisits > 0
      ? Math.round(records.reduce((sum, r) => sum + (r.durationSeconds || 0), 0) / totalVisits)
      : 0;
  const serviceRate = totalVisits > 0 ? Math.round((servedRecords.length / totalVisits) * 100) : 0;

  const recentActivities = [...records]
    .sort((a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime())
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      {/* 4 KPI Cards with DLU Brand Accents */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tổng lượt đến hôm nay"
          value={String(totalVisits)}
          sub="Hệ thống camera ghi nhận"
          accent="#9ABE26"
        />
        <KpiCard
          label="Đang có mặt trong phòng"
          value={String(currentOccupants.length)}
          sub="Realtime Occupants"
          accent="#FFC600"
        />
        <KpiCard
          label="Thời gian ở trung bình"
          value={fmtDuration(avgDuration)}
          sub="Tính theo từng phiên ra/vào"
        />
        <KpiCard
          label="Tỷ lệ tiếp nhận & phục vụ"
          value={`${serviceRate}%`}
          sub={`${servedRecords.length}/${totalVisits} lượt đã tiếp nhận`}
          accent="#9ABE26"
        />
      </div>

      {/* Realtime Occupants Table (Đang có mặt trong phòng kèm live stopwatch) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                Sinh viên đang có mặt trong phòng ({currentOccupants.length})
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Đồng hồ đếm thời gian thực tế tăng dần theo giây (Live Ticking)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewWaitingList}
            className="focus-ring text-xs font-semibold text-primary hover:underline"
          >
            Xem danh sách chờ →
          </button>
        </div>

        {currentOccupants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
            Hiện không có sinh viên nào trong phòng phục vụ.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-semibold">
                  <th className="pb-2.5">Sinh viên</th>
                  <th className="pb-2.5">Camera ghi nhận</th>
                  <th className="pb-2.5">Giờ vào</th>
                  <th className="pb-2.5">Thời gian ở thực tế</th>
                  <th className="pb-2.5">Trạng thái</th>
                  <th className="pb-2.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {currentOccupants.slice(0, 5).map((occ) => {
                  const entryTime = new Date(occ.enteredAt).getTime();
                  const liveSeconds = Math.max(0, Math.floor((currentTime - entryTime) / 1000));

                  return (
                    <tr
                      key={occ.id}
                      onClick={() => onSelectRecord?.(occ)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar src={occ.avatarUrl} name={occ.studentName} size="sm" />
                          <div>
                            <p className="font-semibold text-foreground">{occ.studentName}</p>
                            <p className="text-[10px] text-muted-foreground">{occ.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-muted-foreground font-medium">{occ.cameraId}</td>
                      <td className="py-2.5 text-foreground">{fmtTime(occ.enteredAt)}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary/15 px-2 py-0.5 font-mono text-xs font-bold text-secondary">
                          <span>⏱</span>
                          {fmtDuration(liveSeconds)}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={occ.status} />
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRecord?.(occ);
                          }}
                          className="focus-ring text-xs font-semibold text-primary hover:underline"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activities & Charts Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activities */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-display text-sm font-bold text-foreground">Hoạt động vào/ra gần nhất</h2>
          <ul className="space-y-3">
            {recentActivities.map((r) => (
              <li
                key={r.id}
                onClick={() => onSelectRecord?.(r)}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-2.5 hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <StudentAvatar src={r.avatarUrl} name={r.studentName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate" title={r.studentName}>{r.studentName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.studentId} · {fmtTime(r.enteredAt)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Weekly Trend BarChart */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-display text-sm font-bold text-foreground">Xu hướng tuần (DLU Green)</h2>
          <BarChart
            data={weeklyData}
            title="Lượt theo tuần"
          />
        </div>

        {/* System Diagnostics */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-display text-sm font-bold text-foreground">Trạng thái kết nối</h2>
          <ul className="space-y-2.5 text-xs">
            {cameras.map((cam) => (
              <li key={cam.id} className="flex items-center justify-between py-1">
                <span className="text-foreground">{cam.id} - {cam.label}</span>
                <StatusBadge status={cam.status || "Connected"} />
              </li>
            ))}
            {cameras.length === 0 && (
              <li className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Cameras</span>
                <StatusBadge status="Offline" />
              </li>
            )}
            <li className="flex items-center justify-between py-1">
              <span className="text-foreground">Supabase PostgreSQL</span>
              <StatusBadge status={getCloudConfig().supabaseUrl ? "Connected" : "Offline"} />
            </li>
            <li className="flex items-center justify-between py-1">
              <span className="text-foreground">Cloudinary Storage</span>
              <StatusBadge status={getCloudConfig().cloudinaryCloudName ? "Connected" : "Offline"} />
            </li>
          </ul>
        </div>
      </div>

      {/* Status Breakdown Bar */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 font-display text-sm font-bold text-foreground">Phân loại 3 trạng thái chuẩn</h2>
        <div className="flex flex-wrap gap-4 text-xs">
          {[
            { label: "Served (Đã tiếp nhận)", count: servedRecords.length, color: "#9ABE26" },
            { label: "Waiting (Đang chờ)", count: waitingRecords.length, color: "#FFC600" },
            { label: "Unattended (Chưa tiếp nhận)", count: unattendedRecords.length, color: "#E2231A" },
          ].map((s) => {
            const pct = totalVisits > 0 ? Math.round((s.count / totalVisits) * 100) : 0;
            return (
              <div key={s.label} className="flex-1 min-w-[150px]">
                <div className="flex justify-between font-medium text-muted-foreground">
                  <span className="text-foreground font-semibold">{s.label}</span>
                  <span>{s.count} ({pct}%)</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

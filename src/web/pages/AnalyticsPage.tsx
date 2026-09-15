import { useState, useEffect, useMemo } from "react";
import AnalyticsFilterBar, { type AnalyticsFilterState } from "../components/filters/AnalyticsFilterBar";
import BarChart from "../charts/BarChart";
import DonutChart from "../charts/DonutChart";
import HeatmapGrid from "../charts/HeatmapGrid";
import { EmptyState } from "../components/StateViews";
import { isWithinDateRange, type Insight, type VisitRecord, type CameraOption } from "../../data/types";
import { fetchDistinctClasses, fetchDistinctCameras, fetchVisitRecords, subscribeToStudentRecords } from "../../lib/supabase";

interface AnalyticsPageProps {
  filters: AnalyticsFilterState;
  onFiltersChange: (filters: AnalyticsFilterState) => void;
  onReset: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  Served: "#9ABE26",
  Waiting: "#FFA12D",
  Unattended: "#E2231A",
};

export default function AnalyticsPage({ filters, onFiltersChange, onReset }: AnalyticsPageProps) {
  const [classes, setClasses] = useState<string[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [records, setRecords] = useState<VisitRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [data, classList, camList] = await Promise.all([fetchVisitRecords(), fetchDistinctClasses(), fetchDistinctCameras()]);
      if (mounted) {
        setRecords(data);
        setClasses(classList);
        setCameras(camList);
      }
    }
    load();

    const sub = subscribeToStudentRecords(() => {
      Promise.all([fetchVisitRecords(), fetchDistinctClasses(), fetchDistinctCameras()]).then(([updated, updatedClasses, updatedCameras]) => {
        if (mounted) {
          setRecords(updated);
          setClasses(updatedClasses);
          setCameras(updatedCameras);
        }
      });
    });

    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, []);

  const targetClass = filters.className;
  const filtered = records.filter((r) => {
    if (!isWithinDateRange(r.enteredAt, filters.dateFrom, filters.dateTo)) return false;
    if (filters.cameraId && r.cameraId !== filters.cameraId) return false;
    if (targetClass && r.className !== targetClass) return false;
    if (filters.status !== "All" && r.status !== filters.status) return false;
    return true;
  });

  const insights: Insight[] = buildInsights(filtered);

  // Computed data for charts
  const hourlyData = useMemo(() => {
    const counts = Array(11).fill(0); // 07h to 17h
    filtered.forEach(r => {
      if (!r.enteredAt) return;
      const hour = new Date(r.enteredAt).getHours();
      if (hour >= 7 && hour <= 17) {
        counts[hour - 7] += 1;
      }
    });
    return counts.map((count, i) => ({ label: `${String(i + 7).padStart(2, '0')}h`, value: count }));
  }, [filtered]);

  const statusData = useMemo(() => {
    const served = filtered.filter(r => r.status === "Served").length;
    const waiting = filtered.filter(r => r.status === "Waiting").length;
    const unattended = filtered.filter(r => r.status === "Unattended").length;
    return [
      { label: "Served", value: served, color: STATUS_COLOR["Served"] },
      { label: "Waiting", value: waiting, color: STATUS_COLOR["Waiting"] },
      { label: "Unattended", value: unattended, color: STATUS_COLOR["Unattended"] },
    ];
  }, [filtered]);
  
  const heatmapData = useMemo(() => {
    // 7 days x 11 hours
    const grid = Array.from({ length: 7 }, () => Array(11).fill(0));
    filtered.forEach(r => {
      if (!r.enteredAt) return;
      const date = new Date(r.enteredAt);
      if (isNaN(date.getTime())) return;
      const day = date.getDay(); // 0 is Sunday, 1 is Monday ...
      const hour = date.getHours();
      
      // Map day to row index: T2(1)->0, T3(2)->1, ..., T7(6)->5, CN(0)->6
      const rowIndex = day === 0 ? 6 : day - 1;
      
      if (hour >= 7 && hour <= 17) {
        const colIndex = hour - 7;
        grid[rowIndex][colIndex] += 1;
      }
    });
    return grid;
  }, [filtered]);

  const daysLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const hoursLabels = ["07h", "08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h"];

  return (
    <div className="flex flex-col gap-5">
      <AnalyticsFilterBar
        filters={filters}
        cameras={cameras}
        classes={classes}
        resultCount={filtered.length}
        onChange={onFiltersChange}
        onReset={onReset}
      />

      {filtered.length === 0 ? (
        <EmptyState
          message="Không có dữ liệu trong khoảng thời gian này."
          action={{ label: "Reset bộ lọc", onClick: onReset }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {insights.map((insight) => (
              <div key={insight.title} className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {insight.title}
                </p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">{insight.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{insight.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Lượt theo giờ</h2>
              <BarChart
                data={hourlyData}
                title="Lượt theo giờ"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Phân loại trạng thái (DLU Brand)</h2>
              <DonutChart
                title="Phân loại trạng thái"
                data={statusData}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Xu hướng 7 ngày gần nhất</h2>
              <BarChart
                data={hourlyData}
                title="Xu hướng 7 ngày"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Bản đồ giờ cao điểm (Heatmap)</h2>
              <HeatmapGrid
                title="Bản đồ giờ cao điểm theo Thứ/Giờ"
                data={heatmapData}
                rowLabels={daysLabels}
                colLabels={hoursLabels}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildInsights(records: VisitRecord[]): Insight[] {
  if (records.length === 0) return [];

  const hourCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const r of records) {
    if (!r.enteredAt) continue;
    const date = new Date(r.enteredAt);
    if (isNaN(date.getTime())) continue;
    
    const hourKey = `${String(date.getHours()).padStart(2, '0')}h`;
    hourCounts.set(hourKey, (hourCounts.get(hourKey) ?? 0) + 1);

    const dayKey = date.toLocaleDateString("vi-VN", { weekday: "short" });
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
  }

  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const unattendedCount = records.filter((r) => r.status === "Unattended").length;
  const unattendedRate = Math.round((unattendedCount / records.length) * 100);

  return [
    {
      title: "Giờ cao điểm",
      value: peakHour ? peakHour[0] : "—",
      description: `Dựa trên ${records.length} lượt trong khoảng đã chọn`,
    },
    {
      title: "Ngày đông nhất",
      value: busiestDay ? busiestDay[0] : "—",
      description: `${busiestDay ? busiestDay[1] : 0} lượt trong ngày này`,
    },
    {
      title: "Tỷ lệ chưa tiếp nhận",
      value: `${unattendedRate}%`,
      description: `${unattendedCount}/${records.length} lượt Unattended`,
    },
  ];
}

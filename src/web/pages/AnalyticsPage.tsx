import { useState, useEffect } from "react";
import AnalyticsFilterBar, { type AnalyticsFilterState } from "../components/filters/AnalyticsFilterBar";
import BarChart from "../charts/BarChart";
import DonutChart from "../charts/DonutChart";
import HeatmapGrid from "../charts/HeatmapGrid";
import { EmptyState } from "../components/StateViews";
import { CAMERAS, VISIT_RECORDS } from "../../data/mockData";
import { ANALYTICS_HOURLY, ANALYTICS_STATUS, PEAK_HOURS_GRID, PEAK_HOURS_LABELS } from "../../data/analyticsData";
import { isWithinDateRange, type Insight } from "../../data/types";
import { fetchDistinctClasses } from "../../lib/supabase";

interface AnalyticsPageProps {
  filters: AnalyticsFilterState;
  onFiltersChange: (filters: AnalyticsFilterState) => void;
  onReset: () => void;
}

// Standardized DLU Brand status colors
const STATUS_COLOR: Record<string, string> = {
  Served: "#9ABE26",     // DLU Green
  Waiting: "#FFA12D",    // DLU Orange
  Unattended: "#E2231A", // DLU Red
};

export default function AnalyticsPage({ filters, onFiltersChange, onReset }: AnalyticsPageProps) {
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchDistinctClasses().then(setClasses);
  }, []);

  const targetClass = filters.className;
  const filtered = VISIT_RECORDS.filter((r) => {
    if (!isWithinDateRange(r.enteredAt, filters.dateFrom, filters.dateTo)) return false;
    if (filters.cameraId && r.cameraId !== filters.cameraId) return false;
    if (targetClass && r.className !== targetClass) return false;
    if (filters.status !== "All" && r.status !== filters.status) return false;
    return true;
  });

  const insights: Insight[] = buildInsights(filtered);

  return (
    <div className="flex flex-col gap-5">
      <AnalyticsFilterBar
        filters={filters}
        cameras={CAMERAS}
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
                data={ANALYTICS_HOURLY.map((d) => ({ label: d.hour, value: d.visits }))}
                title="Lượt theo giờ"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Phân loại trạng thái (DLU Brand)</h2>
              <DonutChart
                title="Phân loại trạng thái"
                data={ANALYTICS_STATUS.map((s) => ({
                  label: s.status,
                  value: s.count,
                  color: STATUS_COLOR[s.status] || "#9ABE26",
                }))}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Xu hướng 7 ngày gần nhất</h2>
              <BarChart
                data={ANALYTICS_HOURLY.map((d) => ({ label: d.hour, value: d.visits }))}
                title="Xu hướng 7 ngày"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-3 font-display text-sm font-bold text-foreground">Bản đồ giờ cao điểm (Heatmap)</h2>
              <HeatmapGrid
                title="Bản đồ giờ cao điểm theo Thứ/Giờ"
                data={PEAK_HOURS_GRID}
                rowLabels={PEAK_HOURS_LABELS.days}
                colLabels={PEAK_HOURS_LABELS.hours}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function buildInsights(records: typeof VISIT_RECORDS): Insight[] {
  if (records.length === 0) return [];

  const hourCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  for (const r of records) {
    const date = new Date(r.enteredAt);
    const hourKey = `${date.getHours()}h`;
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

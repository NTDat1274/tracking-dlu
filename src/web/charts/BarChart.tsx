// src/web/charts/BarChart.tsx
import { useState } from "react";

interface BarChartProps {
  data: { label: string; value: number }[];
  title: string;
  unit?: string;
}

export default function BarChart({ data, title, unit = "lượt" }: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg
        role="img"
        aria-labelledby={`${title}-title`}
        aria-describedby={`${title}-desc`}
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-40 w-full"
      >
        <title id={`${title}-title`}>{title}</title>
        <desc id={`${title}-desc`}>
          {data.map((d) => `${d.label}: ${d.value} ${unit}`).join(", ")}
        </desc>

        {data.map((d, i) => {
          const h = (d.value / max) * 34;
          const x = i * barWidth;
          const y = 36 - h;
          const isHover = hoverIndex === i;

          return (
            <g key={d.label}>
              <rect
                x={x + barWidth * 0.15}
                y={y}
                width={barWidth * 0.7}
                height={Math.max(h, 0.5)}
                rx={0.6}
                fill={isHover ? "#B5D645" : "#9ABE26"}
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${d.value} ${unit}`}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                className="focus:outline-none"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {hoverIndex != null
          ? `${data[hoverIndex].label}: ${data[hoverIndex].value} ${unit}`
          : `Giờ cao điểm: ${peak.label} · ${peak.value} ${unit}`}
      </p>

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        className="focus-ring mt-2 text-xs font-medium text-primary hover:underline"
      >
        {showTable ? "Ẩn bảng dữ liệu" : "Xem dạng bảng"}
      </button>

      {showTable && (
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-left text-muted-foreground">
              <th className="py-1">Nhãn</th>
              <th className="py-1">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-border-subtle last:border-0">
                <td className="py-1">{d.label}</td>
                <td className="py-1">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

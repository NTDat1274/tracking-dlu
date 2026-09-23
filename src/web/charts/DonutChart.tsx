// src/web/charts/DonutChart.tsx
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export default function DonutChart({ data, title }: { data: DonutSlice[]; title: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;

  const slicesWithRotation = data.reduce<Array<DonutSlice & { rotation: number }>>((acc, slice) => {
    const prevRotation = acc.length > 0 ? acc[acc.length - 1].rotation + (acc[acc.length - 1].value / total) * 360 : -90;
    return [...acc, { ...slice, rotation: prevRotation }];
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
      <svg
        role="img"
        aria-labelledby={`${title}-title`}
        aria-describedby={`${title}-desc`}
        viewBox="0 0 40 40"
        className="h-32 w-32 shrink-0"
      >
        <title id={`${title}-title`}>{title}</title>
        <desc id={`${title}-desc`}>
          {data.map((d) => `${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`).join(", ")}
        </desc>

        <circle cx="20" cy="20" r={radius} fill="none" stroke="#262E3D" strokeWidth="6" />

        {slicesWithRotation.map((slice) => {
          const fraction = slice.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;

          return (
            <circle
              key={slice.label}
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="6"
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${slice.rotation} 20 20)`}
              tabIndex={0}
              role="img"
              aria-label={`${slice.label}: ${slice.value} (${Math.round(fraction * 100)}%)`}
              className="focus:outline-none"
            />
          );
        })}
      </svg>

      <ul className="space-y-1.5 text-sm w-full sm:w-auto">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 whitespace-nowrap">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-foreground">{slice.label}</span>
            <span className="text-muted-foreground">
              {slice.value} · {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

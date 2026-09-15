// src/web/charts/HeatmapGrid.tsx
interface HeatmapGridProps {
  data: number[][];
  rowLabels: string[];
  colLabels: string[];
  title: string;
}

export default function HeatmapGrid({ data, rowLabels, colLabels, title }: HeatmapGridProps) {
  const max = Math.max(...data.flat(), 1);

  function colorFor(value: number) {
    const intensity = value / max;
    if (intensity === 0) return "#1A2230";
    if (intensity < 0.34) return "#344B18";
    if (intensity < 0.67) return "#678A1F";
    return "#9ABE26";
  }

  return (
    <div role="img" aria-label={title} className="overflow-x-auto">
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="p-1" />
            {colLabels.map((c) => (
              <th key={c} className="p-1 text-center font-normal text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, r) => (
            <tr key={rowLabels[r]}>
              <th scope="row" className="p-1 text-right font-normal text-muted-foreground">
                {rowLabels[r]}
              </th>
              {row.map((value, c) => (
                <td key={c} className="p-0.5">
                  <div
                    title={`${rowLabels[r]} ${colLabels[c]}: ${value} lượt`}
                    className="h-5 w-6 rounded-sm transition-opacity hover:opacity-80"
                    style={{ backgroundColor: colorFor(value) }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

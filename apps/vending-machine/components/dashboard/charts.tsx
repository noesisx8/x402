"use client";

/** Simple SVG sparkline for hourly activity data. */
export function Sparkline({ data, color = "#10b981" }: { data: number[]; color?: string }) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const width = 240;
  const height = 48;
  const padding = 2;
  const step = (width - padding * 2) / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = padding + i * step;
      const y = height - padding - (v / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${padding},${height} ${points} ${width - padding},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: 48 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#spark-gradient)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Horizontal bar chart for service breakdown. */
export function BarChart({
  items,
  max,
}: {
  items: { label: string; value: number; color?: string }[];
  max: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs text-zinc-400">{item.label}</span>
            <div className="relative h-5 flex-1 rounded bg-zinc-900">
              <div
                className="absolute inset-y-0 left-0 rounded bg-emerald-500/60 transition-all"
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-y-0 right-2 flex items-center text-xs text-zinc-300">
                {item.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

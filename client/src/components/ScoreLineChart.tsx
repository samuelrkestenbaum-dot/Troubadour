import { useMemo, useState } from "react";

interface VersionScore {
  versionNumber: number;
  filename: string;
  scores: Record<string, number>;
}

interface ScoreLineChartProps {
  data: VersionScore[];
  height?: number;
}

const DIMENSION_COLORS: Record<string, string> = {
  overall: "#a78bfa",      // violet
  songwriting: "#60a5fa",  // blue
  melody: "#34d399",       // emerald
  structure: "#fbbf24",    // amber
  lyrics: "#f472b6",       // pink
  performance: "#fb923c",  // orange
  production: "#38bdf8",   // sky
  originality: "#a3e635",  // lime
  commercial: "#e879f9",   // fuchsia
};

const DIMENSION_LABELS: Record<string, string> = {
  overall: "Overall",
  songwriting: "Songwriting",
  melody: "Melody & Hooks",
  structure: "Structure",
  lyrics: "Lyrics",
  performance: "Performance",
  production: "Production",
  originality: "Originality",
  commercial: "Commercial",
};

export function ScoreLineChart({ data, height = 280 }: ScoreLineChartProps) {
  const [hoveredDim, setHoveredDim] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ dim: string; idx: number } | null>(null);

  const dimensions = useMemo(() => {
    const dims = new Set<string>();
    data.forEach(v => Object.keys(v.scores).forEach(k => dims.add(k)));
    // Put "overall" first
    const arr = Array.from(dims);
    const overallIdx = arr.indexOf("overall");
    if (overallIdx > 0) {
      arr.splice(overallIdx, 1);
      arr.unshift("overall");
    }
    return arr;
  }, [data]);

  if (data.length < 2) return null;

  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const xScale = (idx: number) => padding.left + (idx / (data.length - 1)) * innerWidth;
  const yScale = (val: number) => padding.top + innerHeight - (val / 10) * innerHeight;

  // Grid lines
  const gridLines = [0, 2, 4, 6, 8, 10];

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ maxHeight: `${height}px` }}
      >
        {/* Grid */}
        {gridLines.map(val => (
          <g key={val}>
            <line
              x1={padding.left}
              y1={yScale(val)}
              x2={chartWidth - padding.right}
              y2={yScale(val)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray={val === 0 || val === 10 ? "none" : "4 4"}
            />
            <text
              x={padding.left - 8}
              y={yScale(val)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="currentColor"
              fillOpacity={0.4}
              fontSize={11}
            >
              {val}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((v, i) => (
          <text
            key={i}
            x={xScale(i)}
            y={chartHeight - 8}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity={0.5}
            fontSize={11}
          >
            v{v.versionNumber}
          </text>
        ))}

        {/* Lines */}
        {dimensions.map(dim => {
          const points = data
            .map((v, i) => ({ x: xScale(i), y: yScale(v.scores[dim] ?? 0), val: v.scores[dim] }))
            .filter(p => p.val !== undefined);

          if (points.length < 2) return null;

          const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const isHighlighted = hoveredDim === null || hoveredDim === dim;
          const color = DIMENSION_COLORS[dim] || "#94a3b8";

          return (
            <g key={dim}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={dim === "overall" ? 3 : 2}
                strokeOpacity={isHighlighted ? 1 : 0.15}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: "stroke-opacity 0.2s" }}
              />
              {/* Data points */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.dim === dim && hoveredPoint?.idx === i ? 6 : 4}
                    fill={color}
                    fillOpacity={isHighlighted ? 1 : 0.2}
                    stroke="var(--background)"
                    strokeWidth={2}
                    style={{ transition: "all 0.2s", cursor: "pointer" }}
                    onMouseEnter={() => setHoveredPoint({ dim, idx: i })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Tooltip */}
                  {hoveredPoint?.dim === dim && hoveredPoint?.idx === i && (
                    <g>
                      <rect
                        x={p.x - 24}
                        y={p.y - 28}
                        width={48}
                        height={20}
                        rx={4}
                        fill="var(--popover)"
                        stroke={color}
                        strokeWidth={1}
                      />
                      <text
                        x={p.x}
                        y={p.y - 15}
                        textAnchor="middle"
                        fill="var(--popover-foreground)"
                        fontSize={12}
                        fontWeight={600}
                      >
                        {p.val}/10
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
        {dimensions.map(dim => {
          const color = DIMENSION_COLORS[dim] || "#94a3b8";
          const label = DIMENSION_LABELS[dim] || dim.replace(/_/g, " ").replace(/^./, s => s.toUpperCase());
          const isActive = hoveredDim === null || hoveredDim === dim;

          // Calculate delta for this dimension
          const firstVal = data[0]?.scores[dim];
          const lastVal = data[data.length - 1]?.scores[dim];
          const delta = firstVal !== undefined && lastVal !== undefined ? lastVal - firstVal : null;

          return (
            <button
              key={dim}
              className="flex items-center gap-1.5 text-xs transition-opacity cursor-pointer"
              style={{ opacity: isActive ? 1 : 0.3 }}
              onMouseEnter={() => setHoveredDim(dim)}
              onMouseLeave={() => setHoveredDim(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{label}</span>
              {delta !== null && (
                <span className={`font-semibold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                  {delta > 0 ? `+${delta}` : delta === 0 ? "—" : delta}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

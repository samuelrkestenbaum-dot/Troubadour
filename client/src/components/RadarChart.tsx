import { useMemo } from "react";

interface RadarChartProps {
  scores: Record<string, number>;
  maxScore?: number;
  size?: number;
  labels?: Record<string, string>;
}

const DEFAULT_LABELS: Record<string, string> = {
  production: "Production",
  songwriting: "Songwriting",
  melody: "Melody",
  performance: "Performance",
  mixQuality: "Mix",
  arrangement: "Arrangement",
  originality: "Originality",
  commercialPotential: "Commercial",
  commercial: "Commercial",
  lyricalContent: "Lyrics",
  emotionalImpact: "Emotion",
  overall: "Overall",
  structure: "Structure",
  lyrics: "Lyrics",
};

export function RadarChart({
  scores,
  maxScore = 10,
  size = 280,
  labels = DEFAULT_LABELS,
}: RadarChartProps) {
  const entries = useMemo(() => {
    return Object.entries(scores).filter(
      ([key]) => key !== "overall"
    );
  }, [scores]);

  const n = entries.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const labelRadius = radius + 24;

  // Calculate points for each axis
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / maxScore) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return {
      x: cx + labelRadius * Math.cos(angle),
      y: cy + labelRadius * Math.sin(angle),
      angle,
    };
  };

  // Generate polygon path for data
  const dataPath = entries
    .map(([, value], i) => {
      const p = getPoint(i, typeof value === "number" ? value : 0);
      return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    })
    .join(" ") + " Z";

  // Generate grid rings
  const rings = [2, 4, 6, 8, 10];

  // Score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 8) return { fill: "rgba(74, 222, 128, 0.15)", stroke: "rgba(74, 222, 128, 0.8)" };
    if (score >= 6) return { fill: "rgba(96, 165, 250, 0.15)", stroke: "rgba(96, 165, 250, 0.8)" };
    if (score >= 4) return { fill: "rgba(250, 204, 21, 0.12)", stroke: "rgba(250, 204, 21, 0.7)" };
    return { fill: "rgba(248, 113, 113, 0.12)", stroke: "rgba(248, 113, 113, 0.7)" };
  };

  // Average score for color
  const avgScore = entries.reduce((sum, [, v]) => sum + (typeof v === "number" ? v : 0), 0) / n;
  const colors = getScoreColor(avgScore);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Grid rings */}
        {rings.map((ringValue) => {
          const ringPath = Array.from({ length: n })
            .map((_, i) => {
              const p = getPoint(i, ringValue);
              return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
            })
            .join(" ") + " Z";
          return (
            <path
              key={ringValue}
              d={ringPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={ringValue === 10 ? 0.8 : 0.4}
              className="text-border"
              opacity={ringValue === 10 ? 0.6 : 0.3}
            />
          );
        })}

        {/* Axis lines */}
        {entries.map((_, i) => {
          const p = getPoint(i, maxScore);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="currentColor"
              strokeWidth={0.4}
              className="text-border"
              opacity={0.3}
            />
          );
        })}

        {/* Data polygon */}
        <path
          d={dataPath}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {entries.map(([, value], i) => {
          const numValue = typeof value === "number" ? value : 0;
          const p = getPoint(i, numValue);
          const pointColor = getScoreColor(numValue);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={pointColor.stroke}
              stroke="currentColor"
              strokeWidth={1}
              className="text-background"
            />
          );
        })}

        {/* Labels */}
        {entries.map(([key, value], i) => {
          const lp = getLabelPoint(i);
          const numValue = typeof value === "number" ? value : 0;
          const label = labels[key] || key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
          
          // Determine text anchor based on position
          let textAnchor: "start" | "middle" | "end" = "middle";
          if (lp.angle > -Math.PI / 4 && lp.angle < Math.PI / 4) textAnchor = "start";
          else if (lp.angle > (3 * Math.PI) / 4 || lp.angle < -(3 * Math.PI) / 4) textAnchor = "end";
          // Adjust for left side
          if (Math.abs(lp.angle) > Math.PI * 0.6) textAnchor = "end";
          if (Math.abs(lp.angle) < Math.PI * 0.4 && lp.angle > -Math.PI / 2) textAnchor = "start";

          return (
            <g key={i}>
              <text
                x={lp.x}
                y={lp.y - 6}
                textAnchor={textAnchor}
                className="fill-muted-foreground"
                fontSize={10}
                fontWeight={500}
              >
                {label}
              </text>
              <text
                x={lp.x}
                y={lp.y + 8}
                textAnchor={textAnchor}
                className={
                  numValue >= 8
                    ? "fill-green-400"
                    : numValue >= 6
                    ? "fill-blue-400"
                    : numValue >= 4
                    ? "fill-yellow-400"
                    : "fill-red-400"
                }
                fontSize={12}
                fontWeight={700}
              >
                {numValue}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

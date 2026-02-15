import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { scoreColor } from "@/lib/scoreColor";

interface TrendPoint {
  week: string;
  avgScore: number;
  reviewCount: number;
  minScore: number;
  maxScore: number;
}

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Score Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Not enough data yet. Keep reviewing tracks to see your score trends over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxScore = 10;
  const minY = 0;
  const chartWidth = 100;
  const chartHeight = 50;
  const padding = { top: 5, right: 5, bottom: 8, left: 8 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * plotWidth;
  const yScale = (v: number) => padding.top + plotHeight - ((v - minY) / (maxScore - minY)) * plotHeight;

  // Build SVG path for the line
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.avgScore)}`)
    .join(" ");

  // Build area path (fill under the line)
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;

  // Range band (min to max)
  const rangePath = data.length > 1
    ? `M ${data.map((d, i) => `${xScale(i)} ${yScale(d.maxScore)}`).join(" L ")} L ${[...data].reverse().map((d, i) => `${xScale(data.length - 1 - i)} ${yScale(d.minScore)}`).join(" L ")} Z`
    : "";

  const latestScore = data[data.length - 1]?.avgScore ?? 0;
  const firstScore = data[0]?.avgScore ?? 0;
  const delta = latestScore - firstScore;

  const formatWeek = (w: string) => {
    const d = new Date(w);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Score Trends
          </CardTitle>
          {data.length >= 2 && (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${scoreColor(latestScore)}`}>
                {latestScore.toFixed(1)}
              </span>
              <span className={`text-xs font-medium ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Weekly average scores over the last {data.length} weeks</p>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-40" preserveAspectRatio="none">
          {/* Grid lines */}
          {[2, 4, 6, 8, 10].map(v => (
            <g key={v}>
              <line
                x1={padding.left} y1={yScale(v)}
                x2={chartWidth - padding.right} y2={yScale(v)}
                stroke="currentColor" className="text-border/30" strokeWidth="0.15"
              />
              <text x={padding.left - 1} y={yScale(v) + 1} className="text-muted-foreground/50" fontSize="2.5" textAnchor="end">
                {v}
              </text>
            </g>
          ))}

          {/* Range band */}
          {rangePath && (
            <path d={rangePath} fill="currentColor" className="text-primary/5" />
          )}

          {/* Area fill */}
          <path d={areaPath} fill="url(#trendGradient)" opacity="0.3" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="currentColor" className="text-primary" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {data.map((d, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(d.avgScore)} r="0.8" fill="currentColor" className="text-primary" />
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 px-2">
          {data.length <= 6
            ? data.map((d, i) => (
                <span key={i} className="text-[10px] text-muted-foreground/60">{formatWeek(d.week)}</span>
              ))
            : [0, Math.floor(data.length / 2), data.length - 1].map(i => (
                <span key={i} className="text-[10px] text-muted-foreground/60">{formatWeek(data[i].week)}</span>
              ))
          }
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
          <div className="text-xs text-muted-foreground">
            {data.reduce((sum, d) => sum + d.reviewCount, 0)} reviews across {data.length} weeks
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Min: <span className={scoreColor(Math.min(...data.map(d => d.minScore)))}>{Math.min(...data.map(d => d.minScore))}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Max: <span className={scoreColor(Math.max(...data.map(d => d.maxScore)))}>{Math.max(...data.map(d => d.maxScore))}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

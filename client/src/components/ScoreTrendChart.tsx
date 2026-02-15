import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon, Eye, EyeOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { scoreColor } from "@/lib/scoreColor";

/* ── Shared color/label maps ── */
const DIMENSION_COLORS: Record<string, string> = {
  overall: "#ef4444",
  production: "#f97316",
  songwriting: "#eab308",
  melody: "#22c55e",
  performance: "#06b6d4",
  mixQuality: "#3b82f6",
  arrangement: "#8b5cf6",
  originality: "#ec4899",
  commercialPotential: "#f59e0b",
  lyricalContent: "#14b8a6",
  emotionalImpact: "#a855f7",
};

const DIMENSION_LABELS: Record<string, string> = {
  overall: "Overall",
  production: "Production",
  songwriting: "Songwriting",
  melody: "Melody",
  performance: "Performance",
  mixQuality: "Mix Quality",
  arrangement: "Arrangement",
  originality: "Originality",
  commercialPotential: "Commercial",
  lyricalContent: "Lyrics",
  emotionalImpact: "Emotional Impact",
};

/* ═══════════════════════════════════════════════════════════
   1) VERSION TREND — shows score changes across review versions
   ═══════════════════════════════════════════════════════════ */
interface VersionTrendProps {
  trackId: number;
}

export function VersionScoreTrend({ trackId }: VersionTrendProps) {
  const { data: reviews, isLoading } = trpc.review.listByTrack.useQuery({ trackId });
  const [visibleDimensions, setVisibleDimensions] = useState<Set<string>>(new Set(["overall"]));

  const chartData = useMemo(() => {
    if (!reviews) return [];
    return reviews
      .filter(r => r.reviewType === "track" && r.scoresJson)
      .sort((a, b) => (a.reviewVersion ?? 1) - (b.reviewVersion ?? 1))
      .map(r => ({
        version: r.reviewVersion ?? 1,
        createdAt: r.createdAt,
        scores: (r.scoresJson as Record<string, number> | null) ?? {},
      }));
  }, [reviews]);

  const allDimensions = useMemo(() => {
    const dims = new Set<string>();
    chartData.forEach(d => Object.keys(d.scores).forEach(k => dims.add(k)));
    const sorted = Array.from(dims).filter(k => k !== "overall").sort();
    if (dims.has("overall")) sorted.unshift("overall");
    return sorted;
  }, [chartData]);

  const toggleDimension = (dim: string) => {
    setVisibleDimensions(prev => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (chartData.length <= 1) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-8 text-center">
          <LineChartIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Score trends will appear after multiple review versions.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use "Re-review" to generate a new version.
          </p>
        </CardContent>
      </Card>
    );
  }

  const firstOverall = chartData[0]?.scores?.overall;
  const lastOverall = chartData[chartData.length - 1]?.scores?.overall;
  const overallDelta = firstOverall !== undefined && lastOverall !== undefined
    ? lastOverall - firstOverall : null;

  const chartWidth = 600;
  const chartHeight = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const xScale = (i: number) => padding.left + (i / (chartData.length - 1)) * plotWidth;
  const yScale = (v: number) => padding.top + plotHeight - ((v / 10) * plotHeight);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            <LineChartIcon className="h-4 w-4" />
            Score Trend
          </CardTitle>
          {overallDelta !== null && (
            <Badge
              className={`gap-1 text-xs ${
                overallDelta > 0 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : overallDelta < 0 ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                : "text-muted-foreground"
              }`}
              variant="outline"
            >
              {overallDelta > 0 ? <TrendingUp className="h-3 w-3" /> : overallDelta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {overallDelta > 0 ? "+" : ""}{overallDelta.toFixed(1)} overall
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto min-w-[400px]">
            {[0, 2, 4, 6, 8, 10].map(v => (
              <g key={v}>
                <line x1={padding.left} y1={yScale(v)} x2={chartWidth - padding.right} y2={yScale(v)}
                  stroke="currentColor" strokeOpacity={0.08} strokeDasharray={v === 0 || v === 10 ? "0" : "4 4"} />
                <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{v}</text>
              </g>
            ))}
            {chartData.map((d, i) => (
              <text key={i} x={xScale(i)} y={chartHeight - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>v{d.version}</text>
            ))}
            {allDimensions.filter(dim => visibleDimensions.has(dim)).map(dim => {
              const color = DIMENSION_COLORS[dim] || "#888";
              const points = chartData
                .map((d, i) => ({ x: xScale(i), y: yScale(d.scores[dim] ?? 0), val: d.scores[dim] }))
                .filter(p => p.val !== undefined);
              if (points.length < 2) return null;
              const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              return (
                <g key={dim}>
                  <path d={pathD} fill="none" stroke={color} strokeWidth={dim === "overall" ? 2.5 : 1.5}
                    strokeLinecap="round" strokeLinejoin="round" opacity={dim === "overall" ? 1 : 0.7} />
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={dim === "overall" ? 4 : 3} fill={color} opacity={dim === "overall" ? 1 : 0.8} />
                      <text x={p.x} y={p.y - 8} textAnchor="middle" fill={color} fontSize={9} fontWeight="bold">{p.val}</text>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dimension toggles */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {allDimensions.map(dim => {
            const isVisible = visibleDimensions.has(dim);
            const color = DIMENSION_COLORS[dim] || "#888";
            const label = DIMENSION_LABELS[dim] || dim;
            return (
              <Button key={dim} variant="ghost" size="sm"
                className={`h-6 px-2 text-xs gap-1.5 transition-all ${isVisible ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
                onClick={() => toggleDimension(dim)}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                {label}
                {isVisible ? <Eye className="h-2.5 w-2.5 text-muted-foreground" /> : <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />}
              </Button>
            );
          })}
        </div>

        {/* Version timeline */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground overflow-x-auto">
          {chartData.map((d, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className="text-[10px] h-4 px-1">v{d.version}</Badge>
              <span>{formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   2) WEEKLY TREND — original dashboard-level weekly chart
   ═══════════════════════════════════════════════════════════ */
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

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.avgScore)}`).join(" ");
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;
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
          {[2, 4, 6, 8, 10].map(v => (
            <g key={v}>
              <line x1={padding.left} y1={yScale(v)} x2={chartWidth - padding.right} y2={yScale(v)}
                stroke="currentColor" className="text-border/30" strokeWidth="0.15" />
              <text x={padding.left - 1} y={yScale(v) + 1} className="text-muted-foreground/50" fontSize="2.5" textAnchor="end">{v}</text>
            </g>
          ))}
          {rangePath && <path d={rangePath} fill="currentColor" className="text-primary/5" />}
          <path d={areaPath} fill="url(#trendGradient)" opacity="0.3" />
          <path d={linePath} fill="none" stroke="currentColor" className="text-primary" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(d.avgScore)} r="0.8" fill="currentColor" className="text-primary" />
          ))}
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
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

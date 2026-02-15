import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  BarChart3, Music, FileText, FolderOpen, TrendingUp, Star, Trophy, Clock, Lock, ArrowUpRight, ArrowUp, ArrowDown, Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { scoreColor } from "@/lib/scoreColor";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";

const scoreBg = (score: number) => {
  if (score >= 8) return "bg-emerald-400/10";
  if (score >= 6) return "bg-sky-400/10";
  if (score >= 4) return "bg-amber-400/10";
  return "bg-rose-400/10";
};

const scoreBarColor = (score: number) => {
  if (score >= 8) return "bg-emerald-400";
  if (score >= 6) return "bg-sky-400";
  if (score >= 4) return "bg-amber-400";
  return "bg-rose-400";
};

const scoreLabels: Record<string, string> = {
  production: "Production",
  songwriting: "Songwriting",
  melody: "Melody & Hooks",
  performance: "Performance",
  mixQuality: "Mix Quality",
  arrangement: "Arrangement",
  originality: "Originality",
  commercialPotential: "Commercial",
  lyricalContent: "Lyrical Content",
  emotionalImpact: "Emotional Impact",
  overall: "Overall",
  structure: "Structure",
  commercial: "Commercial",
  lyrics: "Lyrics",
};

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-border/40 hover:border-primary/30 transition-all">
      <CardContent className="py-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreDistributionChart({ data }: { data: { score: number; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-1.5">
      {data.map(({ score, count }) => (
        <div key={score} className="flex items-center gap-2">
          <span className={`text-xs font-mono w-4 text-right ${scoreColor(score)}`}>{score}</span>
          <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${scoreBarColor(score)}`}
              style={{ width: `${(count / maxCount) * 100}%`, minWidth: count > 0 ? "4px" : "0" }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

function AverageScoresChart({ averages }: { averages: Record<string, number> }) {
  const entries = Object.entries(averages)
    .filter(([key]) => key !== "overall")
    .sort((a, b) => b[1] - a[1]);

  const overall = averages.overall;

  return (
    <div className="space-y-3">
      {overall !== undefined && (
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <span className="text-sm font-medium">Overall Average</span>
          <span className={`text-2xl font-bold ${scoreColor(overall)}`}>{overall}</span>
        </div>
      )}
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 truncate">{scoreLabels[key] || key}</span>
            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreBarColor(val)}`}
                style={{ width: `${(val / 10) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-8 text-right ${scoreColor(val)}`}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImprovementCard({ data }: { data: { improved: number; declined: number; unchanged: number; total: number; improvementRate: number } | null | undefined }) {
  if (!data || data.total === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Improvement Rate
        </CardTitle>
        <p className="text-xs text-muted-foreground">Tracks with multiple reviews</p>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <span className={`text-4xl font-bold ${data.improvementRate >= 50 ? "text-emerald-400" : data.improvementRate >= 25 ? "text-amber-400" : "text-rose-400"}`}>
            {data.improvementRate}%
          </span>
          <p className="text-xs text-muted-foreground mt-1">of re-reviewed tracks improved</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-emerald-400/10">
            <ArrowUp className="h-3.5 w-3.5 text-emerald-400 mx-auto mb-1" />
            <span className="text-lg font-bold text-emerald-400">{data.improved}</span>
            <p className="text-[10px] text-muted-foreground">Improved</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20">
            <Minus className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
            <span className="text-lg font-bold">{data.unchanged}</span>
            <p className="text-[10px] text-muted-foreground">Same</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-rose-400/10">
            <ArrowDown className="h-3.5 w-3.5 text-rose-400 mx-auto mb-1" />
            <span className="text-lg font-bold text-rose-400">{data.declined}</span>
            <p className="text-[10px] text-muted-foreground">Declined</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.analytics.dashboard.useQuery(undefined, {
    retry: false,
  });
  const { data: trends } = trpc.analytics.trends.useQuery(undefined, { retry: false });
  const { data: heatmap } = trpc.analytics.heatmap.useQuery(undefined, { retry: false });
  const { data: improvement } = trpc.analytics.improvement.useQuery(undefined, { retry: false });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // Feature gating: show upgrade prompt for free users
  if (error?.data?.code === "FORBIDDEN") {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Unlock Analytics</h2>
        <p className="text-muted-foreground mb-6">
          The Analytics dashboard is available on the Artist plan and above. Upgrade to see score distributions, average scores, top tracks, and review activity.
        </p>
        <Button onClick={() => setLocation("/pricing")} size="lg">
          View Plans <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>No analytics data yet</h2>
        <p className="text-muted-foreground mb-6 max-w-sm text-center">
          Analytics will appear here once you've completed your first review. Upload a track and run an AI critique to get started.
        </p>
        <Button onClick={() => setLocation("/dashboard")} variant="outline">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  const { stats, scoreDistribution, recentActivity, averageScores, topTracks } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your music critique insights at a glance
        </p>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={FolderOpen} label="Projects" value={stats.totalProjects} />
          <StatCard icon={Music} label="Tracks" value={stats.totalTracks} sub={`${stats.reviewedTracks} reviewed`} />
          <StatCard icon={FileText} label="Reviews" value={stats.totalReviews} />
          <StatCard
            icon={TrendingUp}
            label="Avg Overall"
            value={averageScores?.overall?.toFixed(1) ?? "—"}
            sub={averageScores ? `across ${stats.totalReviews} reviews` : undefined}
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Distribution */}
        {scoreDistribution && scoreDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistributionChart data={scoreDistribution} />
            </CardContent>
          </Card>
        )}

        {/* Average Scores */}
        {averageScores && Object.keys(averageScores).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Average Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AverageScoresChart averages={averageScores} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Score Trends + Activity Heatmap */}
      <div className="grid md:grid-cols-2 gap-6">
        {trends && trends.length > 0 && (
          <ScoreTrendChart data={trends} />
        )}
        {improvement && <ImprovementCard data={improvement} />}
      </div>

      {heatmap && heatmap.length > 0 && (
        <ActivityHeatmap data={heatmap} />
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Tracks */}
        {topTracks && topTracks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Top Rated Tracks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topTracks.map((track, idx) => (
                <div
                  key={track.trackId}
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-1.5 rounded transition-colors"
                  onClick={() => setLocation(`/tracks/${track.trackId}`)}
                >
                  <span className="text-sm font-mono text-muted-foreground w-5 text-center">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.filename}</p>
                    {track.genre && (
                      <p className="text-xs text-muted-foreground">{track.genre}</p>
                    )}
                  </div>
                  <div className={`text-lg font-bold ${scoreColor(track.overall)}`}>
                    {track.overall}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {recentActivity && recentActivity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.slice(0, 8).map((activity) => {
                const scores = activity.scoresJson as Record<string, number> | null;
                const overall = scores?.overall ?? scores?.Overall;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-1.5 rounded transition-colors"
                    onClick={() => setLocation(`/reviews/${activity.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {activity.trackFilename || "Unknown track"}
                        </p>
                        {activity.reviewVersion && activity.reviewVersion > 1 && (
                          <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20 shrink-0">
                            v{activity.reviewVersion}
                          </Badge>
                        )}
                      </div>
                      {activity.quickTake && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.quickTake}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {overall !== undefined && (
                        <span className={`text-sm font-bold ${scoreColor(overall)}`}>{overall}/10</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state */}
      {(!stats || stats.totalReviews === 0) && (
        <Card className="border-dashed border-primary/20">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              Analytics will populate once you have reviewed tracks.
            </p>
            <button
              onClick={() => setLocation("/projects/new")}
              className="text-sm text-primary hover:underline"
            >
              Create a project and upload your first track &rarr;
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

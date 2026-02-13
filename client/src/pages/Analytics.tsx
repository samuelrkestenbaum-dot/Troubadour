import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  BarChart3, Music, FileText, FolderOpen, TrendingUp, Star, Trophy, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const scoreColor = (score: number) => {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
};

const scoreBg = (score: number) => {
  if (score >= 8) return "bg-green-400/10";
  if (score >= 6) return "bg-blue-400/10";
  if (score >= 4) return "bg-yellow-400/10";
  return "bg-red-400/10";
};

const scoreBarColor = (score: number) => {
  if (score >= 8) return "bg-green-400";
  if (score >= 6) return "bg-blue-400";
  if (score >= 4) return "bg-yellow-400";
  return "bg-red-400";
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
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
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

export default function Analytics() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.analytics.dashboard.useQuery();

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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <BarChart3 className="h-8 w-8 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No analytics data available yet.</p>
      </div>
    );
  }

  const { stats, scoreDistribution, recentActivity, averageScores, topTracks } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
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

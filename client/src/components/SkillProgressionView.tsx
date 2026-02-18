/**
 * Feature 1: Longitudinal Improvement Tracking
 * Shows skill progression over time with trend graphs and AI insights.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Target, Award, AlertTriangle, Loader2, BarChart3, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface OverviewItem {
  dimension: string;
  focusMode: string;
  latestScore: number;
  firstScore: number;
  delta: number;
  avgScore: number;
  dataPoints: number;
}

interface TimelineEntry {
  dimension: string;
  focusMode: string;
  score: number;
  createdAt: Date;
  trackId: number;
}

interface TrendAnalysis {
  overallTrajectory: string;
  strongestGrowth: { dimension: string; delta: number; insight: string } | null;
  biggestChallenge: { dimension: string; avgScore: number; insight: string } | null;
  plateaus: Array<{ dimension: string; score: number; since: string }>;
  recommendations: Array<{ priority: number; dimension: string; action: string; expectedImpact: string }>;
  milestones: Array<{ dimension: string; achievement: string; date: string }>;
  nextGoals: Array<{ dimension: string; currentScore: number; targetScore: number; suggestion: string }>;
  summary: string;
}

export function SkillProgressionView() {
  const [focusFilter, setFocusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const overview = trpc.skillTracker.overview.useQuery();
  const timeline = trpc.skillTracker.trend.useQuery({
    focusMode: focusFilter === "all" ? undefined : focusFilter,
  });
  const insights = trpc.skillTracker.insights.useMutation({
    onError: (err: any) => toast.error("Analysis failed: " + (err?.message ?? "Unknown error")),
  });

  const trajectoryIcon = (trajectory: string) => {
    switch (trajectory) {
      case "improving": return <TrendingUp className="h-5 w-5 text-emerald-500" />;
      case "declining": return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Minus className="h-5 w-5 text-amber-500" />;
    }
  };

  const trajectoryColor = (trajectory: string) => {
    switch (trajectory) {
      case "improving": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "declining": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  // Group overview by focus mode
  const groupedOverview = useMemo(() => {
    if (!overview.data) return {} as Record<string, OverviewItem[]>;
    const groups: Record<string, OverviewItem[]> = {};
    for (const item of overview.data as OverviewItem[]) {
      const mode = item.focusMode;
      if (!groups[mode]) groups[mode] = [];
      groups[mode].push(item);
    }
    return groups;
  }, [overview.data]);

  // Simple sparkline renderer
  const renderSparkline = (data: Array<{ score: number }>) => {
    if (data.length < 2) return null;
    const scores = data.map(d => d.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;
    const width = 120;
    const height = 32;
    const points = scores.map((s: number, i: number) => {
      const x = (i / (scores.length - 1)) * width;
      const y = height - ((s - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(" ");
    const trend = scores[scores.length - 1] >= scores[0] ? "#10b981" : "#ef4444";
    return (
      <svg width={width} height={height} className="inline-block">
        <polyline points={points} fill="none" stroke={trend} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {scores.map((s: number, i: number) => {
          const x = (i / (scores.length - 1)) * width;
          const y = height - ((s - min) / range) * (height - 4) - 2;
          return <circle key={i} cx={x} cy={y} r="2" fill={trend} />;
        })}
      </svg>
    );
  };

  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading skill data...</span>
      </div>
    );
  }

  if (!overview.data || (overview.data as OverviewItem[]).length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Skill Data Yet</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Upload and review tracks to start tracking your skill progression. Each review generates dimension scores that are tracked over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const insightsData = insights.data as TrendAnalysis | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Skill Progression
          </h2>
          <p className="text-muted-foreground mt-1">Track your growth across every dimension over time</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={focusFilter} onValueChange={setFocusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Focus Modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Focus Modes</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="songwriting">Songwriting</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="mixing">Mixing</SelectItem>
              <SelectItem value="mastering">Mastering</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => insights.mutate()}
            disabled={insights.isPending}
            size="sm"
          >
            {insights.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            AI Insights
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          {insightsData && <TabsTrigger value="insights">AI Insights</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {Object.entries(groupedOverview).map(([mode, dimensions]) => (
            <Card key={mode}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base capitalize">{mode}</CardTitle>
                <CardDescription>{dimensions.length} dimensions tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dimensions.map((dim: OverviewItem) => (
                    <div key={dim.dimension} className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0">
                      <div className="w-40 font-medium text-sm capitalize">{dim.dimension.replace(/([A-Z])/g, " $1").trim()}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(dim.latestScore / 10) * 100}%`,
                                backgroundColor: dim.latestScore >= 8 ? "#10b981" : dim.latestScore >= 6 ? "#3b82f6" : dim.latestScore >= 4 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-sm font-mono w-10 text-right">{dim.latestScore}/10</span>
                        </div>
                      </div>
                      <div className="w-20 text-center">
                        {renderSparkline((timeline.data as TimelineEntry[] ?? []).filter((t: TimelineEntry) => t.dimension === dim.dimension))}
                      </div>
                      <div className="w-20 text-right">
                        <Badge variant="outline" className={dim.delta > 0 ? "text-emerald-500 border-emerald-500/30" : dim.delta < 0 ? "text-red-500 border-red-500/30" : "text-muted-foreground"}>
                          {dim.delta > 0 ? "+" : ""}{dim.delta.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="w-16 text-right text-xs text-muted-foreground">{dim.dataPoints} pts</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {timeline.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !timeline.data || (timeline.data as TimelineEntry[]).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No timeline data for this filter.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(timeline.data as TimelineEntry[]).map((entry: TimelineEntry, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <div className="w-24 text-xs text-muted-foreground font-mono">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                      <div className="w-32 text-sm capitalize font-medium">{entry.dimension.replace(/([A-Z])/g, " $1").trim()}</div>
                      <div className="flex-1">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(entry.score / 10) * 100}%`,
                              backgroundColor: entry.score >= 8 ? "#10b981" : entry.score >= 6 ? "#3b82f6" : entry.score >= 4 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-mono w-10 text-right">{entry.score}/10</span>
                      <Badge variant="outline" className="text-xs capitalize">{entry.focusMode}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        {insightsData && (
          <TabsContent value="insights" className="space-y-4">
            {/* Trajectory */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  {trajectoryIcon(insightsData.overallTrajectory)}
                  <div>
                    <h3 className="font-semibold capitalize">{insightsData.overallTrajectory}</h3>
                    <p className="text-sm text-muted-foreground">{insightsData.summary}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {insightsData.strongestGrowth && (
                    <div className={`p-4 rounded-lg border ${trajectoryColor("improving")}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium text-sm">Strongest Growth</span>
                      </div>
                      <p className="text-sm font-semibold capitalize">{insightsData.strongestGrowth.dimension.replace(/([A-Z])/g, " $1")}</p>
                      <p className="text-xs mt-1 opacity-80">{insightsData.strongestGrowth.insight}</p>
                    </div>
                  )}
                  {insightsData.biggestChallenge && (
                    <div className={`p-4 rounded-lg border ${trajectoryColor("declining")}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium text-sm">Biggest Challenge</span>
                      </div>
                      <p className="text-sm font-semibold capitalize">{insightsData.biggestChallenge.dimension.replace(/([A-Z])/g, " $1")}</p>
                      <p className="text-xs mt-1 opacity-80">{insightsData.biggestChallenge.insight}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {insightsData.recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insightsData.recommendations.map((rec: TrendAnalysis["recommendations"][0], i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <Badge variant="outline" className="mt-0.5 shrink-0">#{rec.priority}</Badge>
                        <div>
                          <p className="text-sm font-medium capitalize">{rec.dimension.replace(/([A-Z])/g, " $1")}</p>
                          <p className="text-sm text-muted-foreground">{rec.action}</p>
                          <p className="text-xs text-primary mt-1">{rec.expectedImpact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next Goals */}
            {insightsData.nextGoals.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    Next Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {insightsData.nextGoals.map((goal: TrendAnalysis["nextGoals"][0], i: number) => (
                      <div key={i} className="flex items-center gap-3 py-2">
                        <span className="text-sm font-medium capitalize w-32">{goal.dimension.replace(/([A-Z])/g, " $1")}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-sm font-mono">{goal.currentScore}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full relative">
                            <div className="absolute h-full bg-primary/30 rounded-full" style={{ width: `${(goal.targetScore / 10) * 100}%` }} />
                            <div className="absolute h-full bg-primary rounded-full" style={{ width: `${(goal.currentScore / 10) * 100}%` }} />
                          </div>
                          <span className="text-sm font-mono text-primary">{goal.targetScore}</span>
                        </div>
                        <span className="text-xs text-muted-foreground max-w-48 truncate">{goal.suggestion}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Milestones */}
            {insightsData.milestones.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Milestones Achieved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {insightsData.milestones.map((m: TrendAnalysis["milestones"][0], i: number) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <Award className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="font-medium capitalize">{m.dimension.replace(/([A-Z])/g, " $1")}</span>
                        <span className="text-muted-foreground">{m.achievement}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{m.date}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SkillProgressionView } from "@/components/SkillProgressionView";
import { ArtistDNAView } from "@/components/ArtistDNAView";
import { DataFlywheelView } from "@/components/DataFlywheelView";
import { StreakDashboard } from "@/components/StreakDashboard";
import { CompetitiveBenchmarkView } from "@/components/CompetitiveBenchmarkView";
import { ReleaseReadinessView } from "@/components/ReleaseReadinessView";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  GraduationCap, Dna, Database, Flame, Swords, Rocket, BarChart3,
  Music, FileText, FolderOpen, TrendingUp, Star, Trophy, Clock, Loader2,
  LineChart, Award, Fingerprint
} from "lucide-react";
import { scoreColor } from "@/lib/scoreColor";
import { useMemo } from "react";

const scoreLabels: Record<string, string> = {
  production: "Production",
  songwriting: "Songwriting",
  vocals: "Vocals",
  mixing: "Mixing",
  arrangement: "Arrangement",
  originality: "Originality",
  emotional_impact: "Emotional Impact",
  overall: "Overall",
};

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

type InsightTab = "overview" | "skills" | "competitive" | "momentum" | "dna";

export default function Insights() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<InsightTab>("overview");

  return (
    <div className="container py-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Insights
        </h1>
        <p className="text-muted-foreground mt-1">Your creative intelligence dashboard — all your growth data in one place.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InsightTab)} className="w-full">
        <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-muted/30 p-1.5">
          <TabsTrigger value="overview" className="flex-col items-start h-auto py-2 px-3 gap-0.5">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Overview</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Performance summary and activity trends</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex-col items-start h-auto py-2 px-3 gap-0.5">
            <div className="flex items-center gap-1.5">
              <LineChart className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Skill Growth</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Track development across artistic dimensions</span>
          </TabsTrigger>
          <TabsTrigger value="competitive" className="flex-col items-start h-auto py-2 px-3 gap-0.5">
            <div className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Competitive Position</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Project readiness and peer benchmarks</span>
          </TabsTrigger>
          <TabsTrigger value="momentum" className="flex-col items-start h-auto py-2 px-3 gap-0.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Momentum</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Consistency, streaks, and data impact</span>
          </TabsTrigger>
          <TabsTrigger value="dna" className="flex-col items-start h-auto py-2 px-3 gap-0.5">
            <div className="flex items-center gap-1.5">
              <Fingerprint className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Artist DNA</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-normal">Your unique sonic signature and identity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillProgressionView />
        </TabsContent>
        <TabsContent value="competitive" className="mt-4">
          <CompetitivePositionTab />
        </TabsContent>
        <TabsContent value="momentum" className="mt-4">
          <MomentumTab />
        </TabsContent>
        <TabsContent value="dna" className="mt-4">
          <ArtistDNAView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  const { data, isLoading } = trpc.analytics.dashboard.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No analytics data yet. Upload and review some tracks to see your stats.</p>
        </CardContent>
      </Card>
    );
  }

  const stats = data as any;
  const avgScores = stats.averageScores || {};
  const recentReviews = stats.recentReviews || [];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalProjects ?? 0}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Music className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTracks ?? 0}</p>
                <p className="text-xs text-muted-foreground">Tracks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <FileText className="h-4 w-4 text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReviews ?? 0}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Star className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgScores.overall?.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Breakdown */}
      {Object.keys(avgScores).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Average Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(avgScores)
              .filter(([key]) => key !== "overall")
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([key, val]) => {
                const score = val as number;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">
                      {scoreLabels[key] || key}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-8 text-right ${scoreColor(score)}`}>
                      {score.toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Score Trend */}
      <ScoreTrendSection />

      {/* Activity Heatmap */}
      <HeatmapSection />
    </div>
  );
}

function ScoreTrendSection() {
  const { data: trends } = trpc.analytics.trends.useQuery(undefined, { retry: false });
  if (!trends || trends.length === 0) return null;
  return <ScoreTrendChart data={trends} />;
}

function HeatmapSection() {
  const { data: heatmap } = trpc.analytics.heatmap.useQuery(undefined, { retry: false });
  if (!heatmap || heatmap.length === 0) return null;
  return <ActivityHeatmap data={heatmap} />;
}

/** Competitive Position Tab - Combines Release Ready + Benchmarks */
function CompetitivePositionTab() {
  const [view, setView] = useState<"readiness" | "benchmarks">("readiness");
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setView("readiness")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            view === "readiness"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Rocket className="h-4 w-4 inline mr-2" />
          Release Readiness
        </button>
        <button
          onClick={() => setView("benchmarks")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            view === "benchmarks"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Swords className="h-4 w-4 inline mr-2" />
          Benchmarks
        </button>
      </div>
      {view === "readiness" ? <ReleaseReadinessTab /> : <CompetitiveBenchmarkView />}
    </div>
  );
}

/** Momentum Tab - Combines Streak + Flywheel */
function MomentumTab() {
  const [view, setView] = useState<"streak" | "flywheel">("streak");
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setView("streak")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            view === "streak"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Flame className="h-4 w-4 inline mr-2" />
          Streak
        </button>
        <button
          onClick={() => setView("flywheel")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            view === "flywheel"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Database className="h-4 w-4 inline mr-2" />
          Data Flywheel
        </button>
      </div>
      {view === "streak" ? <StreakDashboard /> : <DataFlywheelView />}
    </div>
  );
}

function ReleaseReadinessTab() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const projectsQuery = trpc.project.list.useQuery();
  const projects = (projectsQuery.data ?? []) as Array<{ id: number; title: string; trackCount: number }>;
  const projectQuery = trpc.project.get.useQuery(
    { id: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const tracks = useMemo(() => {
    const data = projectQuery.data as { tracks?: Array<{ id: number; title: string }> } | undefined;
    return data?.tracks ?? [];
  }, [projectQuery.data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">1. Select a project</label>
            {projectsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects found. Create a project and upload tracks first.</p>
            ) : (
              <Select
                value={selectedProjectId ? String(selectedProjectId) : ""}
                onValueChange={(v) => {
                  setSelectedProjectId(parseInt(v, 10));
                  setSelectedTrackId(null);
                }}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title} ({p.trackCount} tracks)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {selectedProjectId && (
            <div>
              <label className="text-sm font-medium mb-2 block">2. Select a track</label>
              {projectQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading tracks...
                </div>
              ) : tracks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tracks in this project.</p>
              ) : (
                <Select
                  value={selectedTrackId ? String(selectedTrackId) : ""}
                  onValueChange={(v) => setSelectedTrackId(parseInt(v, 10))}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Choose a track..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tracks.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {selectedTrackId && <ReleaseReadinessView trackId={selectedTrackId} />}
    </div>
  );
}

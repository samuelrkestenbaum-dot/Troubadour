/**
 * Feature 2: Competitive Benchmarking
 * Shows genre percentile rankings with visual comparisons.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, BarChart, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function CompetitiveBenchmarkView() {
  const [genre, setGenre] = useState<string>("");
  const [focusMode, setFocusMode] = useState<string>("general");

  const evaluate = trpc.competitiveBenchmark.evaluate.useMutation({
    onError: (err: any) => toast.error("Benchmark failed: " + (err?.message ?? "Unknown error")),
  });

  const percentileColor = (p: number) => {
    if (p >= 90) return "text-emerald-400";
    if (p >= 75) return "text-blue-400";
    if (p >= 50) return "text-amber-400";
    if (p >= 25) return "text-orange-400";
    return "text-red-400";
  };

  const percentileLabel = (p: number) => {
    if (p >= 90) return "Elite";
    if (p >= 75) return "Strong";
    if (p >= 50) return "Average";
    if (p >= 25) return "Developing";
    return "Emerging";
  };

  const percentileBg = (p: number) => {
    if (p >= 90) return "bg-emerald-500";
    if (p >= 75) return "bg-blue-500";
    if (p >= 50) return "bg-amber-500";
    if (p >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Competitive Benchmarking
          </h2>
          <p className="text-muted-foreground mt-1">See where you rank against other artists in your genre</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Genre</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a genre..." />
                </SelectTrigger>
                <SelectContent>
                  {["Pop", "Rock", "Hip-Hop", "R&B", "Electronic", "Jazz", "Classical", "Country", "Folk", "Metal", "Indie", "Latin", "Reggae", "Blues"].map(g => (
                    <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Focus Mode</label>
              <Select value={focusMode} onValueChange={setFocusMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="songwriting">Songwriting</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="mixing">Mixing</SelectItem>
                  <SelectItem value="mastering">Mastering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (!genre) { toast.error("Select a genre first"); return; }
                evaluate.mutate({ genre, focusMode });
              }}
              disabled={evaluate.isPending || !genre}
            >
              {evaluate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BarChart className="h-4 w-4 mr-1" />}
              Benchmark
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {evaluate.data && (
        <>
          {/* Overall Percentile */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                      strokeDasharray={`${(evaluate.data.overallPercentile / 100) * 264} 264`}
                      strokeLinecap="round"
                      className={percentileColor(evaluate.data.overallPercentile)}
                      stroke="currentColor"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-2xl font-bold ${percentileColor(evaluate.data.overallPercentile)}`}>
                      {evaluate.data.overallPercentile}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {percentileLabel(evaluate.data.overallPercentile)} — {evaluate.data.overallPercentile}th Percentile
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    In <span className="capitalize font-medium">{evaluate.data.genre}</span> ({evaluate.data.focusMode})

                  </p>
                  {evaluate.data.insights && (
                    <p className="text-sm mt-2 text-muted-foreground italic flex items-start gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {evaluate.data.insights}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimension Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dimension Breakdown</CardTitle>
              <CardDescription>Your score vs. genre median (p50) and top quartile (p75)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {evaluate.data.dimensions.map((dim: any) => (
                  <div key={dim.dimension} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{dim.dimension.replace(/([A-Z])/g, " $1").trim()}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={percentileColor(dim.percentile)}>
                          {dim.percentile}th
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {dim.userScore.toFixed(1)} / 10
                        </span>
                      </div>
                    </div>
                    {/* Comparison bar */}
                    <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                      {/* Genre p50 marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-muted-foreground/40 z-10"
                        style={{ left: `${(dim.p50 / 10) * 100}%` }}
                        title={`Genre median: ${dim.p50}`}
                      />
                      {/* Genre p75 marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-amber-500/40 z-10"
                        style={{ left: `${(dim.p75 / 10) * 100}%` }}
                        title={`Top quartile: ${dim.p75}`}
                      />
                      {/* User score */}
                      <div
                        className={`h-full rounded-full ${percentileBg(dim.percentile)}`}
                        style={{ width: `${(dim.userScore / 10) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0</span>
                      <span>p50: {dim.p50.toFixed(1)}</span>
                      <span>p75: {dim.p75.toFixed(1)}</span>
                      <span>10</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

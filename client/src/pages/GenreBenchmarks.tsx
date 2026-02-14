import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, Music, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

function ScoreBar({ score, max = 10, color = "bg-primary" }: { score: number; max?: number; color?: string }) {
  const pct = (score / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function BenchmarkCard({ genre, onSelect }: { genre: { genre: string | null; count: number }; onSelect: (g: string) => void }) {
  return (
    <button
      onClick={() => genre.genre && onSelect(genre.genre)}
      className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-card/80 transition-colors text-left w-full"
    >
      <Music className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium capitalize">{genre.genre}</p>
        <p className="text-xs text-muted-foreground">{genre.count} track{genre.count !== 1 ? "s" : ""}</p>
      </div>
    </button>
  );
}

function BenchmarkDetail({ genre }: { genre: string }) {
  const { data, isLoading } = trpc.benchmark.byGenre.useQuery({ genre });

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground mt-2">Loading benchmarks…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Not enough reviewed tracks in this genre to generate benchmarks. Review more tracks to see data.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedScores = Object.entries(data.averageScores).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium capitalize">{genre} — {data.trackCount} Tracks Analyzed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Average scores */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium mb-2">Average Scores</p>
              {sortedScores.map(([key, value]) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                  </div>
                  <ScoreBar
                    score={value}
                    color={value >= 8 ? "bg-emerald-500" : value >= 6 ? "bg-amber-400" : "bg-red-400"}
                  />
                </div>
              ))}
            </div>

            {/* Distribution */}
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" /> Top Strengths
                </p>
                <div className="space-y-1">
                  {data.topStrengths.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-300 mr-1">{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-400" /> Common Weaknesses
                </p>
                <div className="space-y-1">
                  {data.commonWeaknesses.map((w, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-red-500/10 border-red-500/30 text-red-300 mr-1">{w}</Badge>
                  ))}
                </div>
              </div>

              {/* Score ranges */}
              {data.scoreDistribution && Object.keys(data.scoreDistribution).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Score Ranges</p>
                  <div className="space-y-1 text-xs">
                    {Object.entries(data.scoreDistribution).slice(0, 5).map(([key, dist]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-24 capitalize truncate">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="text-muted-foreground font-mono">{dist.min.toFixed(1)}–{dist.max.toFixed(1)}</span>
                        <span className="text-muted-foreground">(median: {dist.median.toFixed(1)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GenreBenchmarks() {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const { data: genres = [], isLoading } = trpc.benchmark.genres.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Genre Benchmarks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          See how tracks in each genre score on average. Compare your work against the community baseline.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : genres.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">No Benchmark Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload and review tracks to start building genre benchmarks. The more tracks reviewed, the more accurate the benchmarks become.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-[240px_1fr] gap-6">
          {/* Genre list */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-1">Select Genre</p>
            {genres.filter((g: { genre: string | null; count: number }) => g.genre !== null).map((g: { genre: string | null; count: number }) => (
              <div
                key={g.genre}
                className={selectedGenre === g.genre ? "ring-1 ring-primary rounded-lg" : ""}
              >
                <BenchmarkCard genre={g} onSelect={(v) => setSelectedGenre(v)} />
              </div>
            ))}
          </div>

          {/* Detail */}
          <div>
            {selectedGenre ? (
              <BenchmarkDetail genre={selectedGenre} />
            ) : (
              <Card className="border-border/40">
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">Select a genre to view benchmarks</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

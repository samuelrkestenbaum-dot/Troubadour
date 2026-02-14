import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Music, AlertCircle, BarChart3, Disc3 } from "lucide-react";
import { Streamdown } from "streamdown";
import { RadarChart } from "@/components/RadarChart";
import { scoreColor } from "@/lib/scoreColor";

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

export default function SharedReview({ token }: { token: string }) {
  const { data, isLoading, error } = trpc.review.getPublic.useQuery({ token });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="space-y-6 w-full max-w-3xl px-4">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Review Not Found</h1>
          <p className="text-muted-foreground">This review link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const scores = data.scoresJson as Record<string, number> | null;
  const overall = scores?.["overall"] ?? scores?.["Overall"];
  const dimensionScores = scores
    ? Object.entries(scores).filter(([k]) => k !== "overall" && k !== "Overall")
    : [];

  const radarScores = Object.fromEntries(dimensionScores);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Disc3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Troubadour Review</p>
              <h1 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{data.trackName}</h1>
            </div>
          </div>

          {/* Genre Insight */}
          {data.genreInsight?.detectedGenre && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Music className="h-3.5 w-3.5 text-primary/60" />
              <span className="italic">
                We hear: {data.genreInsight.detectedGenre}
                {data.genreInsight.detectedSubgenres && ` | ${data.genreInsight.detectedSubgenres}`}
                {data.genreInsight.detectedInfluences && ` — touches of ${data.genreInsight.detectedInfluences}`}
              </span>
            </div>
          )}

          {/* Quick Take */}
          {data.quickTake && (
            <blockquote className="border-l-2 border-primary/40 pl-4 text-sm text-foreground/80 italic">
              {data.quickTake}
            </blockquote>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Scores Section */}
        {scores && Object.keys(scores).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Score */}
            {overall !== undefined && (
              <Card className="border-primary/20">
                <CardContent className="py-6 flex flex-col items-center justify-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Overall Score</p>
                  <span className={`text-5xl font-bold font-mono ${scoreColor(overall)}`}>
                    {overall}
                  </span>
                  <span className="text-lg text-muted-foreground">/10</span>
                </CardContent>
              </Card>
            )}

            {/* Radar Chart */}
            {dimensionScores.length >= 3 && (
              <Card>
                <CardContent className="py-4 flex items-center justify-center">
                  <RadarChart
                    scores={radarScores}
                    maxScore={10}
                    size={220}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Dimension Scores */}
        {dimensionScores.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dimensionScores.map(([key, value]) => (
              <Card key={key}>
                <CardContent className="py-3 px-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{formatLabel(key)}</p>
                  <span className={`text-lg font-bold font-mono ${scoreColor(value)}`}>{value}</span>
                  <span className="text-xs text-muted-foreground">/10</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Separator />

        {/* Review Content */}
        <div className="prose prose-invert prose-sm max-w-none">
          <Streamdown>{data.reviewMarkdown || ""}</Streamdown>
        </div>

        {/* Footer */}
        <Separator />
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Generated by <span className="font-semibold text-primary">Troubadour</span> on {new Date(data.createdAt).toLocaleDateString()}</p>
          <p className="mt-1">AI-powered music critique using Claude 4.5 Sonnet</p>
        </div>
      </div>
    </div>
  );
}

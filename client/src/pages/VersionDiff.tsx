import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowUp, ArrowDown, Minus, GitCompare, TrendingUp, TrendingDown, BarChart3
} from "lucide-react";
import { Streamdown } from "streamdown";

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-400 font-semibold text-sm">
        <ArrowUp className="h-3.5 w-3.5" />
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 font-semibold text-sm">
        <ArrowDown className="h-3.5 w-3.5" />
        {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground font-semibold text-sm">
      <Minus className="h-3.5 w-3.5" />
      0
    </span>
  );
}

function ScoreBar({ label, previous, current, delta }: {
  label: string;
  previous: number | null;
  current: number | null;
  delta: number;
}) {
  const prevPct = (previous ?? 0) * 10;
  const currPct = (current ?? 0) * 10;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <DeltaIndicator delta={delta} />
      </div>
      <div className="flex items-center gap-3">
        {/* Previous */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>v{1}</span>
            <span>{previous ?? "—"}/10</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-muted-foreground/40 transition-all"
              style={{ width: `${prevPct}%` }}
            />
          </div>
        </div>
        {/* Current */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>v{2}</span>
            <span>{current ?? "—"}/10</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                delta > 0 ? "bg-green-500" : delta < 0 ? "bg-red-500" : "bg-primary"
              }`}
              style={{ width: `${currPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VersionDiff({ trackId }: { trackId: number }) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.review.versionDiff.useQuery({ trackId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <GitCompare className="h-8 w-8 text-destructive mb-4" />
        <p className="text-muted-foreground">{error?.message || "Could not load version diff"}</p>
        <Button variant="ghost" onClick={() => window.history.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const { currentTrack, parentTrack, currentReview, parentReview, comparisonReview, deltas } = data;
  const deltaEntries = Object.entries(deltas);
  const overallDelta = deltas["overall"] || deltas["Overall"];
  const improvements = deltaEntries.filter(([, d]) => d.delta > 0);
  const regressions = deltaEntries.filter(([, d]) => d.delta < 0);
  const unchanged = deltaEntries.filter(([, d]) => d.delta === 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/tracks/${trackId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-primary" />
            Version Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {parentTrack.filename} (v{parentTrack.versionNumber}) → {currentTrack.filename} (v{currentTrack.versionNumber})
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`${improvements.length > regressions.length ? "border-green-500/30 bg-green-500/5" : improvements.length < regressions.length ? "border-red-500/30 bg-red-500/5" : "border-primary/30 bg-primary/5"}`}>
          <CardContent className="py-4 text-center">
            <div className="text-3xl font-bold mb-1">
              {improvements.length > regressions.length ? (
                <TrendingUp className="h-8 w-8 mx-auto text-green-400" />
              ) : improvements.length < regressions.length ? (
                <TrendingDown className="h-8 w-8 mx-auto text-red-400" />
              ) : (
                <Minus className="h-8 w-8 mx-auto text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium mt-2">
              {improvements.length > regressions.length ? "Overall Improvement" :
               improvements.length < regressions.length ? "Needs Work" : "Lateral Move"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-400">{improvements.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Improved</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-red-400">{regressions.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Regressed</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Score Delta */}
      {overallDelta && (
        <Card className="border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-2xl font-mono text-muted-foreground">{overallDelta.previous ?? "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-2xl font-mono font-bold">{overallDelta.current ?? "—"}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Change</p>
                <div className="mt-1">
                  <span className={`text-2xl font-bold ${overallDelta.delta > 0 ? "text-green-400" : overallDelta.delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {overallDelta.delta > 0 ? "+" : ""}{overallDelta.delta}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dimension-by-Dimension Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {deltaEntries
            .filter(([key]) => key !== "overall" && key !== "Overall")
            .map(([key, d]) => (
              <ScoreBar
                key={key}
                label={formatLabel(key)}
                previous={d.previous}
                current={d.current}
                delta={d.delta}
              />
            ))}
        </CardContent>
      </Card>

      {/* Quick Take Comparison */}
      {(parentReview?.quickTake || currentReview?.quickTake) && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Takes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parentReview?.quickTake && (
              <div>
                <Badge variant="outline" className="mb-2">v{parentTrack.versionNumber}</Badge>
                <p className="text-sm text-muted-foreground italic">"{parentReview.quickTake}"</p>
              </div>
            )}
            {currentReview?.quickTake && (
              <div>
                <Badge className="mb-2">v{currentTrack.versionNumber}</Badge>
                <p className="text-sm italic">"{currentReview.quickTake}"</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comparison Review (Claude-generated) */}
      {comparisonReview && (
        <Card>
          <CardHeader>
            <CardTitle>AI Comparison Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none">
              <Streamdown>{comparisonReview.markdown || ""}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}

      {!comparisonReview && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <GitCompare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No AI comparison analysis yet. Go to the track page and click "Compare" to generate one.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setLocation(`/tracks/${trackId}`)}
            >
              Go to Track
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {parentReview && (
          <Button variant="outline" onClick={() => setLocation(`/reviews/${parentReview.id}`)}>
            View v{parentTrack.versionNumber} Review
          </Button>
        )}
        {currentReview && (
          <Button variant="outline" onClick={() => setLocation(`/reviews/${currentReview.id}`)}>
            View v{currentTrack.versionNumber} Review
          </Button>
        )}
      </div>
    </div>
  );
}

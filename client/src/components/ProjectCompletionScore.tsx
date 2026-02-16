import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Music, Star, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getProgressColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getStatusLabel(score: number): string {
  if (score >= 90) return "Release Ready";
  if (score >= 75) return "Nearly There";
  if (score >= 60) return "Making Progress";
  if (score >= 40) return "Needs Work";
  return "Early Stage";
}

function TrackRow({ track }: { track: any }) {
  const scoreColor = getScoreColor(track.trackScore);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
          {track.trackOrder}
        </span>
        <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm truncate">{track.filename}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {track.hasReview ? (
          <Badge variant="outline" className="text-[10px] px-1.5 text-emerald-400 border-emerald-500/30">
            <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
            {track.reviewScore.toFixed(1)}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
            No review
          </Badge>
        )}

        {track.masteringReadiness > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5">
            {track.masteringReadiness}% ready
          </Badge>
        )}

        {track.isReady && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        )}

        <span className={`text-sm font-bold w-8 text-right ${scoreColor}`}>
          {track.trackScore}
        </span>
      </div>
    </div>
  );
}

export function ProjectCompletionScore({ projectId }: { projectId: number }) {
  const scoreQuery = trpc.completion.getScore.useQuery({ projectId });

  if (scoreQuery.isLoading) {
    return (
      <Card className="border-muted-foreground/20">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const data = scoreQuery.data;
  if (!data || data.trackCount === 0) {
    return (
      <Card className="border-muted-foreground/20">
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Target className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">No tracks yet</p>
          <p className="text-xs mt-1">Upload tracks to see your album readiness score</p>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = getScoreColor(data.overallScore);
  const statusLabel = getStatusLabel(data.overallScore);

  return (
    <Card className="border-muted-foreground/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Album Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero Score */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`text-4xl font-black ${scoreColor}`}>
              {data.overallScore}
            </div>
            <div className="text-[10px] text-muted-foreground text-center">/ 100</div>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={`text-xs ${scoreColor}`}>
                {statusLabel}
              </Badge>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${getProgressColor(data.overallScore)}`}
                style={{ width: `${data.overallScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-md bg-muted/30">
            <div className="text-lg font-bold">{data.trackCount}</div>
            <div className="text-[10px] text-muted-foreground">Tracks</div>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/30">
            <div className="text-lg font-bold text-blue-400">{data.reviewedCount}</div>
            <div className="text-[10px] text-muted-foreground">Reviewed</div>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/30">
            <div className="text-lg font-bold text-amber-400">{data.averageReviewScore}</div>
            <div className="text-[10px] text-muted-foreground">Avg Score</div>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/30">
            <div className="text-lg font-bold text-emerald-400">{data.readyCount}</div>
            <div className="text-[10px] text-muted-foreground">Ready</div>
          </div>
        </div>

        {/* Track Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Track Breakdown</span>
            <span className="text-[10px] text-muted-foreground">Score</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {data.tracks.map((track: any) => (
              <TrackRow key={track.id} track={track} />
            ))}
          </div>
        </div>

        {/* Warnings */}
        {data.reviewedCount < data.trackCount && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              {data.trackCount - data.reviewedCount} track{data.trackCount - data.reviewedCount > 1 ? "s" : ""} still need{data.trackCount - data.reviewedCount === 1 ? "s" : ""} a review.
              Review all tracks to get an accurate readiness score.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

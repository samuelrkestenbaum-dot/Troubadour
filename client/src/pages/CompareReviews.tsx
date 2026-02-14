import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GitCompare, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

interface CompareReviewsProps {
  projectId: number;
}

function ScoreBar({ label, value, maxValue = 10 }: { label: string; value: number; maxValue?: number }) {
  const pct = Math.min((value / maxValue) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold text-primary">{value}/{maxValue}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReviewPanel({
  review,
  trackTitle,
  isEmpty,
}: {
  review: { reviewMarkdown: string; scoresJson: unknown; quickTake: string | null } | null;
  trackTitle: string;
  isEmpty: boolean;
}) {
  if (isEmpty) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground py-10 px-6">
          <GitCompare className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Select a track</p>
          <p className="text-sm mt-1">Choose a reviewed track from the dropdown above</p>
        </div>
      </Card>
    );
  }

  if (!review) return null;

  const scores = review.scoresJson as Record<string, number> | null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg line-clamp-2">{trackTitle}</CardTitle>
        {review.quickTake && (
          <p className="text-sm text-muted-foreground italic mt-1 line-clamp-2">"{review.quickTake}"</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-4">
        {scores && Object.keys(scores).length > 0 && (
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            {Object.entries(scores).map(([key, value]) => (
              <ScoreBar
                key={key}
                label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                value={typeof value === "number" ? value : 0}
              />
            ))}
          </div>
        )}
        <Separator />
        <div className="prose dark:prose-invert max-w-none text-sm">
          <Streamdown>{review.reviewMarkdown}</Streamdown>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompareReviews({ projectId }: CompareReviewsProps) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = trpc.project.get.useQuery({ id: projectId });

  const [leftTrackId, setLeftTrackId] = useState<string>("");
  const [rightTrackId, setRightTrackId] = useState<string>("");

  // Build a map of trackId -> latest track review
  const reviewMap = useMemo(() => {
    if (!data?.reviews) return new Map<number, NonNullable<typeof data>["reviews"][number]>();
    const map = new Map<number, (typeof data.reviews)[number]>();
    for (const r of data.reviews) {
      if (r.reviewType === "track" && r.isLatest && r.trackId) {
        map.set(r.trackId, r);
      }
    }
    return map;
  }, [data?.reviews]);

  // Only tracks that have a completed review
  const availableTracks = useMemo(() => {
    if (!data?.tracks) return [];
    return data.tracks.filter((t) => reviewMap.has(t.id));
  }, [data?.tracks, reviewMap]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  if (error || !data?.project) {
    return (
      <div className="container mx-auto py-8 text-destructive">
        Error loading project: {error?.message || "Project not found."}
      </div>
    );
  }

  if (availableTracks.length < 2) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => setLocation(`/projects/${projectId}`)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Project
        </Button>
        <div className="text-center py-20">
          <GitCompare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Not enough reviews to compare</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You need at least two reviewed tracks in this project to use the comparison feature.
            Upload and review more tracks first.
          </p>
          <Button onClick={() => setLocation(`/projects/${projectId}`)} className="mt-6">
            Go to Project
          </Button>
        </div>
      </div>
    );
  }

  const leftReview = leftTrackId ? reviewMap.get(Number(leftTrackId)) ?? null : null;
  const rightReview = rightTrackId ? reviewMap.get(Number(rightTrackId)) ?? null : null;
  const leftTrack = availableTracks.find((t) => t.id.toString() === leftTrackId);
  const rightTrack = availableTracks.find((t) => t.id.toString() === rightTrackId);

  // Score comparison summary
  const leftScores = leftReview?.scoresJson as Record<string, number> | null;
  const rightScores = rightReview?.scoresJson as Record<string, number> | null;
  const canCompareScores = leftScores && rightScores && Object.keys(leftScores).length > 0 && Object.keys(rightScores).length > 0;

  return (
    <div className="container mx-auto py-8">
      <Button variant="ghost" onClick={() => setLocation(`/projects/${projectId}`)} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Project
      </Button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center">
          <GitCompare className="h-7 w-7 mr-3 text-primary" />
          Compare Reviews
        </h1>
        <Badge variant="secondary" className="text-sm">
          {data.project.title}
        </Badge>
      </div>

      {/* Score comparison bar (when both selected) */}
      {canCompareScores && (
        <Card className="mb-6 p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Score Comparison</h3>
          <div className="space-y-2">
            {Object.keys(leftScores).map((key) => {
              const lv = leftScores[key] ?? 0;
              const rv = rightScores[key] ?? 0;
              const diff = lv - rv;
              return (
                <div key={key} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm">
                  <div className="text-right">
                    <span className={cn("font-bold", diff > 0 ? "text-green-500" : diff < 0 ? "text-red-400" : "text-muted-foreground")}>
                      {lv}/10
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs w-32 text-center">
                    {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  </span>
                  <div>
                    <span className={cn("font-bold", diff < 0 ? "text-green-500" : diff > 0 ? "text-red-400" : "text-muted-foreground")}>
                      {rv}/10
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel */}
        <div className="space-y-4">
          <Select value={leftTrackId} onValueChange={setLeftTrackId}>
            <SelectTrigger>
              <SelectValue placeholder="Select left track..." />
            </SelectTrigger>
            <SelectContent>
              {availableTracks.map((track) => (
                <SelectItem
                  key={track.id}
                  value={track.id.toString()}
                  disabled={track.id.toString() === rightTrackId}
                >
                  {track.originalFilename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ReviewPanel
            review={leftReview}
            trackTitle={leftTrack?.originalFilename || ""}
            isEmpty={!leftTrackId}
          />
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Select value={rightTrackId} onValueChange={setRightTrackId}>
            <SelectTrigger>
              <SelectValue placeholder="Select right track..." />
            </SelectTrigger>
            <SelectContent>
              {availableTracks.map((track) => (
                <SelectItem
                  key={track.id}
                  value={track.id.toString()}
                  disabled={track.id.toString() === leftTrackId}
                >
                  {track.originalFilename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ReviewPanel
            review={rightReview}
            trackTitle={rightTrack?.originalFilename || ""}
            isEmpty={!rightTrackId}
          />
        </div>
      </div>
    </div>
  );
}

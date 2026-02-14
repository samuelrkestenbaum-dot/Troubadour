import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, ChevronDown, ChevronUp, Star, Lightbulb, Music } from "lucide-react";
import { useState, useMemo } from "react";

function ScoreRing({ score, label, size = 64 }: { score: number; label: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  const strokeColor = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={4}
            strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${color}`}>{score}</span>
      </div>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

function TrackQuickCard({ track, review }: { track: any; review: any }) {
  const [expanded, setExpanded] = useState(false);
  const scores = review?.scoresJson ? (typeof review.scoresJson === "string" ? JSON.parse(review.scoresJson) : review.scoresJson) : null;
  const suggestions = review?.suggestionsJson ? (typeof review.suggestionsJson === "string" ? JSON.parse(review.suggestionsJson) : review.suggestionsJson) : [];
  const topSuggestions = suggestions.slice(0, 3);

  if (!review || !scores) {
    return (
      <Card className="border-dashed opacity-60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Music className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{track.originalFilename}</p>
              <p className="text-sm text-muted-foreground">Not yet reviewed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallScore = scores.overall ?? scores.Overall ?? Object.values(scores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) / Object.keys(scores).length;
  const scoreEntries = Object.entries(scores).filter(([k]) => k.toLowerCase() !== "overall");

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header with track name and overall score */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate">{track.originalFilename}</h3>
            {track.detectedGenre && (
              <Badge variant="secondary" className="mt-1 text-xs">{track.detectedGenre}</Badge>
            )}
          </div>
          <ScoreRing score={Math.round(overallScore)} label="Overall" size={72} />
        </div>

        {/* Quick Take */}
        {review.quickTake && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed">{review.quickTake}</p>
            </div>
          </div>
        )}

        {/* Score breakdown - compact */}
        <div className="flex flex-wrap gap-3 justify-center">
          {scoreEntries.map(([key, value]) => (
            <ScoreRing key={key} score={Math.round(Number(value))} label={key} size={52} />
          ))}
        </div>

        {/* Top 3 Suggestions */}
        {topSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Top Suggestions</span>
            </div>
            <ul className="space-y-1.5">
              {topSuggestions.map((s: any, i: number) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-amber-400 font-bold shrink-0">{i + 1}.</span>
                  <span className="text-muted-foreground">{typeof s === "string" ? s : s.suggestion || s.text || JSON.stringify(s)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expand for full review */}
        {review.markdownContent && (
          <div>
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {expanded ? "Collapse" : "Full Review"}
            </Button>
            {expanded && (
              <div className="mt-2 prose prose-sm prose-invert max-w-none text-sm text-muted-foreground whitespace-pre-wrap">
                {review.markdownContent}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function QuickReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = Number(id);

  const { data, isLoading } = trpc.project.get.useQuery(
    { id: projectId },
    { enabled: !isNaN(projectId) }
  );

  const reviewMap = useMemo(() => {
    if (!data?.reviews) return new Map<number, any>();
    const map = new Map<number, any>();
    for (const r of data.reviews) {
      if (r.reviewType === "track" && r.trackId != null) {
        const existing = map.get(r.trackId);
        if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
          map.set(r.trackId, r);
        }
      }
    }
    return map;
  }, [data?.reviews]);

  const reviewedTracks = useMemo(() => {
    if (!data?.tracks) return [];
    return data.tracks.filter(t => reviewMap.has(t.id));
  }, [data?.tracks, reviewMap]);

  const unreviewedTracks = useMemo(() => {
    if (!data?.tracks) return [];
    return data.tracks.filter(t => !reviewMap.has(t.id));
  }, [data?.tracks, reviewMap]);

  // Compute project-level stats
  const avgScore = useMemo(() => {
    if (reviewedTracks.length === 0) return 0;
    let total = 0;
    for (const t of reviewedTracks) {
      const review = reviewMap.get(t.id);
      const scores = review?.scoresJson ? (typeof review.scoresJson === "string" ? JSON.parse(review.scoresJson) : review.scoresJson) : {};
      const overall = scores.overall ?? scores.Overall ?? Object.values(scores).reduce((a: number, b: any) => a + (Number(b) || 0), 0) / Math.max(Object.keys(scores).length, 1);
      total += Number(overall);
    }
    return Math.round(total / reviewedTracks.length);
  }, [reviewedTracks, reviewMap]);

  if (isNaN(projectId)) {
    navigate("/dashboard");
    return null;
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-4xl py-8 text-center">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <h1 className="text-2xl font-bold">Quick Review</h1>
            </div>
            <p className="text-sm text-muted-foreground">{data.project.title}</p>
          </div>
        </div>

        {reviewedTracks.length > 0 && (
          <div className="text-right">
            <ScoreRing score={avgScore} label="Project Avg" size={80} />
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{data.tracks.length}</p>
            <p className="text-xs text-muted-foreground">Total Tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{reviewedTracks.length}</p>
            <p className="text-xs text-muted-foreground">Reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{avgScore || "—"}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviewed tracks */}
      {reviewedTracks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            Reviewed Tracks
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {reviewedTracks.map(track => (
              <TrackQuickCard key={track.id} track={track} review={reviewMap.get(track.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Unreviewed tracks */}
      {unreviewedTracks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Pending Review</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {unreviewedTracks.map(track => (
              <TrackQuickCard key={track.id} track={track} review={null} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

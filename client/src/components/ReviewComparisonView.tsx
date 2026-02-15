import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, GitCompare } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";

interface ReviewComparisonViewProps {
  trackId: number;
}

// Use the actual tRPC return type - scoresJson comes as unknown from Drizzle

function ScoreDelta({ label, score1, score2 }: { label: string; score1: number | undefined; score2: number | undefined }) {
  const s1 = score1 ?? 0;
  const s2 = score2 ?? 0;
  const delta = s2 - s1;

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
      <span className="text-sm font-medium capitalize">{label.replace(/_/g, " ")}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums w-8 text-right text-muted-foreground">{s1}/10</span>
        <span className="text-sm text-muted-foreground">→</span>
        <span className="text-sm tabular-nums w-8 text-right">{s2}/10</span>
        {delta !== 0 ? (
          <Badge variant={delta > 0 ? "default" : "destructive"} className="text-xs px-1.5 py-0 min-w-[40px] justify-center">
            {delta > 0 ? <ArrowUp className="h-3 w-3 mr-0.5" /> : <ArrowDown className="h-3 w-3 mr-0.5" />}
            {delta > 0 ? `+${delta}` : delta}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[40px] justify-center">
            <Minus className="h-3 w-3 mr-0.5" />0
          </Badge>
        )}
      </div>
    </div>
  );
}

export function ReviewComparisonView({ trackId }: ReviewComparisonViewProps) {
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  const { data: reviews } = trpc.review.history.useQuery({ trackId });

  const leftReview = trpc.review.get.useQuery(
    { id: Number(leftId) },
    { enabled: !!leftId }
  );
  const rightReview = trpc.review.get.useQuery(
    { id: Number(rightId) },
    { enabled: !!rightId }
  );

  const allScoreKeys = useMemo(() => {
    const keys = new Set<string>();
    const ls = leftReview.data?.scoresJson as Record<string, number> | null;
    const rs = rightReview.data?.scoresJson as Record<string, number> | null;
    if (ls) Object.keys(ls).forEach(k => keys.add(k));
    if (rs) Object.keys(rs).forEach(k => keys.add(k));
    return Array.from(keys);
  }, [leftReview.data, rightReview.data]);

  const leftScores = (leftReview.data?.scoresJson as Record<string, number> | null) || {};
  const rightScores = (rightReview.data?.scoresJson as Record<string, number> | null) || {};

  if (!reviews || reviews.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <GitCompare className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Need at least 2 reviews to compare</p>
        <p className="text-sm mt-1">Run another review with a different template or role to unlock comparison.</p>
      </div>
    );
  }

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Review A</label>
          <Select value={leftId} onValueChange={setLeftId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a review..." />
            </SelectTrigger>
            <SelectContent>
              {reviews.map((r: any) => (
                <SelectItem key={r.id} value={String(r.id)} disabled={String(r.id) === rightId}>
                  v{r.reviewVersion} — {formatDate(r.createdAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden sm:flex items-center pt-5">
          <GitCompare className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Review B</label>
          <Select value={rightId} onValueChange={setRightId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a review..." />
            </SelectTrigger>
            <SelectContent>
              {reviews.map((r: any) => (
                <SelectItem key={r.id} value={String(r.id)} disabled={String(r.id) === leftId}>
                  v{r.reviewVersion} — {formatDate(r.createdAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Score Comparison */}
      {leftId && rightId && allScoreKeys.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {allScoreKeys.map(key => (
              <ScoreDelta key={key} label={key} score1={leftScores[key]} score2={rightScores[key]} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Side-by-side Reviews */}
      {leftId && rightId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Review A
                {leftReview.data && (
                  <Badge variant="outline" className="text-xs">v{leftReview.data.reviewVersion}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              {leftReview.isLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              ) : leftReview.data?.reviewMarkdown ? (
                <Streamdown>{leftReview.data.reviewMarkdown}</Streamdown>
              ) : (
                <p className="text-muted-foreground">Select a review to view</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Review B
                {rightReview.data && (
                  <Badge variant="outline" className="text-xs">v{rightReview.data.reviewVersion}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              {rightReview.isLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              ) : rightReview.data?.reviewMarkdown ? (
                <Streamdown>{rightReview.data.reviewMarkdown}</Streamdown>
              ) : (
                <p className="text-muted-foreground">Select a review to view</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

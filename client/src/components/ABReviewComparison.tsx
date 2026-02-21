import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GitCompare, Star, ChevronDown, ChevronUp, History, ArrowRight, StickyNote, Check } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// Focus modes removed in Round 94 UX simplification — A/B comparison now uses templates only
// Round 97: Added "Compare with Previous Version" option per Claude Opus 4 design

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 8 ? "text-emerald-400" : score >= 6 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function VersionNoteInput({ reviewId, initialNote }: { reviewId: number; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote || "");
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();
  const updateNote = trpc.review.updateVersionNote.useMutation({
    onSuccess: () => {
      setSaved(true);
      utils.review.get.invalidate({ id: reviewId });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => toast.error(err.message || "Failed to save note"),
  });

  const handleSave = useCallback(() => {
    updateNote.mutate({ reviewId, versionNote: note.trim() || null });
  }, [reviewId, note, updateNote]);

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center gap-1.5 mb-1.5">
        <StickyNote className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">Version Note</span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="e.g. Re-recorded vocals, new bridge section"
          maxLength={500}
          className="flex-1 text-xs bg-background/50 border border-border/50 rounded-md px-2 py-1.5 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={updateNote.isPending || saved}
          className="h-7 px-2 text-xs"
        >
          {saved ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : updateNote.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

function ReviewPanel({ review, side, label }: { review: any; side: "A" | "B"; label?: string }) {
  const [expanded, setExpanded] = useState(true);
  const scores = review?.scoresJson as any;
  const focusLabel = label || (side === "A" ? "Review A" : "Review B");
  const sideColor = side === "A" ? "border-blue-500/50 bg-blue-500/5" : "border-purple-500/50 bg-purple-500/5";
  const sideBadge = side === "A" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400";

  if (!review) {
    return (
      <Card className={`${sideColor} border`}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Generating review {side}...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${sideColor} border`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={sideBadge}>{side}</Badge>
            <span className="text-sm font-medium">{focusLabel}</span>
          </div>
          {scores?.overall && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="text-lg font-bold">{scores.overall.toFixed(1)}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scores && (
          <div className="grid grid-cols-3 gap-2 pb-3 border-b border-border/50">
            {scores.composition != null && <ScoreBadge score={scores.composition} label="Composition" />}
            {scores.production != null && <ScoreBadge score={scores.production} label="Production" />}
            {scores.vocals != null && <ScoreBadge score={scores.vocals} label="Vocals" />}
            {scores.arrangement != null && <ScoreBadge score={scores.arrangement} label="Arrangement" />}
            {scores.mixMaster != null && <ScoreBadge score={scores.mixMaster} label="Mix" />}
            {scores.originality != null && <ScoreBadge score={scores.originality} label="Originality" />}
          </div>
        )}

        {review.quickTake && (
          <div className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
            {review.quickTake}
          </div>
        )}

        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Collapse" : "Expand"} full review
          </button>
          {expanded && (
            <div className="mt-2 prose prose-sm prose-invert max-w-none">
              <Streamdown>{review.body || ""}</Streamdown>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type ComparisonMode = "perspectives" | "versions";

export function ABReviewComparison({ trackId }: { trackId: number }) {
  const [mode, setMode] = useState<ComparisonMode>("perspectives");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isSetup, setIsSetup] = useState(true);

  // Version comparison state
  const [selectedPreviousReviewId, setSelectedPreviousReviewId] = useState<string>("");
  const [versionCompareActive, setVersionCompareActive] = useState(false);

  // Fetch review history for version comparison
  const historyQuery = trpc.review.history.useQuery(
    { trackId },
    { enabled: mode === "versions" }
  );

  // Fetch the selected previous review
  const previousReviewQuery = trpc.review.get.useQuery(
    { id: Number(selectedPreviousReviewId) },
    { enabled: versionCompareActive && !!selectedPreviousReviewId }
  );

  // Fetch the current (latest) review
  const currentReviewQuery = trpc.review.get.useQuery(
    { id: historyQuery.data?.[0]?.id ?? 0 },
    { enabled: versionCompareActive && !!historyQuery.data?.[0]?.id }
  );

  const generateMutation = trpc.abCompare.generate.useMutation({
    onSuccess: (data) => {
      setActiveBatchId(data.batchId);
      setIsSetup(false);
      toast.success("A/B comparison started — two reviews being generated simultaneously");
    },
    onError: (err) => toast.error(err.message),
  });

  const resultsQuery = trpc.abCompare.getResults.useQuery(
    { batchId: activeBatchId! },
    { enabled: !!activeBatchId, refetchInterval: activeBatchId ? 3000 : false }
  );

  useEffect(() => {
    if (resultsQuery.data?.status === "complete" || resultsQuery.data?.status === "error") {
      // Query will stop refetching since we don't need to poll anymore
    }
  }, [resultsQuery.data?.status]);

  const handleGenerate = () => {
    generateMutation.mutate({ trackId });
  };

  const handleNewComparison = () => {
    setActiveBatchId(null);
    setIsSetup(true);
    setVersionCompareActive(false);
    setSelectedPreviousReviewId("");
  };

  const handleVersionCompare = () => {
    if (!selectedPreviousReviewId) {
      toast.error("Select a previous review to compare");
      return;
    }
    setVersionCompareActive(true);
    setIsSetup(false);
  };

  const reviewHistory = historyQuery.data || [];
  const hasPreviousVersions = reviewHistory.length >= 2;

  // Setup screen
  if (isSetup) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            A/B Review Comparison
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Compare reviews side-by-side to gain deeper insight into your track.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("perspectives")}
              className={`p-3 rounded-lg border text-left transition-all ${
                mode === "perspectives"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <GitCompare className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Fresh Perspectives</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Generate two new reviews from different AI personas
              </p>
            </button>
            <button
              onClick={() => setMode("versions")}
              className={`p-3 rounded-lg border text-left transition-all ${
                mode === "versions"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              } ${!hasPreviousVersions && mode !== "versions" ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <History className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Version History</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Compare current review with a previous version
              </p>
            </button>
          </div>

          {/* Fresh Perspectives mode */}
          {mode === "perspectives" && (
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full"
              size="sm"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><GitCompare className="h-4 w-4 mr-2" /> Compare Perspectives</>
              )}
            </Button>
          )}

          {/* Version History mode */}
          {mode === "versions" && (
            <div className="space-y-3">
              {!hasPreviousVersions ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No previous reviews found. Re-review this track first to build version history.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Compare current review with:</label>
                    <Select value={selectedPreviousReviewId} onValueChange={setSelectedPreviousReviewId}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="Select a previous review" />
                      </SelectTrigger>
                      <SelectContent>
                        {reviewHistory.slice(1).map((r) => (
                          <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                            v{r.reviewVersion} — {r.scoresJson ? `${((r.scoresJson as any).overall || 0).toFixed(1)}/10` : "—"} — {new Date(r.createdAt!).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleVersionCompare}
                    disabled={!selectedPreviousReviewId}
                    className="w-full"
                    size="sm"
                  >
                    <History className="h-4 w-4 mr-2" />
                    Compare Versions
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Version comparison results
  if (versionCompareActive) {
    const currentReview = currentReviewQuery.data;
    const previousReview = previousReviewQuery.data;
    const isLoading = currentReviewQuery.isLoading || previousReviewQuery.isLoading;

    const currentScores = (currentReview?.scoresJson as any) || {};
    const previousScores = (previousReview?.scoresJson as any) || {};
    const scoreDiff = currentScores.overall && previousScores.overall
      ? (currentScores.overall - previousScores.overall).toFixed(1)
      : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Version Comparison</span>
            {isLoading && <Badge variant="outline" className="text-xs animate-pulse">Loading...</Badge>}
            {!isLoading && <Badge variant="outline" className="text-xs text-emerald-400">Ready</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleNewComparison} className="text-xs">
            New Comparison
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReviewPanel
            review={previousReview}
            side="A"
            label={`v${previousReview?.reviewVersion || "?"} (Previous)`}
          />
          <ReviewPanel
            review={currentReview}
            side="B"
            label={`v${currentReview?.reviewVersion || "?"} (Current)`}
          />
        </div>

        {/* Version annotations */}
        {!isLoading && previousReview && (
          <Card className="border-border/30">
            <CardContent className="py-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-muted-foreground">v{previousReview.reviewVersion} annotation:</span>
                  <VersionNoteInput reviewId={previousReview.id} initialNote={(previousReview as any).versionNote || null} />
                </div>
                {currentReview && (
                  <div>
                    <span className="text-[11px] text-muted-foreground">v{currentReview.reviewVersion} annotation:</span>
                    <VersionNoteInput reviewId={currentReview.id} initialNote={(currentReview as any).versionNote || null} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && currentReview && previousReview && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Score progression:</span>
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-medium">
                    v{previousReview.reviewVersion}: {previousScores.overall?.toFixed(1) || "—"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-purple-400 font-medium">
                    v{currentReview.reviewVersion}: {currentScores.overall?.toFixed(1) || "—"}
                  </span>
                  {scoreDiff && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${Number(scoreDiff) > 0 ? "text-emerald-400" : Number(scoreDiff) < 0 ? "text-red-400" : "text-muted-foreground"}`}
                    >
                      {Number(scoreDiff) > 0 ? "+" : ""}{scoreDiff}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // A/B Perspectives results (existing flow)
  const results = resultsQuery.data;
  const isComplete = results?.status === "complete";
  const isError = results?.status === "error";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">A/B Comparison</span>
          {!isComplete && !isError && (
            <Badge variant="outline" className="text-xs animate-pulse">Generating...</Badge>
          )}
          {isComplete && <Badge variant="outline" className="text-xs text-emerald-400">Complete</Badge>}
          {isError && <Badge variant="destructive" className="text-xs">Error</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewComparison} className="text-xs">
          New Comparison
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReviewPanel review={results?.reviewA} side="A" />
        <ReviewPanel review={results?.reviewB} side="B" />
      </div>

      {isComplete && results?.reviewA && results?.reviewB && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score difference:</span>
              <div className="flex items-center gap-3">
                <span className="text-blue-400 font-medium">
                  A: {((results.reviewA as any).scoresJson as any)?.overall?.toFixed(1) || "—"}
                </span>
                <span className="text-muted-foreground">vs</span>
                <span className="text-purple-400 font-medium">
                  B: {((results.reviewB as any).scoresJson as any)?.overall?.toFixed(1) || "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

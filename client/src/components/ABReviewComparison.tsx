import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare, ArrowRight, Star, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const FOCUS_OPTIONS = [
  { value: "full", label: "Full Review" },
  { value: "songwriter", label: "Songwriter" },
  { value: "producer", label: "Producer" },
  { value: "arranger", label: "Arranger" },
  { value: "artist", label: "Artist Development" },
  { value: "anr", label: "A&R Executive" },
] as const;

type FocusType = "songwriter" | "producer" | "arranger" | "artist" | "anr" | "full";

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 8 ? "text-emerald-400" : score >= 6 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{score.toFixed(1)}</span>
    </div>
  );
}

function ReviewPanel({ review, side, focus }: { review: any; side: "A" | "B"; focus: string }) {
  const [expanded, setExpanded] = useState(true);
  const scores = review?.scoresJson as any;
  const focusLabel = FOCUS_OPTIONS.find(f => f.value === focus)?.label || focus;
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

export function ABReviewComparison({ trackId }: { trackId: number }) {
  const [focusA, setFocusA] = useState<FocusType>("songwriter");
  const [focusB, setFocusB] = useState<FocusType>("producer");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isSetup, setIsSetup] = useState(true);

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

  // Stop polling when complete
  useEffect(() => {
    if (resultsQuery.data?.status === "complete" || resultsQuery.data?.status === "error") {
      // Query will stop refetching since we don't need to poll anymore
    }
  }, [resultsQuery.data?.status]);

  const handleGenerate = () => {
    if (focusA === focusB) {
      toast.error("Select different perspectives for A and B to get a meaningful comparison");
      return;
    }
    generateMutation.mutate({ trackId, focusA, focusB });
  };

  const handleNewComparison = () => {
    setActiveBatchId(null);
    setIsSetup(true);
  };

  if (isSetup) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            A/B Review Comparison
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Generate two reviews from different perspectives side-by-side to see how different personas critique the same track.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Badge variant="outline" className="bg-blue-500/20 text-blue-400 text-[10px] px-1">A</Badge>
                Perspective
              </label>
              <Select value={focusA} onValueChange={(v) => setFocusA(v as FocusType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pb-1">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Badge variant="outline" className="bg-purple-500/20 text-purple-400 text-[10px] px-1">B</Badge>
                Perspective
              </label>
              <Select value={focusB} onValueChange={(v) => setFocusB(v as FocusType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
        </CardContent>
      </Card>
    );
  }

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
        <ReviewPanel review={results?.reviewA} side="A" focus={focusA} />
        <ReviewPanel review={results?.reviewB} side="B" focus={focusB} />
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

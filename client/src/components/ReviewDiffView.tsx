import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Minus, GitCompare, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Streamdown } from "streamdown";
import { scoreColor } from "@/lib/scoreColor";

const scoreLabels: Record<string, string> = {
  production: "Production Quality",
  songwriting: "Songwriting",
  melody: "Melody & Hooks",
  performance: "Performance",
  mixQuality: "Mix Quality",
  arrangement: "Arrangement",
  originality: "Originality",
  commercialPotential: "Commercial Potential",
  lyricalContent: "Lyrical Content",
  emotionalImpact: "Emotional Impact",
  overall: "Overall",
  structure: "Structure",
  commercial: "Commercial Potential",
  lyrics: "Lyrics",
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-0.5 text-xs">
        <ArrowUp className="h-3 w-3" />+{delta.toFixed(1)}
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-0.5 text-xs">
        <ArrowDown className="h-3 w-3" />{delta.toFixed(1)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-0.5 text-xs">
      <Minus className="h-3 w-3" />0
    </Badge>
  );
}

interface ReviewDiffViewProps {
  reviewIdA: number;
  reviewIdB: number;
  onClose?: () => void;
}

export function ReviewDiffView({ reviewIdA, reviewIdB, onClose }: ReviewDiffViewProps) {
  const { data: diff, isLoading, error } = trpc.review.reviewDiff.useQuery(
    { reviewIdA, reviewIdB },
    { enabled: reviewIdA > 0 && reviewIdB > 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !diff) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-8 text-center text-muted-foreground">
          Could not load review comparison. Both reviews must exist and belong to you.
        </CardContent>
      </Card>
    );
  }

  const { reviewA, reviewB, scoreDeltas } = diff;
  const overallDelta = scoreDeltas.overall;
  const dimensionDeltas = Object.entries(scoreDeltas).filter(([k]) => k !== "overall");

  // Sort dimensions by absolute delta descending (biggest changes first)
  dimensionDeltas.sort(([, a], [, b]) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitCompare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Review Comparison
            </h2>
            <p className="text-sm text-muted-foreground">
              v{reviewA.reviewVersion ?? 1} vs v{reviewB.reviewVersion ?? 2}
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Score Comparison Table */}
      {Object.keys(scoreDeltas).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-primary" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Score Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Overall Score Hero */}
            {overallDelta && (
              <div className="flex items-center justify-center gap-8 mb-6 py-4 rounded-lg bg-secondary/30">
                <div className="text-center">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">v{reviewA.reviewVersion ?? 1}</span>
                  <span className={`text-3xl font-black tabular-nums ${scoreColor(overallDelta.old ?? 0)}`}>
                    {overallDelta.old ?? "—"}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Change</span>
                  <DeltaBadge delta={overallDelta.delta} />
                </div>
                <div className="text-center">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">v{reviewB.reviewVersion ?? 2}</span>
                  <span className={`text-3xl font-black tabular-nums ${scoreColor(overallDelta.new_ ?? 0)}`}>
                    {overallDelta.new_ ?? "—"}
                  </span>
                </div>
              </div>
            )}

            {/* Dimension Score Rows */}
            <div className="space-y-2">
              {dimensionDeltas.map(([key, d]) => {
                const label = scoreLabels[key] || key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20 transition-colors">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-mono tabular-nums ${scoreColor(d.old ?? 0)}`}>
                        {d.old ?? "—"}
                      </span>
                      <span className="text-muted-foreground/40">→</span>
                      <span className={`text-sm font-mono tabular-nums ${scoreColor(d.new_ ?? 0)}`}>
                        {d.new_ ?? "—"}
                      </span>
                      <DeltaBadge delta={d.delta} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Take Comparison */}
      {(reviewA.quickTake || reviewB.quickTake) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-primary" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Quick Take Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">v{reviewA.reviewVersion ?? 1} · {formatDistanceToNow(new Date(reviewA.createdAt), { addSuffix: true })}</Badge>
                <div className="prose prose-sm prose-invert max-w-none p-3 rounded-lg bg-muted/20 border border-border/30">
                  <Streamdown>{reviewA.quickTake || "*No quick take*"}</Streamdown>
                </div>
              </div>
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20">v{reviewB.reviewVersion ?? 2} · {formatDistanceToNow(new Date(reviewB.createdAt), { addSuffix: true })}</Badge>
                <div className="prose prose-sm prose-invert max-w-none p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Streamdown>{reviewB.quickTake || "*No quick take*"}</Streamdown>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Side-by-Side Full Review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-primary" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Full Review Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs mb-2">v{reviewA.reviewVersion ?? 1}</Badge>
              <div className="prose prose-sm prose-invert max-w-none p-4 rounded-lg bg-muted/10 border border-border/30 max-h-[600px] overflow-y-auto">
                <Streamdown>{reviewA.reviewMarkdown}</Streamdown>
              </div>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs mb-2 bg-primary/5 border-primary/20">v{reviewB.reviewVersion ?? 2}</Badge>
              <div className="prose prose-sm prose-invert max-w-none p-4 rounded-lg bg-primary/5 border border-primary/20 max-h-[600px] overflow-y-auto">
                <Streamdown>{reviewB.reviewMarkdown}</Streamdown>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Heart, ChevronDown, ChevronUp, Smile, Meh, Frown } from "lucide-react";
import { scoreColor } from "@/lib/scoreColor";
import { formatDistanceToNow } from "date-fns";

const sentimentConfig = {
  positive: { icon: Smile, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-500/20", label: "Positive" },
  mixed: { icon: Meh, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-500/20", label: "Mixed" },
  critical: { icon: Frown, color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-500/20", label: "Critical" },
};

export function SentimentTimeline({ projectId }: { projectId: number }) {
  const { data, isLoading } = trpc.sentiment.timeline.useQuery({ projectId });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Compute summary
  const posCount = data.filter(d => d.sentiment === "positive").length;
  const mixCount = data.filter(d => d.sentiment === "mixed").length;
  const critCount = data.filter(d => d.sentiment === "critical").length;
  const avgScore = data.reduce((sum, d) => sum + d.overall, 0) / data.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          Sentiment Timeline
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Emotional arc across {data.length} review{data.length !== 1 ? "s" : ""} — avg {avgScore.toFixed(1)}/10
        </p>
      </CardHeader>
      <CardContent>
        {/* Summary bar */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/30">
          <div className="flex items-center gap-1.5">
            <Smile className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">{posCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Meh className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">{mixCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Frown className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-xs text-rose-400 font-medium">{critCount}</span>
          </div>
          {/* Visual bar */}
          <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-muted/20">
            {posCount > 0 && <div className="bg-emerald-400 h-full" style={{ width: `${(posCount / data.length) * 100}%` }} />}
            {mixCount > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(mixCount / data.length) * 100}%` }} />}
            {critCount > 0 && <div className="bg-rose-400 h-full" style={{ width: `${(critCount / data.length) * 100}%` }} />}
          </div>
        </div>

        {/* Timeline items */}
        <div className="space-y-2">
          {data.map((item, idx) => {
            const config = sentimentConfig[item.sentiment];
            const Icon = config.icon;
            const isExpanded = expandedId === item.reviewId;

            return (
              <div key={item.reviewId} className="relative">
                {/* Timeline connector */}
                {idx < data.length - 1 && (
                  <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border/30" />
                )}

                <div className={`rounded-lg border ${config.border} ${config.bg} p-3 transition-all`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded-full ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.trackName}</span>
                        <Badge variant="secondary" className={`text-[10px] ${config.bg} ${config.color} border-none`}>
                          {config.label}
                        </Badge>
                        <span className={`text-sm font-bold ${scoreColor(item.overall)}`}>
                          {item.overall}/10
                        </span>
                      </div>
                      {item.quickTake && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.quickTake}</p>
                      )}

                      {/* Key phrases */}
                      {item.keyPhrases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.keyPhrases.map((phrase, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/50 text-muted-foreground border border-border/30">
                              {phrase}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expandable full quick take */}
                      {item.quickTake && item.quickTake.length > 100 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs mt-1 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => setExpandedId(isExpanded ? null : item.reviewId)}
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                          {isExpanded ? "Less" : "More"}
                        </Button>
                      )}
                      {isExpanded && item.quickTake && (
                        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{item.quickTake}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

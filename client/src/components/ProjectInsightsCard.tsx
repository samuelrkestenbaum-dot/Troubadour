import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Lightbulb, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { Streamdown } from "streamdown";

interface ProjectInsightsCardProps {
  projectId: number;
  reviewedTrackCount: number;
}

export function ProjectInsightsCard({ projectId, reviewedTrackCount }: ProjectInsightsCardProps) {
  const [generating, setGenerating] = useState(false);
  const utils = trpc.useUtils();

  const { data: insights, isLoading } = trpc.insights.get.useQuery(
    { projectId },
    { enabled: reviewedTrackCount >= 2 }
  );

  const generateMutation = trpc.insights.generate.useMutation({
    onMutate: () => setGenerating(true),
    onSuccess: () => {
      utils.insights.get.invalidate({ projectId });
      toast.success("Project insights generated!");
      setGenerating(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setGenerating(false);
    },
  });

  if (reviewedTrackCount < 2) return null;

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card className="border-dashed border-amber-500/30 bg-card/30">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
          <Sparkles className="h-8 w-8 text-amber-400" />
          <p className="text-muted-foreground text-sm text-center">
            Generate AI-powered insights across all {reviewedTrackCount} reviewed tracks
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate({ projectId })}
            disabled={generating}
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Generate Insights</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const strengths = (insights.strengthsJson as string[]) || [];
  const weaknesses = (insights.weaknessesJson as string[]) || [];
  const recommendations = (insights.recommendationsJson as string[]) || [];

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-400" />
          Project Insights
          <Badge variant="outline" className="text-xs ml-2">
            {insights.trackCount} tracks analyzed
          </Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => generateMutation.mutate({ projectId })}
          disabled={generating}
          title="Regenerate insights"
          className="h-8 w-8"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="text-sm text-muted-foreground leading-relaxed prose prose-invert prose-sm max-w-none">
          <Streamdown>{insights.summaryMarkdown}</Streamdown>
        </div>

        {/* Strengths, Weaknesses, Recommendations grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5" /> Strengths
              </h4>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <h4 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3.5 w-3.5" /> Areas to Improve
              </h4>
              <ul className="space-y-1.5">
                {weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
              <h4 className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5" /> Recommendations
              </h4>
              <ul className="space-y-1.5">
                {recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

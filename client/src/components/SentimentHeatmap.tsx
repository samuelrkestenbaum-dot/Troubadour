import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Flame, TrendingUp, TrendingDown, Minus, Loader2, ThermometerSun, Info } from "lucide-react";

interface SentimentSection {
  name: string;
  sentiment: number;
  summary: string;
  keywords: string[];
  mentionCount: number;
}

interface SentimentData {
  sections: SentimentSection[];
  strongestPositive: { section: string; aspect: string };
  strongestNegative: { section: string; aspect: string };
  overallTrend: string;
}

function sentimentColor(score: number): string {
  if (score >= 0.6) return "bg-emerald-500";
  if (score >= 0.3) return "bg-emerald-400/80";
  if (score >= 0.1) return "bg-sky-400/70";
  if (score >= -0.1) return "bg-slate-400/60";
  if (score >= -0.3) return "bg-amber-400/80";
  if (score >= -0.6) return "bg-orange-500/80";
  return "bg-red-500";
}

function sentimentTextColor(score: number): string {
  if (score >= 0.3) return "text-emerald-400";
  if (score >= -0.3) return "text-slate-400";
  return "text-red-400";
}

function sentimentLabel(score: number): string {
  if (score >= 0.6) return "Very Positive";
  if (score >= 0.3) return "Positive";
  if (score >= 0.1) return "Slightly Positive";
  if (score >= -0.1) return "Neutral";
  if (score >= -0.3) return "Slightly Negative";
  if (score >= -0.6) return "Negative";
  return "Very Negative";
}

function SentimentBar({ score }: { score: number }) {
  // Map -1..1 to 0..100
  const pct = Math.round((score + 1) * 50);
  return (
    <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${sentimentColor(score)}`}
        style={{ width: `${pct}%` }}
      />
      {/* Center line marker */}
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/20" />
    </div>
  );
}

export function SentimentHeatmap({ trackId }: { trackId: number }) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [expanded, setExpanded] = useState(false);

  const generateMutation = trpc.sentimentHeatmap.generate.useMutation({
    onSuccess: (result) => {
      setData(result as SentimentData);
      setExpanded(true);
      toast.success("Sentiment analysis complete");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    generateMutation.mutate({ trackId });
  };

  if (!data && !generateMutation.isPending) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThermometerSun className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sentiment Heatmap</span>
              <span className="text-xs text-muted-foreground">Analyze feedback sentiment across song sections</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerate}>
              <Flame className="h-3.5 w-3.5 mr-1" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (generateMutation.isPending) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing sentiment across review sections...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ThermometerSun className="h-4 w-4" />
            Sentiment Heatmap
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Collapse" : "Expand"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generateMutation.isPending}>
              <Flame className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Heatmap Grid */}
        <div className="grid gap-2">
          {data.sections.map((section, i) => (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="space-y-1 cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-28 truncate">{section.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {section.mentionCount} mention{section.mentionCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-semibold ${sentimentTextColor(section.sentiment)}`}>
                          {section.sentiment > 0 ? "+" : ""}{section.sentiment.toFixed(2)}
                        </span>
                        {section.sentiment > 0.1 ? (
                          <TrendingUp className="h-3 w-3 text-emerald-400" />
                        ) : section.sentiment < -0.1 ? (
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        ) : (
                          <Minus className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                    </div>
                    <SentimentBar score={section.sentiment} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-semibold">{section.name} — {sentimentLabel(section.sentiment)}</p>
                  <p className="text-xs mt-1">{section.summary}</p>
                  {section.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {section.keywords.map((kw, j) => (
                        <Badge key={j} variant="secondary" className="text-[10px]">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Strongest positive/negative */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  Strongest Positive
                </div>
                <p className="text-sm font-medium">{data.strongestPositive.section}</p>
                <p className="text-xs text-muted-foreground">{data.strongestPositive.aspect}</p>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <TrendingDown className="h-3 w-3" />
                  Needs Most Work
                </div>
                <p className="text-sm font-medium">{data.strongestNegative.section}</p>
                <p className="text-xs text-muted-foreground">{data.strongestNegative.aspect}</p>
              </div>
            </div>

            {/* Overall trend */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="h-3 w-3" />
                Overall Trend
              </div>
              <p className="text-sm">{data.overallTrend}</p>
            </div>

            {/* Section detail cards */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Section Details</p>
              {data.sections.map((section, i) => (
                <div key={i} className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{section.name}</span>
                    <Badge variant={section.sentiment >= 0.3 ? "default" : section.sentiment <= -0.3 ? "destructive" : "secondary"} className="text-xs">
                      {sentimentLabel(section.sentiment)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{section.summary}</p>
                  {section.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {section.keywords.map((kw, j) => (
                        <Badge key={j} variant="outline" className="text-[10px]">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            Negative
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-slate-400/60" />
            Neutral
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            Positive
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Download, Copy, AlertCircle, BarChart3, Music, BookOpen, GitCompare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Streamdown } from "streamdown";

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
};

const scoreColor = (score: number) => {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
};

export default function ReviewView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { data: review, isLoading, error } = trpc.review.get.useQuery({ id });

  const handleExport = () => {
    if (!review) return;
    const blob = new Blob([review.reviewMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-${review.id}-${review.reviewType}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Review exported");
  };

  const handleCopy = () => {
    if (!review) return;
    navigator.clipboard.writeText(review.reviewMarkdown);
    toast.success("Review copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-muted-foreground">Review not found</p>
      </div>
    );
  }

  const scores = review.scoresJson as Record<string, number> | null;
  const reviewTypeIcon = review.reviewType === "album" ? BookOpen
    : review.reviewType === "comparison" ? GitCompare
    : BarChart3;
  const ReviewIcon = reviewTypeIcon;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            if (review.trackId) setLocation(`/tracks/${review.trackId}`);
            else setLocation(`/projects/${review.projectId}`);
          }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <ReviewIcon className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight capitalize">
                {review.reviewType === "album" ? "Album A&R Memo" : review.reviewType === "comparison" ? "Version Comparison" : "Track Review"}
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline">{review.modelUsed}</Badge>
              <span>{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Take */}
      {review.quickTake && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-primary mb-1">Quick Take</p>
            <p className="text-sm text-foreground leading-relaxed">{review.quickTake}</p>
          </CardContent>
        </Card>
      )}

      {/* Scores */}
      {scores && Object.keys(scores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(scores).map(([key, value]) => {
                const label = scoreLabels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                const numValue = typeof value === "number" ? value : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
                    <Progress value={numValue * 10} className="h-2 flex-1" />
                    <span className={`text-sm font-semibold w-8 text-right ${scoreColor(numValue)}`}>
                      {numValue}
                    </span>
                  </div>
                );
              })}
            </div>
            {scores.overall !== undefined && (
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                <span className="font-semibold">Overall Score</span>
                <span className={`text-3xl font-bold ${scoreColor(scores.overall)}`}>
                  {scores.overall}<span className="text-lg text-muted-foreground">/10</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Full Review */}
      <Card>
        <CardContent className="py-6">
          <div className="prose prose-sm prose-invert max-w-none">
            <Streamdown>{review.reviewMarkdown}</Streamdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

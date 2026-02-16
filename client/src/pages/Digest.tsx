import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Music, Star,
  ArrowRight, FileText, Zap, Clock, Mail, Loader2, ExternalLink
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-sky-400";
  if (score >= 4) return "text-amber-400";
  return "text-rose-400";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 6) return "bg-sky-500/10 border-sky-500/20";
  if (score >= 4) return "bg-amber-500/10 border-amber-500/20";
  return "bg-rose-500/10 border-rose-500/20";
}

export default function Digest() {
  const [, setLocation] = useLocation();
  const [daysBack, setDaysBack] = useState(7);
  const [emailPreview, setEmailPreview] = useState<string | null>(null);

  const { data, isLoading } = trpc.digest.get.useQuery({ daysBack });

  const generateEmail = trpc.digest.generateEmail.useMutation({
    onSuccess: (result) => {
      setEmailPreview(result.htmlContent);
      toast.success("Digest email generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const periodLabel = daysBack === 7 ? "This Week" : daysBack === 14 ? "Last 2 Weeks" : "Last 30 Days";

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stats = data?.stats;
  const reviews = data?.reviews ?? [];
  const newProjects = data?.newProjects ?? [];
  const isEmpty = reviews.length === 0 && newProjects.length === 0;

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
          >
            Review Digest
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your music review activity summary
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateEmail.mutate({ daysBack })}
            disabled={generateEmail.isPending || isEmpty}
            title="Generate a shareable email digest of your review activity"
          >
            {generateEmail.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5 mr-1.5" />
            )}
            Email Digest
          </Button>
          <Select value={String(daysBack)} onValueChange={(v) => { setDaysBack(Number(v)); setEmailPreview(null); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">This Week</SelectItem>
              <SelectItem value="14">Last 2 Weeks</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {emailPreview && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Digest Email Preview
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const win = window.open("", "_blank");
                    if (win) { win.document.write(emailPreview); win.document.close(); }
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open in Tab
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(emailPreview);
                    toast.success("HTML copied to clipboard");
                  }}
                >
                  Copy HTML
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEmailPreview(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <CardDescription>Copy the HTML or open in a new tab to preview the email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg overflow-hidden border border-border/50">
              <iframe
                srcDoc={emailPreview}
                className="w-full h-[500px] bg-white"
                title="Digest Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No activity in this period</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Upload some tracks and run reviews to see your digest here.
            </p>
            <Button onClick={() => setLocation("/projects/new")}>
              <Zap className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalReviews ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Reviews completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Star className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${stats?.averageScore ? scoreColor(stats.averageScore) : ""}`}>
                      {stats?.averageScore ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Average score</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10">
                    <Music className="h-5 w-5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalNewProjects ?? 0}</p>
                    <p className="text-xs text-muted-foreground">New projects</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Highlights */}
          {(stats?.highestScore || stats?.lowestScore) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats?.highestScore && (
                <Card className={`border ${scoreBg(stats.highestScore.score)}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-muted-foreground">Top Performer</p>
                        <p className="font-semibold truncate">{stats.highestScore.track}</p>
                        <p className={`text-xl font-bold ${scoreColor(stats.highestScore.score)}`}>
                          {stats.highestScore.score}/10
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {stats?.lowestScore && stats.lowestScore.score < 10 && (
                <Card className={`border ${scoreBg(stats.lowestScore.score)}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <TrendingDown className="h-5 w-5 text-amber-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-muted-foreground">Needs Attention</p>
                        <p className="font-semibold truncate">{stats.lowestScore.track}</p>
                        <p className={`text-xl font-bold ${scoreColor(stats.lowestScore.score)}`}>
                          {stats.lowestScore.score}/10
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Recent Reviews */}
          <div>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Recent Reviews ({reviews.length})
            </h2>
            <div className="space-y-2">
              {reviews.slice(0, 20).map((review) => {
                let overallScore: number | null = null;
                try {
                  const scores = typeof review.scoresJson === "string"
                    ? JSON.parse(review.scoresJson as string)
                    : review.scoresJson;
                  overallScore = scores?.overall ?? scores?.overallScore ?? null;
                } catch {}

                return (
                  <Card
                    key={review.id}
                    className="hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/reviews/${review.id}`)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <Music className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {review.trackFilename}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {review.projectTitle}
                          </p>
                        </div>
                        {overallScore !== null && (
                          <span className={`text-lg font-bold tabular-nums shrink-0 ${scoreColor(overallScore)}`}>
                            {overallScore}
                          </span>
                        )}
                        {review.quickTake && (
                          <p className="text-xs text-muted-foreground max-w-[200px] truncate hidden lg:block">
                            {review.quickTake}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground/60 shrink-0">
                          {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }) : ""}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* New Projects */}
          {newProjects.length > 0 && (
            <div>
              <h2
                className="text-lg font-semibold mb-4"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
              >
                New Projects ({newProjects.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {newProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-primary/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{project.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.createdAt ? format(new Date(project.createdAt), "MMM d, yyyy") : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {project.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

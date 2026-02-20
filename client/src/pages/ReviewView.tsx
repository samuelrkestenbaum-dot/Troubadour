import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { RadarChart } from "@/components/RadarChart";
import {
  ArrowLeft, Download, Copy, AlertCircle, BarChart3, Music, BookOpen, GitCompare,
  MessageCircle, Send, Loader2, ChevronDown, ChevronUp, Share2, Check, Lock, RefreshCw, Settings2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AudioPlayer } from "@/components/AudioPlayer";
import { formatDistanceToNow } from "date-fns";
import { Streamdown } from "streamdown";
import { trackExportUsed, trackShareLinkCreated, trackFeatureGated } from "@/lib/analytics";
import { scoreColor } from "@/lib/scoreColor";
import { ReviewQualityBadge } from "@/components/ReviewQualityBadge";
import { CollapsibleReview } from "@/components/CollapsibleReview";
import { ReviewActionTabs } from "@/components/ReviewActionTabs";
import { TemplateSelector } from "@/components/TemplateSelector";
import { ReviewDiffView } from "@/components/ReviewDiffView";
import { ReviewComments } from "@/components/ReviewComments";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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

const scoreBgGlow = (score: number) => {
  if (score >= 8) return "shadow-emerald-400/20";
  if (score >= 6) return "shadow-sky-400/20";
  if (score >= 4) return "shadow-amber-400/20";
  return "shadow-rose-400/20";
};

function ConversationPanel({ reviewId, userTier }: { reviewId: number; userTier: string }) {
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isChatGated = userTier === "free";

  const { data: messages, refetch } = trpc.conversation.list.useQuery(
    { reviewId },
    { enabled: isOpen && !isChatGated }
  );

  const [, navigate] = useLocation();

  const sendMutation = trpc.conversation.send.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        toast("Chat requires the Artist plan", {
          description: "Upgrade to ask follow-up questions about your reviews.",
          action: {
            label: "View Plans",
            onClick: () => navigate("/pricing"),
          },
        });
      } else {
        toast.error(err.message || "Failed to send message");
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ reviewId, message: message.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What did you mean by the production notes?",
    "How does this compare to similar tracks in the genre?",
    "What would you prioritize fixing first?",
    "Can you elaborate on the arrangement feedback?",
    "What reference tracks should I study?",
  ];

  return (
    <Card className="border-primary/20">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Ask About This Review</CardTitle>
            {messages && messages.length > 0 && (
              <Badge variant="secondary" className="text-xs">{messages.length} messages</Badge>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="pt-0 px-4 pb-4">
          {isChatGated ? (
            <div className="text-center py-8">
              <Lock className="h-8 w-8 text-amber-400/50 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Chat requires the Artist plan</p>
              <p className="text-xs text-muted-foreground mb-4">
                Upgrade to ask follow-up questions about your reviews and get deeper insights.
              </p>
              <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => navigate("/pricing")}>
                View Plans
              </Button>
            </div>
          ) : (
          <>
          <div
            ref={scrollRef}
            className="space-y-3 max-h-96 overflow-y-auto mb-4 pr-1"
          >
            {(!messages || messages.length === 0) && !sendMutation.isPending && (
              <div className="text-center py-6">
                <MessageCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Ask follow-up questions about this review
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.slice(0, 3).map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-1.5 px-3"
                      onClick={() => {
                        setMessage(q);
                        inputRef.current?.focus();
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border/50"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
              rows={1}
              disabled={sendMutation.isPending}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
              className="shrink-0"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** Strip Quick Take, Scores table, and opening paragraph from the full review markdown */
function stripDuplicateSections(markdown: string): string {
  let cleaned = markdown;
  // Find first heading (## or ###)
  const firstHeading = cleaned.search(/^#{2,3}\s/m);
  if (firstHeading > 50) {
    cleaned = cleaned.substring(firstHeading);
  }
  // Strip Quick Take section (already shown separately above)
  cleaned = cleaned.replace(/#{2,3}\s*\*?\*?Quick Take\*?\*?\s*\n[\s\S]*?(?=\n#{2,3}\s|$)/i, '');
  // Strip Scores section (already shown as radar chart + bars above)
  cleaned = cleaned.replace(/#{2,3}\s*\*?\*?Scores\*?\*?\s*\n[\s\S]*?(?=\n#{2,3}\s(?!.*Score)|$)/i, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

function ReviewAudioPlayer({ trackId }: { trackId: number }) {
  const { data: trackData } = trpc.track.get.useQuery({ id: trackId });
  if (!trackData) return null;
  return (
    <AudioPlayer
      src={trackData.track.storageUrl}
      title={trackData.track.originalFilename}
      subtitle={trackData.track.detectedGenre || undefined}
      compact
    />
  );
}

export default function ReviewView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { data: review, isLoading, error } = trpc.review.get.useQuery({ id });
  const { setContext } = useChat();
  const { user } = useAuth();
  const userTier = user?.tier || "free";

  useEffect(() => {
    if (review?.trackId) {
      setContext({ trackId: review.trackId });
    } else if (review?.projectId) {
      setContext({ projectId: review.projectId, trackId: null });
    }
  }, [review, setContext]);

  const exportQuery = trpc.review.exportMarkdown.useQuery(
    { id },
    { enabled: false }
  );

  const handleExport = async () => {
    if (!review) return;
    // Check if export is gated for this tier
    if (userTier === "free" || userTier === "artist") {
      trackFeatureGated("export_markdown", userTier);
      toast("Export requires the Pro plan", {
        description: "Upgrade to export reviews as Markdown files.",
        action: {
          label: "View Plans",
          onClick: () => setLocation("/pricing"),
        },
      });
      return;
    }
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const blob = new Blob([result.data.markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        a.click();
        URL.revokeObjectURL(url);
        trackExportUsed(review.id, "markdown");
        toast.success("Review exported as Markdown");
      }
    } catch {
      // Fallback to basic export
      const blob = new Blob([review.reviewMarkdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `review-${review.id}-${review.reviewType}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Review exported (basic format)", {
        description: "Exported raw review content without additional metadata.",
      });
    }
  };

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareMut = trpc.review.generateShareLink.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/shared/${data.shareToken}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url);
      trackShareLinkCreated(id);
      toast.success("Share link copied to clipboard!");
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        toast("Sharing requires the Artist plan", {
          description: "Upgrade to generate shareable review links.",
          action: {
            label: "View Plans",
            onClick: () => setLocation("/pricing"),
          },
        });
      } else {
        toast.error(err.message);
      }
    },
  });

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!review) return;
    const scores = review.scoresJson as Record<string, number> | null;
    const overallScore = scores?.overall ?? scores?.production;
    const genre = review.genreInsight?.detectedGenre;
    const date = new Date(review.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Build a rich markdown header
    const lines: string[] = [];
    const typeLabel = review.reviewType === "album" ? "Album A&R Memo" : review.reviewType === "comparison" ? "Version Comparison" : "Track Review";
    lines.push(`# ${typeLabel}`);
    lines.push("");
    if (overallScore) lines.push(`**Overall Score:** ${overallScore}/10`);
    if (genre) lines.push(`**Genre:** ${genre}`);
    lines.push(`**Date:** ${date}`);
    lines.push(`**Model:** ${review.modelUsed}`);
    if (scores && Object.keys(scores).length > 1) {
      lines.push("");
      lines.push("| Category | Score |");
      lines.push("| --- | --- |");
      for (const [key, val] of Object.entries(scores)) {
        if (key === "overall") continue;
        const label = scoreLabels[key] || key.replace(/([A-Z])/g, " $1").trim();
        lines.push(`| ${label} | ${val}/10 |`);
      }
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(review.reviewMarkdown);
    lines.push("");
    lines.push("---");
    lines.push("*Reviewed by [Troubadour](https://troubadour.manus.space) — AI-powered music critique*");

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Review copied as formatted Markdown");
    setTimeout(() => setCopied(false), 2000);
  };

  const [reReviewTemplateId, setReReviewTemplateId] = useState<number | null>(null);
  const [reReviewLength, setReReviewLength] = useState<"brief" | "standard" | "detailed">("standard");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffReviewId, setDiffReviewId] = useState<number | null>(null);


  const reReviewMut = trpc.job.reReview.useMutation({
    onSuccess: () => {
      toast.success("Re-review queued", {
        description: "A fresh review is being generated with the latest format. Check back shortly.",
      });
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN" || err.message?.includes("limit")) {
        toast("Usage limit reached", {
          description: err.message,
          action: {
            label: "View Plans",
            onClick: () => setLocation("/pricing"),
          },
        });
      } else {
        toast.error(err.message || "Failed to queue re-review");
      }
    },
  });

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

  // Separate overall from dimension scores
  const overallScore = scores?.overall;
  const dimensionScores = scores
    ? Object.fromEntries(Object.entries(scores).filter(([k]) => k !== "overall"))
    : null;
  const dimensionCount = dimensionScores ? Object.keys(dimensionScores).length : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
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
              <h1 className="text-2xl font-bold tracking-tight capitalize" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                {review.reviewType === "album" ? "Album A&R Memo" : review.reviewType === "comparison" ? "Version Comparison" : "Track Review"}
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline">Troubadour</Badge>
              {review.reviewVersion && review.reviewVersion > 1 && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                  Re-review v{review.reviewVersion}
                </Badge>
              )}
              {review.reviewVersion === 1 && (
                <Badge variant="secondary" className="text-xs">v1</Badge>
              )}
              <span>{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</span>
            </div>
            <div className="mt-2">
              <ReviewQualityBadge reviewId={review.id} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            {userTier !== "pro" ? (
              <Lock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            Export .md
          </Button>
          <Button
            variant={shareUrl ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (shareUrl) {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Link copied again!");
              } else {
                shareMut.mutate({ id });
              }
            }}
            disabled={shareMut.isPending}
          >
            {shareMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : shareUrl ? (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            ) : userTier === "free" ? (
              <Lock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            ) : (
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {shareUrl ? "Link Copied" : "Share"}
          </Button>
          {review.trackId && review.reviewType === "track" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={reReviewMut.isPending}>
                  {reReviewMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Re-review
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Re-review this track?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Generate a fresh review using the latest critique format. Pick a template and review depth below. Your current review won't be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Review Template</label>
                    <TemplateSelector
                      value={reReviewTemplateId}
                      onChange={setReReviewTemplateId}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">Choose a persona to shape the AI's critique style.</p>
                  </div>

                  {/* Smart Review Length Override — Round 97 */}
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Settings2 className="h-3 w-3" />
                    <span>Advanced options</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                  </button>

                  {showAdvancedOptions && (
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      <label className="text-sm font-medium text-foreground">Review Depth</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: "brief" as const, label: "Brief", desc: "Quick take, key points only" },
                          { value: "standard" as const, label: "Standard", desc: "Balanced analysis" },
                          { value: "detailed" as const, label: "Detailed", desc: "Deep dive, every dimension" },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setReReviewLength(opt.value)}
                            className={`p-2 rounded-md border text-left transition-all ${
                              reReviewLength === opt.value
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-muted-foreground/30"
                            }`}
                          >
                            <div className="text-xs font-medium">{opt.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Default is Standard. Brief saves time; Detailed gives exhaustive feedback.</p>
                    </div>
                  )}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => reReviewMut.mutate({
                    trackId: review.trackId!,
                    ...(reReviewTemplateId ? { templateId: reReviewTemplateId } : {}),
                    ...(reReviewLength !== "standard" ? { reviewLength: reReviewLength } : {}),
                  })}>
                    Generate New Review
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Inline Audio Player — listen while reading */}
      {review.trackId && <ReviewAudioPlayer trackId={review.trackId} />}

      {/* Genre Insight */}
      {review.genreInsight?.detectedGenre && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground italic">We hear:</span>
          <Badge variant="secondary" className="font-normal">
            {review.genreInsight.detectedGenre}
          </Badge>
          {review.genreInsight.detectedSubgenres && review.genreInsight.detectedSubgenres.split(", ").filter(Boolean).map((sub: string) => (
            <Badge key={sub} variant="outline" className="font-normal text-xs">
              {sub}
            </Badge>
          ))}
          {review.genreInsight.detectedInfluences && (
            <span className="text-xs text-muted-foreground ml-1 italic">
              touches of {review.genreInsight.detectedInfluences}
            </span>
          )}
        </div>
      )}

      {/* Quick Take */}
      {review.quickTake && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-primary mb-2">Quick Take</p>
            <div className="prose prose-sm prose-invert max-w-none text-foreground">
              <Streamdown>{review.quickTake}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scores Section — Overall + Radar + Breakdown */}
      {scores && Object.keys(scores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Overall Score Hero */}
            {overallScore !== undefined && (
              <div className="flex items-center justify-center mb-6">
                <div className={`flex flex-col items-center p-6 rounded-2xl bg-secondary/50 shadow-lg ${scoreBgGlow(overallScore)}`}>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Overall</span>
                  <span className={`text-5xl font-black tabular-nums ${scoreColor(overallScore)}`}>
                    {overallScore}
                  </span>
                  <span className="text-sm text-muted-foreground mt-0.5">out of 10</span>
                </div>
              </div>
            )}

            {/* Radar Chart + Score List side by side on larger screens */}
            {dimensionScores && dimensionCount > 0 && (
              <div className={`${dimensionCount >= 3 ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-start" : ""}`}>
                {/* Radar Chart — only show if 3+ dimensions */}
                {dimensionCount >= 3 && (
                  <div className="flex justify-center">
                    <RadarChart scores={dimensionScores} />
                  </div>
                )}

                {/* Score Bars */}
                <div className="space-y-3">
                  {Object.entries(dimensionScores)
                    .sort(([, a], [, b]) => (typeof b === "number" ? b : 0) - (typeof a === "number" ? a : 0))
                    .map(([key, value]) => {
                      const label = scoreLabels[key] || key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                      const numValue = typeof value === "number" ? value : 0;
                      return (
                        <div key={key} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                            <span className={`text-sm font-bold tabular-nums ${scoreColor(numValue)}`}>
                              {numValue}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                numValue >= 8 ? "bg-emerald-400/80" :
                                numValue >= 6 ? "bg-sky-400/80" :
                                numValue >= 4 ? "bg-amber-400/80" :
                                "bg-rose-400/80"
                              }`}
                              style={{ width: `${(numValue / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Version History */}
      {review.trackId && review.reviewType === "track" && (
        <ReviewVersionHistory
          trackId={review.trackId}
          currentReviewId={review.id}
          onCompare={(otherId) => {
            setDiffReviewId(otherId);
            setShowDiff(true);
          }}
        />
      )}

      {/* Diff View */}
      {showDiff && diffReviewId && (
        <ReviewDiffView
          reviewIdA={diffReviewId}
          reviewIdB={review.id}
          onClose={() => { setShowDiff(false); setDiffReviewId(null); }}
        />
      )}

      <Separator />

      {/* Review Content with Action Mode Tabs */}
      {review.reviewType === "track" ? (
        <ReviewActionTabs
          reviewId={review.id}
          reviewMarkdown={review.reviewMarkdown}
          stripDuplicateSections={stripDuplicateSections}
        />
      ) : (
        <Card>
          <CardContent className="py-6">
            <CollapsibleReview markdown={stripDuplicateSections(review.reviewMarkdown)} />
          </CardContent>
        </Card>
      )}

      {/* AI Disclaimer */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/30 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60" />
        <span>This review was generated by AI and may contain inaccuracies. Scores and feedback reflect algorithmic analysis, not human judgment. Use as a creative tool alongside your own musical instincts.</span>
      </div>

      {/* Review Comments */}
      <ReviewComments reviewId={review.id} canComment={true} />

      {/* Conversation Panel */}
      {review.reviewType === "track" && (
        <ConversationPanel reviewId={review.id} userTier={userTier} />
      )}
    </div>
  );
}

function ReviewVersionHistory({ trackId, currentReviewId, onCompare }: {
  trackId: number;
  currentReviewId: number;
  onCompare: (reviewId: number) => void;
}) {
  const { data: reviews } = trpc.review.listByTrack.useQuery({ trackId });
  const [, navigate] = useLocation();

  // Only show if there are multiple reviews
  const trackReviews = reviews?.filter(r => r.reviewType === "track") ?? [];
  if (trackReviews.length <= 1) return null;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 py-3">
        <CardTitle className="text-sm uppercase tracking-wider text-primary flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          <GitCompare className="h-4 w-4" />
          Review History ({trackReviews.length} versions)
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-1.5">
          {trackReviews.map((r) => {
            const isCurrent = r.id === currentReviewId;
            const scores = r.scoresJson as Record<string, number> | null;
            const overall = scores?.overall;
            return (
              <div
                key={r.id}
                className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                  isCurrent ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge variant={isCurrent ? "default" : "outline"} className="text-xs">
                    v{r.reviewVersion ?? 1}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </span>
                  {overall !== undefined && (
                    <span className={`text-sm font-bold tabular-nums ${scoreColor(overall)}`}>
                      {overall}/10
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-xs text-primary font-medium">Current</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isCurrent && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onCompare(r.id)}
                      >
                        <GitCompare className="h-3 w-3 mr-1" />
                        Compare
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/reviews/${r.id}`)}
                      >
                        View
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

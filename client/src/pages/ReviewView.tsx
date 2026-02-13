import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import {
  ArrowLeft, Download, Copy, AlertCircle, BarChart3, Music, BookOpen, GitCompare,
  MessageCircle, Send, Loader2, ChevronDown, ChevronUp
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
  structure: "Structure",
  commercial: "Commercial Potential",
  lyrics: "Lyrics",
};

const scoreColor = (score: number) => {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
};

function ConversationPanel({ reviewId }: { reviewId: number }) {
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages, refetch } = trpc.conversation.list.useQuery(
    { reviewId },
    { enabled: isOpen }
  );

  const sendMutation = trpc.conversation.send.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
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
          {/* Messages */}
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

          {/* Input */}
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
        </CardContent>
      )}
    </Card>
  );
}

/** Strip Quick Take, Scores table, and opening paragraph (shown separately above) from the full review markdown */
function stripDuplicateSections(markdown: string): string {
  let cleaned = markdown;
  // Remove opening paragraph before first heading
  const firstHeading = cleaned.search(/^#{2,3}\s/m);
  if (firstHeading > 50) {
    cleaned = cleaned.substring(firstHeading);
  }
  // Remove Quick Take section
  cleaned = cleaned.replace(/#{2,3}\s*\*?\*?Quick Take\*?\*?\s*\n[\s\S]*?(?=\n#{2,3}\s|$)/i, '');
  // Remove Scores table section
  cleaned = cleaned.replace(/#{2,3}\s*\*?\*?Scores\*?\*?\s*\n[\s\S]*?(?=\n#{2,3}\s(?!.*Score)|$)/i, '');
  // Clean up multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

export default function ReviewView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { data: review, isLoading, error } = trpc.review.get.useQuery({ id });
  const { setContext } = useChat();

  useEffect(() => {
    if (review?.trackId) {
      setContext({ trackId: review.trackId });
    } else if (review?.projectId) {
      setContext({ projectId: review.projectId, trackId: null });
    }
  }, [review, setContext]);

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
              <Badge variant="outline">FirstSpin.ai</Badge>
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

      {/* Scores */}
      {scores && Object.keys(scores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(scores).map(([key, value]) => {
                const label = scoreLabels[key] || key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
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

      {/* Full Review - strip Quick Take and Scores sections since they're shown above */}
      <Card>
        <CardContent className="py-6">
          <div className="prose prose-sm prose-invert max-w-none">
            <Streamdown>{stripDuplicateSections(review.reviewMarkdown)}</Streamdown>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Panel - Ask follow-up questions */}
      {review.reviewType === "track" && (
        <ConversationPanel reviewId={review.id} />
      )}
    </div>
  );
}

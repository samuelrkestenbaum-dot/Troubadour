import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Shield, AlertTriangle, Clock } from "lucide-react";

function confidenceColor(c: number): string {
  if (c >= 80) return "text-emerald-500";
  if (c >= 50) return "text-amber-500";
  return "text-rose-500";
}

function confidenceLabel(c: number): string {
  if (c >= 80) return "High";
  if (c >= 50) return "Medium";
  return "Low";
}

function wordCountLabel(wc: number): string {
  if (wc >= 1200) return "Detailed";
  if (wc >= 600) return "Standard";
  if (wc >= 200) return "Brief";
  return "Minimal";
}

function freshnessLabel(createdAt: Date | string): string {
  const now = new Date();
  const d = new Date(createdAt);
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

interface ReviewQualityBadgeProps {
  reviewId: number;
  compact?: boolean;
}

export function ReviewQualityBadge({ reviewId, compact = false }: ReviewQualityBadgeProps) {
  const { data: quality } = trpc.reviewQuality.get.useQuery(
    { reviewId },
    { staleTime: 60000 }
  );

  if (!quality) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 cursor-default">
                <FileText className="h-3 w-3" />
                {quality.wordCount}w
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{quality.wordCount} words, {quality.sectionCount} sections</p>
              <p className="text-muted-foreground">{wordCountLabel(quality.wordCount)} review</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 cursor-default ${confidenceColor(quality.confidence)}`}>
                <Shield className="h-3 w-3" />
                {quality.confidence}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Confidence: {confidenceLabel(quality.confidence)} ({quality.confidence}%)</p>
              <p className="text-muted-foreground">Based on completeness of analysis</p>
            </TooltipContent>
          </Tooltip>

          {quality.isStale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 cursor-default text-amber-500 border-amber-500/30">
                  <AlertTriangle className="h-3 w-3" />
                  Stale
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Track updated since this review</p>
                <p className="text-muted-foreground">Consider re-reviewing for accuracy</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
              <FileText className="h-3.5 w-3.5" />
              <span>{quality.wordCount} words</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{quality.sectionCount} sections</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{wordCountLabel(quality.wordCount)} review ({quality.wordCount} words, {quality.sectionCount} sections)</p>
          </TooltipContent>
        </Tooltip>

        <span className="text-muted-foreground/30">|</span>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 text-xs cursor-default ${confidenceColor(quality.confidence)}`}>
              <Shield className="h-3.5 w-3.5" />
              <span>{confidenceLabel(quality.confidence)} confidence ({quality.confidence}%)</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Review completeness score</p>
            <p className="text-muted-foreground">
              {quality.scoreCount} score dimensions · {quality.hasQuickTake ? "Has" : "Missing"} quick take
            </p>
          </TooltipContent>
        </Tooltip>

        <span className="text-muted-foreground/30">|</span>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{freshnessLabel(quality.createdAt)}</span>
        </div>

        {quality.isStale && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-amber-500 cursor-default">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Stale — track updated</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>This track has been updated since the review was written.</p>
                <p className="text-muted-foreground">Consider running a new review for accuracy.</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

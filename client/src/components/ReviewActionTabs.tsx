import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { trackActionModeUsed, trackActionModeExported } from "@/lib/analytics";
import { Streamdown } from "streamdown";
import { CollapsibleReview } from "@/components/CollapsibleReview";

type ActionModeKey = "full-picture" | "session-prep" | "pitch-ready" | "rewrite-focus" | "remix-focus";

const ACTION_MODES: Record<ActionModeKey, { label: string; icon: string; description: string }> = {
  "full-picture": {
    label: "Full Review",
    icon: "📋",
    description: "Original comprehensive review",
  },
  "session-prep": {
    label: "Session Prep",
    icon: "🎛️",
    description: "Top actionable items for the studio",
  },
  "pitch-ready": {
    label: "Pitch Ready",
    icon: "📊",
    description: "Commercial readiness & pitch summary",
  },
  "rewrite-focus": {
    label: "Rewrite",
    icon: "✍️",
    description: "Songwriting deep dive & rewrite prompts",
  },
  "remix-focus": {
    label: "Remix",
    icon: "🔊",
    description: "Production & mix technical action items",
  },
};

interface ReviewActionTabsProps {
  reviewId: number;
  reviewMarkdown: string;
  stripDuplicateSections: (md: string) => string;
}

export function ReviewActionTabs({ reviewId, reviewMarkdown, stripDuplicateSections }: ReviewActionTabsProps) {
  const [activeTab, setActiveTab] = useState<ActionModeKey>("full-picture");
  const [loadingMode, setLoadingMode] = useState<ActionModeKey | null>(null);
  const [cachedResults, setCachedResults] = useState<Partial<Record<ActionModeKey, string>>>({});

  const actionModeMut = trpc.review.actionMode.useMutation({
    onSuccess: (data) => {
      setCachedResults((prev) => ({ ...prev, [data.mode]: data.content }));
      setLoadingMode(null);
    },
    onError: (err) => {
      setLoadingMode(null);
      toast.error(err.message || "Failed to reshape review");
    },
  });

  const handleTabChange = (mode: string) => {
    const key = mode as ActionModeKey;
    if (key === activeTab) return;
    trackActionModeUsed(reviewId, key);
    setActiveTab(key);

    if (key === "full-picture") return;

    // Already cached — no need to fetch
    if (cachedResults[key]) return;

    // Fetch from LLM
    setLoadingMode(key);
    actionModeMut.mutate({ reviewId, mode: key });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-muted/30 p-1">
        {(Object.entries(ACTION_MODES) as [ActionModeKey, typeof ACTION_MODES[ActionModeKey]][]).map(([key, mode]) => {
          const isLoading = loadingMode === key;
          const isCached = !!cachedResults[key];
          return (
            <TabsTrigger
              key={key}
              value={key}
              className="text-xs gap-1.5 data-[state=active]:bg-background relative"
            >
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {isCached && key !== "full-picture" && activeTab !== key && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="full-picture" className="mt-3">
        <Card>
          <CardContent className="py-6">
            <CollapsibleReview markdown={stripDuplicateSections(reviewMarkdown)} />
          </CardContent>
        </Card>
      </TabsContent>

      {(Object.entries(ACTION_MODES) as [ActionModeKey, typeof ACTION_MODES[ActionModeKey]][])
        .filter(([key]) => key !== "full-picture")
        .map(([key, mode]) => (
          <TabsContent key={key} value={key} className="mt-3">
            {loadingMode === key ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Reshaping review for {mode.label}...</p>
                </CardContent>
              </Card>
            ) : cachedResults[key] ? (
              <ReshapedContent content={cachedResults[key]!} mode={key} reviewId={reviewId} label={mode.label} description={mode.description} icon={mode.icon} />
            ) : null}
          </TabsContent>
        ))}
    </Tabs>
  );
}

function ReshapedContent({ content, mode, reviewId, label, icon }: {
  content: string;
  mode: ActionModeKey;
  reviewId: number;
  label: string;
  description: string;
  icon: string;
}) {
  const [exporting, setExporting] = useState(false);

  const exportMut = trpc.review.exportActionModePdf.useMutation({
    onSuccess: (data) => {
      setExporting(false);
      window.open(data.url, "_blank");
      toast.success(`${label} exported — opening in new tab`);
    },
    onError: (err) => {
      setExporting(false);
      toast.error(err.message || "Export failed");
    },
  });

  const handleExport = () => {
    setExporting(true);
    trackActionModeExported(reviewId, mode);
    exportMut.mutate({ reviewId, mode });
  };

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="font-medium text-sm">{label}</span>
            <Badge variant="outline" className="text-xs">AI-reshaped</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Export
          </Button>
        </div>
        <div className="prose prose-sm prose-invert max-w-none">
          <Streamdown>{content}</Streamdown>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type ActionModeKey = "session-prep" | "pitch-ready" | "rewrite-focus" | "remix-focus" | "full-picture";

const ACTION_MODES: Record<ActionModeKey, { label: string; icon: string; description: string; color: string }> = {
  "full-picture": {
    label: "Full Review",
    icon: "📋",
    description: "Original comprehensive review (default view)",
    color: "border-primary/30 bg-primary/5 hover:bg-primary/10",
  },
  "session-prep": {
    label: "Session Prep",
    icon: "🎛️",
    description: "Top actionable items for the studio",
    color: "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
  },
  "pitch-ready": {
    label: "Pitch Ready",
    icon: "📊",
    description: "Commercial readiness & pitch summary",
    color: "border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10",
  },
  "rewrite-focus": {
    label: "Rewrite Focus",
    icon: "✍️",
    description: "Songwriting deep dive & rewrite prompts",
    color: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
  },
  "remix-focus": {
    label: "Remix Focus",
    icon: "🔊",
    description: "Production & mix technical action items",
    color: "border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10",
  },
};

const MODE_ACTIVE_COLORS: Record<ActionModeKey, string> = {
  "full-picture": "border-primary bg-primary/15 ring-1 ring-primary/30",
  "session-prep": "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/30",
  "pitch-ready": "border-sky-500 bg-sky-500/15 ring-1 ring-sky-500/30",
  "rewrite-focus": "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/30",
  "remix-focus": "border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/30",
};

const MODE_BADGE_COLORS: Record<ActionModeKey, string> = {
  "full-picture": "bg-primary/20 text-primary border-primary/30",
  "session-prep": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "pitch-ready": "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "rewrite-focus": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "remix-focus": "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

interface ActionModeSelectorProps {
  reviewId: number;
  onModeContent: (content: string | null, mode: ActionModeKey) => void;
}

export function ActionModeSelector({ reviewId, onModeContent }: ActionModeSelectorProps) {
  const [activeMode, setActiveMode] = useState<ActionModeKey>("full-picture");
  const [loadingMode, setLoadingMode] = useState<ActionModeKey | null>(null);
  const [cachedResults, setCachedResults] = useState<Partial<Record<ActionModeKey, string>>>({});

  const actionModeMut = trpc.review.actionMode.useMutation({
    onSuccess: (data) => {
      setCachedResults((prev) => ({ ...prev, [data.mode]: data.content }));
      setActiveMode(data.mode as ActionModeKey);
      setLoadingMode(null);
      if (data.mode === "full-picture") {
        onModeContent(null, data.mode as ActionModeKey);
      } else {
        onModeContent(data.content, data.mode as ActionModeKey);
      }
    },
    onError: (err) => {
      setLoadingMode(null);
      toast.error(err.message || "Failed to reshape review");
    },
  });

  const handleModeSelect = (mode: ActionModeKey) => {
    if (mode === activeMode) return;

    // Full picture is instant — just reset
    if (mode === "full-picture") {
      setActiveMode("full-picture");
      onModeContent(null, "full-picture");
      return;
    }

    // Check cache
    if (cachedResults[mode]) {
      setActiveMode(mode);
      onModeContent(cachedResults[mode]!, mode);
      return;
    }

    // Call LLM
    setLoadingMode(mode);
    actionModeMut.mutate({ reviewId, mode });
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3 py-3">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          <Sparkles className="h-4 w-4 text-primary" />
          What do you want to do with this?
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.entries(ACTION_MODES) as [ActionModeKey, typeof ACTION_MODES[ActionModeKey]][]).map(([key, mode]) => {
            const isActive = activeMode === key;
            const isLoading = loadingMode === key;
            const isCached = !!cachedResults[key];

            return (
              <button
                key={key}
                onClick={() => handleModeSelect(key)}
                disabled={isLoading || (loadingMode !== null && loadingMode !== key)}
                className={`
                  relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all duration-200 text-center
                  ${isActive ? MODE_ACTIVE_COLORS[key] : mode.color}
                  ${isLoading ? "animate-pulse" : ""}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <span className="text-xl leading-none">{mode.icon}</span>
                <span className="text-xs font-medium leading-tight">{mode.label}</span>
                {isLoading && (
                  <Loader2 className="h-3 w-3 animate-spin absolute top-1 right-1 text-muted-foreground" />
                )}
                {isCached && !isActive && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
        {activeMode !== "full-picture" && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${MODE_BADGE_COLORS[activeMode]}`}>
              {ACTION_MODES[activeMode].icon} {ACTION_MODES[activeMode].label}
            </Badge>
            <span className="text-xs text-muted-foreground">{ACTION_MODES[activeMode].description}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => handleModeSelect("full-picture")}
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back to Full Review
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActionModeContentProps {
  content: string;
  mode: ActionModeKey;
  reviewId: number;
}

export function ActionModeContent({ content, mode, reviewId }: ActionModeContentProps) {
  const modeConfig = ACTION_MODES[mode];
  const [exporting, setExporting] = useState(false);

  const exportMut = trpc.review.exportActionModePdf.useMutation({
    onSuccess: (data) => {
      setExporting(false);
      window.open(data.url, "_blank");
      toast.success(`${modeConfig.label} exported — opening in new tab`);
    },
    onError: (err) => {
      setExporting(false);
      toast.error(err.message || "Export failed");
    },
  });

  const handleExport = () => {
    setExporting(true);
    exportMut.mutate({ reviewId, mode });
  };

  return (
    <Card className={`border ${MODE_ACTIVE_COLORS[mode].replace("ring-1", "").trim()}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{modeConfig.icon}</span>
          <CardTitle className="text-base">{modeConfig.label}</CardTitle>
          <Badge variant="outline" className={`text-xs ${MODE_BADGE_COLORS[mode]}`}>
            AI-reshaped
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-7 text-xs gap-1.5"
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
        <p className="text-xs text-muted-foreground">{modeConfig.description}</p>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm prose-invert max-w-none">
          <Streamdown>{content}</Streamdown>
        </div>
      </CardContent>
    </Card>
  );
}

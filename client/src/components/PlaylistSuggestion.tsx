import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ListMusic, Sparkles, ArrowRight, Check, GripVertical, Zap, Music, Heart, Scale } from "lucide-react";

interface PlaylistSuggestionProps {
  projectId: number;
  trackCount: number;
  onOrderApplied?: () => void;
}

const STRATEGIES = [
  { value: "balanced", label: "Balanced", icon: Scale, description: "Best overall flow combining all factors" },
  { value: "energy_arc", label: "Energy Arc", icon: Zap, description: "Classic album energy curve" },
  { value: "key_flow", label: "Key Flow", icon: Music, description: "Harmonic key relationships" },
  { value: "mood_journey", label: "Mood Journey", icon: Heart, description: "Emotional narrative arc" },
] as const;

export function PlaylistSuggestion({ projectId, trackCount, onOrderApplied }: PlaylistSuggestionProps) {
  const [strategy, setStrategy] = useState<"energy_arc" | "key_flow" | "mood_journey" | "balanced">("balanced");
  const [suggestion, setSuggestion] = useState<any>(null);
  const [showPanel, setShowPanel] = useState(false);

  const suggestMutation = trpc.playlist.suggestOrder.useMutation({
    onSuccess: (data) => {
      setSuggestion(data);
      toast.success("Playlist order suggested!");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const applyMutation = trpc.playlist.applyOrder.useMutation({
    onSuccess: () => {
      toast.success("Track order updated!");
      setSuggestion(null);
      setShowPanel(false);
      onOrderApplied?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (trackCount < 2) return null;

  if (!showPanel) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPanel(true)}
        className="gap-2"
      >
        <ListMusic className="h-4 w-4" />
        Suggest Track Order
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Smart Playlist Ordering</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setShowPanel(false); setSuggestion(null); }}>
            Close
          </Button>
        </div>
        <CardDescription>
          AI analyzes tempo, key, energy, and mood to suggest the optimal track sequence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strategy Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Sequencing Strategy</label>
          <div className="grid grid-cols-2 gap-2">
            {STRATEGIES.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  onClick={() => setStrategy(s.value as any)}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-all hover:bg-accent/50 ${
                    strategy === s.value ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${strategy === s.value ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <div className={`text-sm font-medium ${strategy === s.value ? "text-primary" : ""}`}>{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          onClick={() => suggestMutation.mutate({ projectId, strategy })}
          disabled={suggestMutation.isPending}
          className="w-full gap-2"
        >
          {suggestMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Analyzing {trackCount} tracks...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Suggestion
            </>
          )}
        </Button>

        {/* Suggestion Results */}
        {suggestion && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Overall Rationale */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <div className="text-sm font-medium">Sequencing Rationale</div>
              <p className="text-sm text-muted-foreground">{suggestion.overallRationale}</p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Energy Arc:</span> {suggestion.energyArc}
              </div>
            </div>

            {/* Suggested Order */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Suggested Order</div>
              <div className="space-y-1.5">
                {suggestion.suggestedOrder
                  .sort((a: any, b: any) => a.position - b.position)
                  .map((item: any, idx: number) => (
                    <div
                      key={item.trackId}
                      className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-2.5 transition-all hover:border-primary/30"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {item.position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.title}</span>
                          {item.tempo && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {item.tempo} BPM
                            </Badge>
                          )}
                          {item.key && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {item.key}
                            </Badge>
                          )}
                          {item.energy && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {item.energy}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.reasoning}</p>
                      </div>
                      {idx < suggestion.suggestedOrder.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-2" />
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Apply / Dismiss */}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const orderedIds = suggestion.suggestedOrder
                    .sort((a: any, b: any) => a.position - b.position)
                    .map((item: any) => item.trackId);
                  applyMutation.mutate({ projectId, orderedTrackIds: orderedIds });
                }}
                disabled={applyMutation.isPending}
                className="flex-1 gap-2"
              >
                <Check className="h-4 w-4" />
                {applyMutation.isPending ? "Applying..." : "Apply This Order"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSuggestion(null)}
                className="gap-2"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

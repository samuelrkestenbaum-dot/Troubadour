import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck, AlertTriangle, CheckCircle2, Circle, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MasteringChecklistProps {
  trackId: number;
}

const PRIORITY_CONFIG = {
  high: { icon: ArrowUp, color: "text-red-500", bg: "bg-red-500/10", label: "High" },
  medium: { icon: ArrowRight, color: "text-amber-500", bg: "bg-amber-500/10", label: "Medium" },
  low: { icon: ArrowDown, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Low" },
};

const CATEGORY_COLORS: Record<string, string> = {
  EQ: "bg-blue-500/10 text-blue-500",
  Dynamics: "bg-purple-500/10 text-purple-500",
  Stereo: "bg-cyan-500/10 text-cyan-500",
  Loudness: "bg-orange-500/10 text-orange-500",
  Arrangement: "bg-pink-500/10 text-pink-500",
  General: "bg-gray-500/10 text-gray-500",
};

export function MasteringChecklist({ trackId }: MasteringChecklistProps) {
  const [generating, setGenerating] = useState(false);

  const { data: checklist, refetch } = trpc.mastering.get.useQuery({ trackId });
  const generateMut = trpc.mastering.generateChecklist.useMutation({
    onSuccess: () => {
      refetch();
      setGenerating(false);
      toast.success("Mastering checklist generated");
    },
    onError: (err) => {
      setGenerating(false);
      toast.error("Generation failed: " + err.message);
    },
  });
  const toggleMut = trpc.mastering.toggleItem.useMutation({
    onSuccess: () => refetch(),
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateMut.mutate({ trackId });
  };

  const items = checklist?.itemsJson as Array<{
    id: string; category: string; issue: string; suggestion: string;
    priority: "high" | "medium" | "low"; completed: boolean;
  }> | undefined;

  const completedCount = items?.filter(i => i.completed).length || 0;
  const totalCount = items?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getReadinessColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-500";
    if (pct >= 50) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Mastering Readiness
          </CardTitle>
          {checklist && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCount} items
              </span>
              <div className={cn("text-2xl font-bold", getReadinessColor(progressPct))}>
                {progressPct}%
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!checklist ? (
          <div className="text-center py-6">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-3">
              Generate a mastering readiness checklist based on this track's review scores and mix report.
            </p>
            <Button onClick={handleGenerate} disabled={generating} size="sm">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Analyzing...
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                  Generate Checklist
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progressPct >= 80 ? "bg-emerald-500" : progressPct >= 50 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Checklist items grouped by priority */}
            {(["high", "medium", "low"] as const).map(priority => {
              const priorityItems = items?.filter(i => i.priority === priority) || [];
              if (priorityItems.length === 0) return null;
              const config = PRIORITY_CONFIG[priority];
              const PriorityIcon = config.icon;

              return (
                <div key={priority} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground pt-2">
                    <PriorityIcon className={cn("h-3.5 w-3.5", config.color)} />
                    {config.label} Priority
                  </div>
                  {priorityItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all",
                        item.completed
                          ? "border-emerald-500/20 bg-emerald-500/5 opacity-70"
                          : "border-border/50 bg-card hover:bg-accent/30"
                      )}
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={(checked) => {
                          toggleMut.mutate({
                            checklistId: checklist.id,
                            itemId: item.id,
                            completed: !!checked,
                          });
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General)}>
                            {item.category}
                          </Badge>
                          <span className={cn("text-sm font-medium", item.completed && "line-through text-muted-foreground")}>
                            {item.issue}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                      </div>
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="pt-2">
              <Button onClick={handleGenerate} disabled={generating} variant="outline" size="sm" className="w-full">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Regenerating...
                  </>
                ) : (
                  "Regenerate Checklist"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

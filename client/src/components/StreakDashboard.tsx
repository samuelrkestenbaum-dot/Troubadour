/**
 * Feature 4: Retention & Streak Engine
 * Gamified streak tracking with milestones, weekly goals, and activity stats.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Flame, Trophy, Target, Calendar, Upload, FileText,
  Loader2, CheckCircle2, AlertTriangle, XCircle, Zap
} from "lucide-react";
import { toast } from "sonner";

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  totalUploads: number;
  totalReviews: number;
  weeklyUploadGoal: number;
  streakStatus: "active" | "at_risk" | "broken";
  daysUntilBreak: number;
  milestones: Array<{ name: string; achieved: boolean; threshold: number }>;
}

export function StreakDashboard() {
  const [goalValue, setGoalValue] = useState<string>("");

  const streakQuery = trpc.streak.get.useQuery();
  const recordMutation = trpc.streak.record.useMutation({
    onSuccess: (data: any) => {
      streakQuery.refetch();
      if (data?.newMilestones?.length > 0) {
        toast.success(`Milestone achieved: ${data.newMilestones.join(", ")}`);
      } else {
        toast.success("Activity recorded!");
      }
    },
    onError: (err: any) => toast.error("Failed: " + (err?.message ?? "Unknown error")),
  });
  const setGoalMutation = trpc.streak.setGoal.useMutation({
    onSuccess: () => {
      streakQuery.refetch();
      toast.success("Weekly goal updated!");
    },
    onError: (err: any) => toast.error("Failed: " + (err?.message ?? "Unknown error")),
  });

  const streak = streakQuery.data as StreakInfo | undefined;

  const statusConfig = {
    active: { icon: Flame, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Active" },
    at_risk: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "At Risk" },
    broken: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", label: "Broken" },
  };

  if (streakQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading streak data...</span>
      </div>
    );
  }

  if (!streak) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Flame className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Start Your Streak</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Upload a track or generate a review to start building your streak!
          </p>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[streak.streakStatus];
  const StatusIcon = config.icon;
  const nextMilestone = streak.milestones.find(m => !m.achieved);
  const achievedCount = streak.milestones.filter(m => m.achieved).length;
  const progressToNext = nextMilestone
    ? Math.min(100, (streak.currentStreak / nextMilestone.threshold) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Activity Streak
          </h2>
          <p className="text-muted-foreground mt-1">Stay consistent to unlock milestones and grow faster</p>
        </div>
      </div>

      {/* Main Streak Card */}
      <Card className={`border-2 ${config.bg}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            {/* Streak Number */}
            <div className="text-center">
              <div className="relative">
                <div className={`text-5xl font-black ${config.color}`}>
                  {streak.currentStreak}
                </div>
                <StatusIcon className={`h-6 w-6 ${config.color} absolute -top-1 -right-3`} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">day streak</p>
            </div>

            {/* Status & Info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={config.color}>{config.label}</Badge>
                {streak.streakStatus === "at_risk" && (
                  <span className="text-xs text-amber-400 animate-pulse">Act today to keep your streak!</span>
                )}
                {streak.streakStatus === "broken" && (
                  <span className="text-xs text-red-400">Upload or review to restart</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Longest</span>
                  <p className="font-semibold">{streak.longestStreak} days</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Uploads</span>
                  <p className="font-semibold">{streak.totalUploads}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reviews</span>
                  <p className="font-semibold">{streak.totalReviews}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => recordMutation.mutate({ type: "upload" })}
                disabled={recordMutation.isPending}
              >
                {recordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Log Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => recordMutation.mutate({ type: "review" })}
                disabled={recordMutation.isPending}
              >
                <FileText className="h-4 w-4 mr-1" />
                Log Review
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Next Milestone */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Next Milestone
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextMilestone ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{nextMilestone.name}</span>
                  <span className="text-sm text-muted-foreground">{nextMilestone.threshold} days</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {streak.currentStreak} / {nextMilestone.threshold} days — {Math.round(progressToNext)}% there
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">All milestones achieved!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Goal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Weekly Goal
            </CardTitle>
            <CardDescription>Set your weekly upload target</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select value={goalValue || String(streak.weeklyUploadGoal)} onValueChange={setGoalValue}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 7, 10, 14].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} uploads/week</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const val = parseInt(goalValue || String(streak.weeklyUploadGoal));
                  if (val >= 1 && val <= 14) setGoalMutation.mutate({ goal: val });
                }}
                disabled={setGoalMutation.isPending}
              >
                {setGoalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Milestones ({achievedCount}/{streak.milestones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {streak.milestones.map((m) => (
              <div
                key={m.name}
                className={`p-3 rounded-lg border text-center transition-all ${
                  m.achieved
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-border/50 opacity-60"
                }`}
              >
                {m.achieved ? (
                  <CheckCircle2 className="h-5 w-5 text-primary mx-auto mb-1" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 mx-auto mb-1" />
                )}
                <p className="text-xs font-medium">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.threshold} days</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

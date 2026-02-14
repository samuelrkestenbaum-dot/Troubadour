import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Music, Zap, ArrowUpRight, CreditCard, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Usage() {
  const { data, isLoading } = trpc.usage.get.useQuery();
  const [, navigate] = useLocation();

  const billingMutation = trpc.subscription.manageBilling.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const audioPercent = Math.min((data.audioMinutesUsed / data.audioMinutesLimit) * 100, 100);
  const reviewPercent = data.monthlyReviewLimit >= 999
    ? Math.min((data.monthlyReviewCount / 50) * 100, 100) // visual cap for unlimited
    : Math.min((data.monthlyReviewCount / data.monthlyReviewLimit) * 100, 100);
  const isUnlimited = data.monthlyReviewLimit >= 999;

  const resetDate = new Date(data.monthlyResetDate);
  const daysUntilReset = Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Usage</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your audio processing and review usage</p>
        </div>
        <Badge variant="outline" className="capitalize text-sm px-3 py-1">{data.tier} Plan</Badge>
      </div>

      {/* Audio Processing Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              Audio Processing
            </CardTitle>
          </div>
          <CardDescription>Minutes of audio analyzed by FirstSpin.ai</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold">{data.audioMinutesUsed}</span>
              <span className="text-muted-foreground text-lg"> / {data.audioMinutesLimit} min</span>
            </div>
            <span className="text-sm text-muted-foreground">{audioPercent.toFixed(0)}% used</span>
          </div>
          <Progress value={audioPercent} className="h-2" />
          {audioPercent >= 80 && data.tier === "free" && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400">
                You're approaching your audio limit. Upgrade for more capacity.
              </p>
              <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0 ml-3" onClick={() => navigate("/pricing")}>
                Upgrade <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Reviews Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Monthly Reviews
            </CardTitle>
          </div>
          <CardDescription>AI-powered reviews generated this billing cycle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold">{data.monthlyReviewCount}</span>
              <span className="text-muted-foreground text-lg">
                {isUnlimited ? " reviews" : ` / ${data.monthlyReviewLimit} reviews`}
              </span>
            </div>
            {isUnlimited ? (
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Unlimited</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">{reviewPercent.toFixed(0)}% used</span>
            )}
          </div>
          {!isUnlimited && <Progress value={reviewPercent} className="h-2" />}
          {!isUnlimited && reviewPercent >= 66 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400">
                {data.monthlyReviewCount >= data.monthlyReviewLimit
                  ? "You've reached your monthly review limit."
                  : `Only ${data.monthlyReviewLimit - data.monthlyReviewCount} review${data.monthlyReviewLimit - data.monthlyReviewCount === 1 ? "" : "s"} remaining this month.`}
              </p>
              <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0 ml-3" onClick={() => navigate("/pricing")}>
                Upgrade <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Cycle Info */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Billing Cycle Reset</p>
              <p className="text-xs text-muted-foreground">
                {daysUntilReset === 0
                  ? "Resets today"
                  : daysUntilReset === 1
                    ? "Resets tomorrow"
                    : `Resets in ${daysUntilReset} days`}
                {" · "}
                {resetDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engine Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center shrink-0">
              <Music className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Audio Analysis</p>
              <p className="text-sm font-medium text-emerald-400">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/15 to-sky-500/5 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">AI Critique</p>
              <p className="text-sm font-medium text-sky-400">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transcription</p>
              <p className="text-sm font-medium text-violet-400">Active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade / Billing Section */}
      <Card>
        <CardContent className="py-5">
          {data.tier === "free" ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Want more reviews and features?</p>
                <p className="text-sm text-muted-foreground">Upgrade to Artist or Pro for unlimited reviews and advanced features.</p>
              </div>
              <Button onClick={() => navigate("/pricing")} className="shrink-0">
                View Plans <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Manage your subscription</p>
                <p className="text-sm text-muted-foreground">Update payment method, change plan, or view invoices.</p>
              </div>
              <Button variant="outline" onClick={() => billingMutation.mutate({ origin: window.location.origin })} disabled={billingMutation.isPending} className="shrink-0">
                <CreditCard className="mr-2 h-4 w-4" /> Manage Billing
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Music, Zap } from "lucide-react";

export default function Usage() {
  const { data, isLoading } = trpc.usage.get.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const usagePercent = Math.min((data.audioMinutesUsed / data.audioMinutesLimit) * 100, 100);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your audio processing usage</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Audio Processing</CardTitle>
            <Badge variant="outline" className="capitalize">{data.tier} Plan</Badge>
          </div>
          <CardDescription>Minutes of audio analyzed by FirstSpin.ai</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold">{data.audioMinutesUsed}</span>
              <span className="text-muted-foreground text-lg"> / {data.audioMinutesLimit} min</span>
            </div>
            <span className="text-sm text-muted-foreground">{usagePercent.toFixed(0)}% used</span>
          </div>
          <Progress value={usagePercent} className="h-2" />
          {usagePercent >= 80 && (
            <p className="text-xs text-amber-400">
              You are approaching your usage limit. Consider upgrading for more capacity.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
              <Music className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engine</p>
              <p className="text-sm font-medium">Audio Analysis</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engine</p>
              <p className="text-sm font-medium">Critique Generation</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engine</p>
              <p className="text-sm font-medium">Transcription</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

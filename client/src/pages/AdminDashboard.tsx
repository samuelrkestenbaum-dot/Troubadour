import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CreditCard, FileText, FolderOpen, Shield, TrendingUp, Eye, ClipboardList, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3, Download, UserCheck, UserX, Activity, Bell, Grid3X3, Send, Search, Settings, Server, RefreshCw, Clock, Database, Zap, AlertTriangle, CheckSquare, Square, Webhook } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useMemo, useCallback } from "react";
import { UserDetailModal } from "@/components/UserDetailModal";

function StatCard({ title, value, icon: Icon, description }: { title: string; value: string | number; icon: React.ElementType; description?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    artist: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    pro: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <Badge variant="outline" className={colors[tier] || ""}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
      <Shield className="h-3 w-3 mr-1" /> Admin
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">User</Badge>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    update_role: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    update_tier: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    reset_monthly_count: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const labels: Record<string, string> = {
    update_role: "Role Change",
    update_tier: "Tier Change",
    reset_monthly_count: "Count Reset",
  };
  return (
    <Badge variant="outline" className={styles[action] || "text-muted-foreground"}>
      {labels[action] || action}
    </Badge>
  );
}

function AuditLogTab({ isAdmin }: { isAdmin: boolean }) {
  const auditLog = trpc.admin.getAuditLog.useQuery(undefined, { enabled: isAdmin });

  if (auditLog.isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!auditLog.data || auditLog.data.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No admin actions recorded yet</p>
        <p className="text-xs text-muted-foreground mt-1">Actions like role changes, tier adjustments, and count resets will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {auditLog.data.map((entry) => {
        const details = entry.details as Record<string, unknown> | null;
        return (
          <div key={entry.id} className="flex items-start justify-between py-3 px-4 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-start gap-3">
              <ActionBadge action={entry.action} />
              <div>
                <div className="text-sm">
                  <span className="font-medium">{entry.adminName || `Admin #${entry.adminUserId}`}</span>
                  {" → "}
                  <span className="text-muted-foreground">User #{entry.targetUserId}</span>
                </div>
                {details && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {entry.action === "update_role" && (
                      <>
                        <span>{String(details.previousRole)}</span>
                        <ArrowUpRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">{String(details.newRole)}</span>
                      </>
                    )}
                    {entry.action === "update_tier" && (
                      <>
                        <span>{String(details.previousTier)}</span>
                        <ArrowUpRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">{String(details.newTier)}</span>
                      </>
                    )}
                    {entry.action === "reset_monthly_count" && (
                      <>
                        <span>Count was {String(details.previousCount)}</span>
                        <ArrowDownRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">Reset to 0</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RevenueTab({ isAdmin, users: userData }: { isAdmin: boolean; users: Array<{ id: number; name: string | null; email: string | null; tier: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; createdAt: Date; }> | undefined }) {
  const stats = trpc.admin.getStats.useQuery(undefined, { enabled: isAdmin });

  const revenueMetrics = useMemo(() => {
    if (!userData || !stats.data) return null;

    const paidUsers = userData.filter(u => u.stripeSubscriptionId);
    const artistUsers = userData.filter(u => u.tier === "artist");
    const proUsers = userData.filter(u => u.tier === "pro");

    // Pricing from products.ts: Artist = $7.99/mo, Pro = $14.99/mo
    const estimatedMRR = (artistUsers.length * 7.99) + (proUsers.length * 14.99);
    const estimatedARR = estimatedMRR * 12;
    const conversionRate = userData.length > 0 ? ((paidUsers.length / userData.length) * 100) : 0;

    // Users who joined in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers30d = userData.filter(u => new Date(u.createdAt) > thirtyDaysAgo).length;

    // Users who joined in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers7d = userData.filter(u => new Date(u.createdAt) > sevenDaysAgo).length;

    return {
      estimatedMRR,
      estimatedARR,
      conversionRate,
      paidUsers: paidUsers.length,
      artistUsers: artistUsers.length,
      proUsers: proUsers.length,
      newUsers30d,
      newUsers7d,
      arpu: paidUsers.length > 0 ? estimatedMRR / paidUsers.length : 0,
    };
  }, [userData, stats.data]);

  if (!revenueMetrics) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Estimated MRR"
          value={`$${revenueMetrics.estimatedMRR.toFixed(2)}`}
          icon={DollarSign}
          description={`${revenueMetrics.artistUsers} Artist × $7.99 + ${revenueMetrics.proUsers} Pro × $14.99`}
        />
        <StatCard
          title="Estimated ARR"
          value={`$${revenueMetrics.estimatedARR.toFixed(2)}`}
          icon={TrendingUp}
          description="Projected annual recurring revenue"
        />
        <StatCard
          title="Conversion Rate"
          value={`${revenueMetrics.conversionRate.toFixed(1)}%`}
          icon={ArrowUpRight}
          description={`${revenueMetrics.paidUsers} paid of ${userData?.length ?? 0} total users`}
        />
        <StatCard
          title="ARPU"
          value={`$${revenueMetrics.arpu.toFixed(2)}`}
          icon={CreditCard}
          description="Average revenue per paid user"
        />
      </div>

      {/* Growth Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Growth Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">New Users (7d)</p>
              <p className="text-2xl font-bold">{revenueMetrics.newUsers7d}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">New Users (30d)</p>
              <p className="text-2xl font-bold">{revenueMetrics.newUsers30d}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reviews per User (30d)</p>
              <p className="text-2xl font-bold">
                {stats.data && userData && userData.length > 0
                  ? (stats.data.reviewsThisMonth / userData.length).toFixed(1)
                  : "0"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" /> Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: "Free", count: stats.data?.tierBreakdown.free ?? 0, color: "bg-zinc-500", pct: 100 },
              { label: "Artist ($7.99/mo)", count: revenueMetrics.artistUsers, color: "bg-amber-500", pct: userData && userData.length > 0 ? (revenueMetrics.artistUsers / userData.length) * 100 : 0 },
              { label: "Pro ($14.99/mo)", count: revenueMetrics.proUsers, color: "bg-primary", pct: userData && userData.length > 0 ? (revenueMetrics.proUsers / userData.length) * 100 : 0 },
            ].map((tier) => (
              <div key={tier.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{tier.label}</span>
                  <span className="font-medium">{tier.count} users ({tier.pct.toFixed(1)}%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${tier.color}`}
                    style={{ width: `${Math.max(tier.pct, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Retention Metrics + Churn Alert */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Retention & Churn Monitoring</h3>
          <ChurnAlertButton isAdmin={isAdmin} />
        </div>
        <RetentionCard isAdmin={isAdmin} />
      </div>

      {/* Cohort Analysis */}
      <CohortAnalysis isAdmin={isAdmin} />

      {/* User & Review Growth Chart */}
      <GrowthChart isAdmin={isAdmin} />

      {/* Revenue Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Revenue estimates are calculated from local tier data. For authoritative figures, check your{" "}
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          Stripe Dashboard
        </a>.
      </p>
    </div>
  );
}

function RetentionCard({ isAdmin }: { isAdmin: boolean }) {
  const retention = trpc.admin.getRetention.useQuery(undefined, { enabled: isAdmin });

  if (retention.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!retention.data) return null;

  const { totalUsers, activeUsers, inactiveUsers, retentionRate, avgDaysSinceLogin } = retention.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Retention & Churn (30-day window)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4 text-emerald-500" /> Active Users
            </div>
            <p className="text-2xl font-bold text-emerald-500">{activeUsers}</p>
            <p className="text-xs text-muted-foreground">Logged in within 30 days</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserX className="h-4 w-4 text-red-400" /> Inactive Users
            </div>
            <p className="text-2xl font-bold text-red-400">{inactiveUsers}</p>
            <p className="text-xs text-muted-foreground">No login in 30+ days</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" /> Retention Rate
            </div>
            <p className={`text-2xl font-bold ${retentionRate >= 70 ? "text-emerald-500" : retentionRate >= 40 ? "text-amber-500" : "text-red-400"}`}>
              {retentionRate}%
            </p>
            <p className="text-xs text-muted-foreground">{activeUsers} of {totalUsers} users retained</p>
          </div>
          <div className="space-y-1 p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" /> Avg Days Since Login
            </div>
            <p className="text-2xl font-bold">{avgDaysSinceLogin}</p>
            <p className="text-xs text-muted-foreground">Across all users</p>
          </div>
        </div>
        {/* Retention bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Active ({activeUsers})</span>
            <span>Inactive ({inactiveUsers})</span>
          </div>
          <div className="h-3 bg-red-400/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${retentionRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportButton({ type, isAdmin }: { type: "users" | "auditLog"; isAdmin: boolean }) {
  const [isExporting, setIsExporting] = useState(false);
  const utils = trpc.useUtils();

  const handleExport = async () => {
    if (!isAdmin) return;
    setIsExporting(true);
    try {
      const result = type === "users"
        ? await utils.admin.exportUsers.fetch()
        : await utils.admin.exportAuditLog.fetch();
      
      if (!result.csv) {
        toast.error("No data to export");
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type === "users" ? "users" : "audit-log"}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${type === "users" ? "Users" : "Audit log"} exported successfully`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={handleExport}
      disabled={isExporting || !isAdmin}
    >
      <Download className="h-3.5 w-3.5 mr-1" />
      {isExporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}

function ChurnAlertButton({ isAdmin }: { isAdmin: boolean }) {
  const [threshold, setThreshold] = useState(50);
  const sendAlert = trpc.admin.sendChurnAlert.useMutation({
    onSuccess: (data) => {
      if (data.isAlert) {
        toast.warning(`Churn alert sent! Retention at ${data.metrics.retentionRate}%`);
      } else {
        toast.success(`Retention healthy at ${data.metrics.retentionRate}%. Notification sent.`);
      }
    },
    onError: () => toast.error("Failed to send churn alert"),
  });

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Alert threshold:</label>
        <input
          type="number"
          min={0}
          max={100}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-16 h-7 text-xs px-2 rounded-md border border-border bg-background text-foreground"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => sendAlert.mutate({ threshold })}
        disabled={sendAlert.isPending || !isAdmin}
      >
        <Send className="h-3.5 w-3.5 mr-1" />
        {sendAlert.isPending ? "Sending..." : "Send Churn Digest"}
      </Button>
    </div>
  );
}

function CohortAnalysis({ isAdmin }: { isAdmin: boolean }) {
  const cohorts = trpc.admin.getCohortAnalysis.useQuery(undefined, { enabled: isAdmin });

  if (cohorts.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!cohorts.data || cohorts.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" /> Cohort Retention Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Not enough data for cohort analysis yet</p>
        </CardContent>
      </Card>
    );
  }

  const getRetentionColor = (rate: number) => {
    if (rate >= 80) return "bg-emerald-500 text-white";
    if (rate >= 60) return "bg-emerald-500/70 text-white";
    if (rate >= 40) return "bg-amber-500/70 text-white";
    if (rate >= 20) return "bg-amber-500/40 text-foreground";
    if (rate > 0) return "bg-red-400/40 text-foreground";
    return "bg-muted/30 text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" /> Cohort Retention Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cohort</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Signups</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">30d Retained</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">60d Retained</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">90d Retained</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.data.map((cohort) => (
                <tr key={cohort.cohortMonth} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium">{cohort.cohortMonth}</td>
                  <td className="py-2 px-3 text-center font-mono">{cohort.signupCount}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRetentionColor(cohort.retentionRate30d)}`}>
                      {cohort.retentionRate30d}% ({cohort.retainedAt30d})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRetentionColor(cohort.retentionRate60d)}`}>
                      {cohort.retentionRate60d}% ({cohort.retainedAt60d})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRetentionColor(cohort.retentionRate90d)}`}>
                      {cohort.retentionRate90d}% ({cohort.retainedAt90d})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Retention rates show the percentage of users from each signup cohort who remained active at 30, 60, and 90 day intervals.</p>
      </CardContent>
    </Card>
  );
}

function GrowthChart({ isAdmin }: { isAdmin: boolean }) {
  const userGrowth = trpc.admin.getUserGrowth.useQuery(undefined, { enabled: isAdmin });
  const reviewGrowth = trpc.admin.getReviewGrowth.useQuery(undefined, { enabled: isAdmin });

  const chartData = useMemo(() => {
    if (!userGrowth.data && !reviewGrowth.data) return null;

    // Build a date map for the last 90 days
    const days = 90;
    const dateMap = new Map<string, { users: number; reviews: number }>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dateMap.set(key, { users: 0, reviews: 0 });
    }

    // Fill in user signups
    if (userGrowth.data) {
      for (const row of userGrowth.data) {
        const key = String(row.date);
        const existing = dateMap.get(key);
        if (existing) existing.users = Number(row.count);
      }
    }

    // Fill in reviews
    if (reviewGrowth.data) {
      for (const row of reviewGrowth.data) {
        const key = String(row.date);
        const existing = dateMap.get(key);
        if (existing) existing.reviews = Number(row.count);
      }
    }

    // Convert to array and compute cumulative
    const entries = Array.from(dateMap.entries()).map(([date, vals]) => ({
      date,
      users: vals.users,
      reviews: vals.reviews,
    }));

    // Compute running totals
    let cumulativeUsers = 0;
    let cumulativeReviews = 0;
    const cumulative = entries.map((e) => {
      cumulativeUsers += e.users;
      cumulativeReviews += e.reviews;
      return { ...e, cumulativeUsers, cumulativeReviews };
    });

    const maxDaily = Math.max(...entries.map((e) => Math.max(e.users, e.reviews)), 1);

    return { entries, cumulative, maxDaily, totalNewUsers: cumulativeUsers, totalNewReviews: cumulativeReviews };
  }, [userGrowth.data, reviewGrowth.data]);

  if (userGrowth.isLoading || reviewGrowth.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Growth Over Time (90d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No growth data available yet</p>
        </CardContent>
      </Card>
    );
  }

  const { entries, maxDaily, totalNewUsers, totalNewReviews } = chartData;
  const chartWidth = 100;
  const chartHeight = 40;
  const barWidth = chartWidth / entries.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Growth Over Time (90d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="flex gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-primary" />
            <span className="text-sm text-muted-foreground">New Users: <span className="font-medium text-foreground">{totalNewUsers}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-amber-500" />
            <span className="text-sm text-muted-foreground">Reviews: <span className="font-medium text-foreground">{totalNewReviews}</span></span>
          </div>
        </div>

        {/* SVG Bar Chart */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight + 8}`}
            className="w-full h-48"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1="0"
                y1={chartHeight - chartHeight * pct}
                x2={chartWidth}
                y2={chartHeight - chartHeight * pct}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="0.15"
              />
            ))}

            {/* Bars */}
            {entries.map((entry, i) => {
              const userH = (entry.users / maxDaily) * chartHeight;
              const reviewH = (entry.reviews / maxDaily) * chartHeight;
              const x = i * barWidth;
              const halfBar = barWidth * 0.35;
              return (
                <g key={entry.date}>
                  {/* User bar */}
                  <rect
                    x={x + barWidth * 0.08}
                    y={chartHeight - userH}
                    width={halfBar}
                    height={Math.max(userH, 0.2)}
                    rx="0.15"
                    className="fill-primary"
                    opacity={userH > 0 ? 0.8 : 0.1}
                  >
                    <title>{entry.date}: {entry.users} new users</title>
                  </rect>
                  {/* Review bar */}
                  <rect
                    x={x + barWidth * 0.08 + halfBar + barWidth * 0.04}
                    y={chartHeight - reviewH}
                    width={halfBar}
                    height={Math.max(reviewH, 0.2)}
                    rx="0.15"
                    className="fill-amber-500"
                    opacity={reviewH > 0 ? 0.8 : 0.1}
                  >
                    <title>{entry.date}: {entry.reviews} reviews</title>
                  </rect>
                </g>
              );
            })}

            {/* X-axis labels (every ~30 days) */}
            {entries.filter((_, i) => i === 0 || i === 29 || i === 59 || i === entries.length - 1).map((entry, idx) => {
              const i = idx === 0 ? 0 : idx === 1 ? 29 : idx === 2 ? 59 : entries.length - 1;
              return (
                <text
                  key={entry.date}
                  x={i * barWidth + barWidth / 2}
                  y={chartHeight + 5}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="2.5"
                >
                  {format(new Date(entry.date + "T00:00:00"), "MMM d")}
                </text>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function BulkActionToolbar({ selectedIds, isAdmin, onClear }: { selectedIds: Set<number>; isAdmin: boolean; onClear: () => void }) {
  const utils = trpc.useUtils();
  const [bulkTier, setBulkTier] = useState<string>("");
  const [bulkRole, setBulkRole] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const bulkUpdateTier = trpc.admin.bulkUpdateTier.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} users to ${bulkTier} tier`);
      utils.admin.getUsers.invalidate();
      utils.admin.getStats.invalidate();
      utils.admin.getAuditLog.invalidate();
      onClear();
      setBulkTier("");
    },
    onError: () => toast.error("Bulk tier update failed"),
  });

  const bulkUpdateRole = trpc.admin.bulkUpdateRole.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} users to ${bulkRole} role`);
      utils.admin.getUsers.invalidate();
      utils.admin.getAuditLog.invalidate();
      onClear();
      setBulkRole("");
    },
    onError: (err) => toast.error(err.message || "Bulk role update failed"),
  });

  const handleBulkExport = async () => {
    setIsExporting(true);
    try {
      const result = await utils.admin.bulkExportUsers.fetch({ userIds: Array.from(selectedIds) });
      if (!result.csv) { toast.error("No data"); return; }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `selected-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${selectedIds.size} users`);
    } catch { toast.error("Export failed"); }
    finally { setIsExporting(false); }
  };

  if (selectedIds.size === 0) return null;

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5">
      <CardContent className="py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Select value={bulkTier} onValueChange={setBulkTier}>
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue placeholder="Set Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm" className="h-7 text-xs"
              disabled={!bulkTier || bulkUpdateTier.isPending}
              onClick={() => bulkUpdateTier.mutate({ userIds: Array.from(selectedIds), tier: bulkTier as "free" | "artist" | "pro" })}
            >
              {bulkUpdateTier.isPending ? "Updating..." : "Apply Tier"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={bulkRole} onValueChange={setBulkRole}>
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue placeholder="Set Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm" className="h-7 text-xs"
              disabled={!bulkRole || bulkUpdateRole.isPending}
              onClick={() => bulkUpdateRole.mutate({ userIds: Array.from(selectedIds), role: bulkRole as "user" | "admin" })}
            >
              {bulkUpdateRole.isPending ? "Updating..." : "Apply Role"}
            </Button>
          </div>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleBulkExport} disabled={isExporting}>
            <Download className="h-3.5 w-3.5 mr-1" />
            {isExporting ? "Exporting..." : "Export Selected"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClear}>
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WebhookEventsTab({ isAdmin }: { isAdmin: boolean }) {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const events = trpc.admin.getWebhookEvents.useQuery(
    { limit: 100, eventType: eventTypeFilter === "all" ? undefined : eventTypeFilter },
    { enabled: isAdmin, refetchInterval: 30000 }
  );
  const stats = trpc.admin.getWebhookStats.useQuery(undefined, { enabled: isAdmin, refetchInterval: 30000 });

  const eventTypeStyles: Record<string, string> = {
    "checkout.session.completed": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "customer.subscription.updated": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "customer.subscription.deleted": "bg-red-500/10 text-red-400 border-red-500/20",
    "invoice.paid": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "invoice.payment_failed": "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const uniqueTypes = useMemo(() => {
    if (!stats.data?.byType) return [];
    return stats.data.byType.map(t => t.eventType);
  }, [stats.data]);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats.data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Events" value={stats.data.total} icon={Webhook} description="All-time webhook events" />
          <StatCard title="Last 24 Hours" value={stats.data.last24h} icon={Clock} description="Events in the last day" />
          <StatCard title="Event Types" value={stats.data.byType.length} icon={Grid3X3} description="Distinct event types" />
        </div>
      )}

      {/* Event Type Breakdown */}
      {stats.data && stats.data.byType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Event Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.data.byType.map(({ eventType, count }) => {
                const pct = stats.data!.total > 0 ? Math.round((count / stats.data!.total) * 100) : 0;
                return (
                  <div key={eventType} className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs min-w-[200px] justify-center ${eventTypeStyles[eventType] || ""}`}>
                      {eventType}
                    </Badge>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhook Event Log
          </CardTitle>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="h-7 w-[220px] text-xs">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {uniqueTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {events.isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : events.data && events.data.length > 0 ? (
            <div className="space-y-2">
              {events.data.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs ${eventTypeStyles[evt.eventType] || ""}`}>
                      {evt.eventType}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">{evt.eventId}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(evt.processedAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No webhook events recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserSearchBar({ isAdmin, onSelectUser }: { isAdmin: boolean; onSelectUser: (id: number) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");

  const searchQuery = trpc.admin.searchUsers.useQuery(
    {
      query: searchTerm || undefined,
      tier: (tierFilter !== "all" ? tierFilter : undefined) as "free" | "artist" | "pro" | undefined,
      role: (roleFilter !== "all" ? roleFilter : undefined) as "admin" | "user" | undefined,
      status: (activityFilter !== "all" ? activityFilter : undefined) as "active" | "inactive" | "all" | undefined,
    },
    { enabled: isAdmin && (searchTerm.length > 0 || tierFilter !== "all" || roleFilter !== "all" || activityFilter !== "all") }
  );

  const hasFilters = searchTerm.length > 0 || tierFilter !== "all" || roleFilter !== "all" || activityFilter !== "all";

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" /> Search & Filter Users
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="artist">Artist</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activity</SelectItem>
              <SelectItem value="active">Active (30d)</SelectItem>
              <SelectItem value="inactive">Inactive (30d+)</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearchTerm(""); setTierFilter("all"); setRoleFilter("all"); setActivityFilter("all"); }}>
              Clear
            </Button>
          )}
        </div>

        {hasFilters && (
          <div>
            {searchQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : searchQuery.data && searchQuery.data.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-2">{searchQuery.data.length} result{searchQuery.data.length !== 1 ? "s" : ""}</p>
                {searchQuery.data.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onSelectUser(u.id)}>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-sm font-medium">{u.name || "Unnamed"}</span>
                        <span className="text-xs text-muted-foreground ml-2">{u.email || "No email"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={u.role} />
                      <TierBadge tier={u.tier} />
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4 text-sm">No users match your filters</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemHealthTab({ isAdmin }: { isAdmin: boolean }) {
  const health = trpc.admin.getSystemHealth.useQuery(undefined, { enabled: isAdmin, refetchInterval: 30000 });

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (health.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}
      </div>
    );
  }

  if (!health.data) return <p className="text-muted-foreground text-center py-8">Unable to load health data</p>;

  const d = health.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2"><Server className="h-4 w-4" /> System Health</h3>
        <Button variant="ghost" size="sm" onClick={() => health.refetch()} className="h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${d.databaseConnected ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-muted-foreground">{d.databaseConnected ? "Connected" : "Disconnected"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Server Uptime</p>
                <p className="text-xs text-muted-foreground">{formatUptime(d.serverUptime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Active Jobs</p>
                <p className="text-xs text-muted-foreground">{d.activeJobsCount} running</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${d.errorJobsCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Error Jobs</p>
                <p className="text-xs text-muted-foreground">{d.errorJobsCount} errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Platform Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Users</span>
                <span className="text-sm font-mono font-medium">{d.totalUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Reviews</span>
                <span className="text-sm font-mono font-medium">{d.totalReviews}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Reviews (7d)</span>
                <span className="text-sm font-mono font-medium">{d.reviewsLast7d}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Reviews/User</span>
                <span className="text-sm font-mono font-medium">{d.avgReviewsPerUser}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Scheduler Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm">Digest Scheduler</p>
                  <p className="text-xs text-muted-foreground">Runs daily at configured time</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm">Churn Alert Scheduler</p>
                  <p className="text-xs text-muted-foreground">Checks hourly, alerts at 9 AM UTC</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminSettingsTab({ isAdmin }: { isAdmin: boolean }) {
  const prefs = trpc.admin.getNotificationPrefs.useQuery(undefined, { enabled: isAdmin });
  const updatePrefs = trpc.admin.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved");
      prefs.refetch();
    },
    onError: () => toast.error("Failed to save preferences"),
  });

  const [localPrefs, setLocalPrefs] = useState<{
    churnAlerts: boolean;
    newSignups: boolean;
    paymentEvents: boolean;
    churnThreshold: number;
    digestFrequency: "realtime" | "daily" | "weekly" | "off";
  } | null>(null);

  const currentPrefs = localPrefs || prefs.data;

  const handleToggle = (key: string, value: boolean) => {
    const updated = { ...currentPrefs!, [key]: value };
    setLocalPrefs(updated);
  };

  const handleSave = () => {
    if (!currentPrefs) return;
    updatePrefs.mutate(currentPrefs);
    setLocalPrefs(null);
  };

  if (prefs.isLoading) {
    return (
      <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
    );
  }

  if (!currentPrefs) return <p className="text-muted-foreground text-center py-8">Unable to load settings</p>;

  const hasChanges = localPrefs !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { key: "churnAlerts", label: "Churn Alerts", desc: "Get notified when retention drops below threshold" },
              { key: "newSignups", label: "New Signup Alerts", desc: "Get notified when new users register" },
              { key: "paymentEvents", label: "Payment Alerts", desc: "Get notified on payment events (subscriptions, cancellations)" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Button
                  variant={currentPrefs[key as keyof typeof currentPrefs] ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-16"
                  onClick={() => handleToggle(key, !currentPrefs[key as keyof typeof currentPrefs])}
                >
                  {currentPrefs[key as keyof typeof currentPrefs] ? "On" : "Off"}
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between py-2 border-t border-border pt-4">
              <div>
                <p className="text-sm font-medium">Churn Alert Threshold</p>
                <p className="text-xs text-muted-foreground">Alert when retention rate drops below this percentage</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={currentPrefs.churnThreshold}
                  onChange={(e) => handleToggle("churnThreshold", Number(e.target.value) as any)}
                  className="w-20 h-8 text-center"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            {hasChanges && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setLocalPrefs(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={updatePrefs.isPending}>
                  {updatePrefs.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const stats = trpc.admin.getStats.useQuery(undefined, { enabled: isAdmin });
  const usersQuery = trpc.admin.getUsers.useQuery(undefined, { enabled: isAdmin });
  const activity = trpc.admin.getRecentActivity.useQuery(undefined, { enabled: isAdmin });

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  const toggleUserSelection = useCallback((userId: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!usersQuery.data) return;
    setSelectedUserIds(prev => {
      if (prev.size === usersQuery.data!.length) return new Set();
      return new Set(usersQuery.data!.map(u => u.id));
    });
  }, [usersQuery.data]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const openUserDetail = (userId: number) => {
    setSelectedUserId(userId);
    setShowUserDetail(true);
  };

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview, user management, and revenue analytics</p>
      </div>

      {/* Stats Grid */}
      {stats.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-20" /><Skeleton className="h-4 w-32 mt-2" /></CardContent></Card>
          ))}
        </div>
      ) : stats.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Users" value={stats.data.totalUsers} icon={Users} description={`${stats.data.tierBreakdown.free} free, ${stats.data.tierBreakdown.artist} artist, ${stats.data.tierBreakdown.pro} pro`} />
          <StatCard title="Active Subscriptions" value={stats.data.activeSubscriptions} icon={CreditCard} description="Users with Stripe subscription" />
          <StatCard title="Reviews (30d)" value={stats.data.reviewsThisMonth} icon={FileText} description="Reviews generated in last 30 days" />
          <StatCard title="Total Projects" value={stats.data.totalProjects} icon={FolderOpen} />
        </div>
      ) : null}

      {/* Tabbed Content: Users / Audit Log / Revenue */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Audit Log
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Revenue
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" /> Health
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-1.5">
            <Webhook className="h-3.5 w-3.5" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          {/* Tier Breakdown */}
          {stats.data && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Tier Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  {Object.entries(stats.data.tierBreakdown).map(([tier, count]) => {
                    const total = stats.data!.totalUsers || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={tier} className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                          <TierBadge tier={tier} />
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${tier === "pro" ? "bg-primary" : tier === "artist" ? "bg-amber-500" : "bg-zinc-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Search / Filter Bar */}
          <UserSearchBar isAdmin={isAdmin} onSelectUser={openUserDetail} />

          {/* Bulk Action Toolbar */}
          <BulkActionToolbar selectedIds={selectedUserIds} isAdmin={isAdmin} onClear={() => setSelectedUserIds(new Set())} />

          {/* User Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> All Users ({usersQuery.data?.length ?? 0})
              </CardTitle>
              <ExportButton type="users" isAdmin={isAdmin} />
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : usersQuery.data && usersQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-3 px-2 w-8">
                          <button onClick={toggleSelectAll} className="flex items-center justify-center">
                            {selectedUserIds.size === usersQuery.data.length ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">User</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tier</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reviews</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Subscription</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joined</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Last Active</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQuery.data.map((u) => (
                        <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selectedUserIds.has(u.id) ? "bg-primary/5" : ""}`}>
                          <td className="py-3 px-2">
                            <button onClick={() => toggleUserSelection(u.id)} className="flex items-center justify-center">
                              {selectedUserIds.has(u.id) ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <div className="font-medium">{u.name || "Unnamed"}</div>
                              <div className="text-xs text-muted-foreground">{u.email || "No email"}</div>
                            </div>
                          </td>
                          <td className="py-3 px-2"><RoleBadge role={u.role} /></td>
                          <td className="py-3 px-2"><TierBadge tier={u.tier} /></td>
                          <td className="py-3 px-2 font-mono text-xs">{u.monthlyReviewCount}</td>
                          <td className="py-3 px-2">
                            {u.stripeSubscriptionId ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(u.lastSignedIn), { addSuffix: true })}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openUserDetail(u.id)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Manage
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No users found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Admin Audit Log
              </CardTitle>
              <ExportButton type="auditLog" isAdmin={isAdmin} />
            </CardHeader>
            <CardContent>
              <AuditLogTab isAdmin={isAdmin} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <RevenueTab isAdmin={isAdmin} users={usersQuery.data} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Recent Reviews (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : activity.data && activity.data.length > 0 ? (
                <div className="space-y-2">
                  {activity.data.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {r.reviewType === "album" ? "Album" : r.reviewType === "comparison" ? "Compare" : "Track"}
                        </Badge>
                        <span className="text-sm">Review #{r.id}</span>
                        <span className="text-xs text-muted-foreground">Track #{r.trackId}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">{r.modelUsed}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No recent reviews</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Events Tab */}
        <TabsContent value="webhooks">
          <WebhookEventsTab isAdmin={isAdmin} />
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="health">
          <SystemHealthTab isAdmin={isAdmin} />
        </TabsContent>

        {/* Admin Settings Tab */}
        <TabsContent value="settings">
          <AdminSettingsTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      {/* User Detail Modal */}
      <UserDetailModal
        userId={selectedUserId}
        open={showUserDetail}
        onOpenChange={setShowUserDetail}
      />
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CreditCard, FileText, FolderOpen, Shield, TrendingUp, Eye, ClipboardList, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useMemo } from "react";
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const stats = trpc.admin.getStats.useQuery(undefined, { enabled: isAdmin });
  const usersQuery = trpc.admin.getUsers.useQuery(undefined, { enabled: isAdmin });
  const activity = trpc.admin.getRecentActivity.useQuery(undefined, { enabled: isAdmin });

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);

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

          {/* User Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> All Users ({usersQuery.data?.length ?? 0})
              </CardTitle>
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
                        <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
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
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Admin Audit Log
              </CardTitle>
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

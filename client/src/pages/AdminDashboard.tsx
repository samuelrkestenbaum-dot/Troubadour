import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, FileText, FolderOpen, Shield, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

export default function AdminDashboard() {
  const { user } = useAuth();
  const stats = trpc.admin.getStats.useQuery(undefined, { enabled: user?.role === "admin" });
  const users = trpc.admin.getUsers.useQuery(undefined, { enabled: user?.role === "admin" });
  const activity = trpc.admin.getRecentActivity.useQuery(undefined, { enabled: user?.role === "admin" });

  if (user?.role !== "admin") {
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

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview and user management</p>
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

      {/* Tier Breakdown */}
      {stats.data && (
        <Card>
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
            <Users className="h-4 w-4" /> All Users ({users.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : users.data && users.data.length > 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u) => (
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

      {/* Recent Activity */}
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
    </div>
  );
}

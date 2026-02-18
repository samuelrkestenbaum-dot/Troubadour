import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Shield, ShieldOff, Crown, User as UserIcon, RotateCcw,
  FolderOpen, FileText, Music, Clock, Mail, Calendar,
  AlertTriangle, ClipboardList, ArrowUpRight, ArrowDownRight,
  TrendingUp, Minus
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

interface UserDetailModalProps {
  userId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function AuditActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    update_role: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    update_tier: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    reset_monthly_count: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const labels: Record<string, string> = {
    update_role: "Role",
    update_tier: "Tier",
    reset_monthly_count: "Reset",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[action] || ""}`}>
      {labels[action] || action}
    </Badge>
  );
}

function UserAuditHistory({ userId, open }: { userId: number | null; open: boolean }) {
  const auditLog = trpc.admin.getUserAuditLog.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  );

  if (auditLog.isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Admin Action History
          </h4>
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!auditLog.data || auditLog.data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Admin Action History
          </h4>
          <p className="text-xs text-muted-foreground text-center py-3">No admin actions on this user yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" /> Admin Action History ({auditLog.data.length})
        </h4>
        <div className="space-y-1.5">
          {auditLog.data.map((entry) => {
            const details = entry.details as Record<string, unknown> | null;
            return (
              <div key={entry.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                <div className="flex items-center gap-2">
                  <AuditActionBadge action={entry.action} />
                  <span className="text-muted-foreground">by {entry.adminName || `Admin #${entry.adminUserId}`}</span>
                  {details && (
                    <span className="flex items-center gap-0.5">
                      {entry.action === "update_role" && (
                        <>
                          <span className="text-muted-foreground">{String(details.previousRole)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{String(details.newRole)}</span>
                        </>
                      )}
                      {entry.action === "update_tier" && (
                        <>
                          <span className="text-muted-foreground">{String(details.previousTier)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{String(details.newTier)}</span>
                        </>
                      )}
                      {entry.action === "reset_monthly_count" && (
                        <>
                          <span className="text-muted-foreground">{String(details.previousCount)}</span>
                          <ArrowDownRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">0</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground whitespace-nowrap ml-2">
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const TIER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  free: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  artist: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  pro: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
};

const TIER_ORDER: Record<string, number> = { free: 0, artist: 1, pro: 2 };

function TierTimeline({ userId, open, userCreatedAt, currentTier }: {
  userId: number | null;
  open: boolean;
  userCreatedAt: string | Date;
  currentTier: string;
}) {
  const tierHistory = trpc.admin.getTierChangeHistory.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  );

  // Build timeline events: start with account creation, then each tier change
  const events: Array<{ date: Date; fromTier: string; toTier: string; adminName: string | null; isCreation: boolean }> = [];

  // Account creation event
  const createdDate = new Date(userCreatedAt);
  events.push({ date: createdDate, fromTier: "", toTier: "free", adminName: null, isCreation: true });

  // Tier change events from audit log
  if (tierHistory.data) {
    for (const entry of tierHistory.data) {
      const details = entry.details as Record<string, unknown> | null;
      if (details) {
        events.push({
          date: new Date(entry.createdAt),
          fromTier: String(details.previousTier || "unknown"),
          toTier: String(details.newTier || "unknown"),
          adminName: entry.adminName || null,
          isCreation: false,
        });
      }
    }
  }

  if (tierHistory.isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Subscription Timeline
          </h4>
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" /> Subscription Timeline
        </h4>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-3">
            {events.map((event, i) => {
              const tierColor = TIER_COLORS[event.toTier] || TIER_COLORS.free;
              const isUpgrade = !event.isCreation && (TIER_ORDER[event.toTier] ?? 0) > (TIER_ORDER[event.fromTier] ?? 0);
              const isDowngrade = !event.isCreation && (TIER_ORDER[event.toTier] ?? 0) < (TIER_ORDER[event.fromTier] ?? 0);

              return (
                <div key={i} className="flex items-start gap-3 relative pl-5">
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-background ${tierColor.dot}`} />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {event.isCreation ? (
                        <span className="text-xs font-medium">Account Created</span>
                      ) : (
                        <div className="flex items-center gap-1 text-xs">
                          <TierBadge tier={event.fromTier} />
                          {isUpgrade ? (
                            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                          ) : isDowngrade ? (
                            <ArrowDownRight className="h-3 w-3 text-red-400" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <TierBadge tier={event.toTier} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {format(event.date, "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      {event.adminName && (
                        <span className="text-[10px] text-muted-foreground">
                          by {event.adminName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Current state indicator */}
            <div className="flex items-start gap-3 relative pl-5">
              <div className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-background ${TIER_COLORS[currentTier]?.dot || TIER_COLORS.free.dot} ring-2 ring-offset-1 ring-offset-background ${currentTier === 'pro' ? 'ring-primary/30' : currentTier === 'artist' ? 'ring-amber-400/30' : 'ring-zinc-400/30'}`} />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Current:</span>
                <TierBadge tier={currentTier} />
                <span className="text-[10px] text-muted-foreground">
                  ({formatDistanceToNow(events[events.length - 1]?.date || createdDate)} on this tier)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UserDetailModal({ userId, open, onOpenChange }: UserDetailModalProps) {
  const utils = trpc.useUtils();
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [pendingRole, setPendingRole] = useState<"user" | "admin" | null>(null);

  const detail = trpc.admin.getUserDetail.useQuery(
    { userId: userId! },
    { enabled: !!userId && open }
  );

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      utils.admin.getUserDetail.invalidate({ userId: userId! });
      utils.admin.getUsers.invalidate();
      utils.admin.getStats.invalidate();
      utils.admin.getUserAuditLog.invalidate({ userId: userId! });
      setShowRoleConfirm(false);
      setPendingRole(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTier = trpc.admin.updateTier.useMutation({
    onSuccess: () => {
      toast.success("User tier updated");
      utils.admin.getUserDetail.invalidate({ userId: userId! });
      utils.admin.getUsers.invalidate();
      utils.admin.getStats.invalidate();
      utils.admin.getUserAuditLog.invalidate({ userId: userId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const resetCount = trpc.admin.resetMonthlyCount.useMutation({
    onSuccess: () => {
      toast.success("Monthly review count reset");
      utils.admin.getUserDetail.invalidate({ userId: userId! });
      utils.admin.getUserAuditLog.invalidate({ userId: userId! });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRoleChange = (role: "user" | "admin") => {
    setPendingRole(role);
    setShowRoleConfirm(true);
  };

  const confirmRoleChange = () => {
    if (userId && pendingRole) {
      updateRole.mutate({ userId, role: pendingRole });
    }
  };

  const user = detail.data;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              User Details
            </DialogTitle>
          </DialogHeader>

          {detail.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : user ? (
            <div className="space-y-4">
              {/* User Identity */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{user.name || "Unnamed User"}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email || "No email"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    ID: {user.id} | OpenID: {user.openId.slice(0, 12)}...
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.role === "admin" ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Shield className="h-3 w-3 mr-1" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">User</Badge>
                  )}
                  <TierBadge tier={user.tier} />
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3 px-3 text-center">
                    <FolderOpen className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <div className="text-xl font-bold">{user.stats.totalProjects}</div>
                    <div className="text-xs text-muted-foreground">Projects</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-3 text-center">
                    <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <div className="text-xl font-bold">{user.stats.totalReviews}</div>
                    <div className="text-xs text-muted-foreground">Reviews</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-3 text-center">
                    <Music className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <div className="text-xl font-bold">{user.stats.totalTracks}</div>
                    <div className="text-xs text-muted-foreground">Tracks</div>
                  </CardContent>
                </Card>
              </div>

              {/* Account Details */}
              <Card>
                <CardContent className="pt-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> Joined
                    </span>
                    <span>{format(new Date(user.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Last Active
                    </span>
                    <span>{formatDistanceToNow(new Date(user.lastSignedIn), { addSuffix: true })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly Reviews</span>
                    <span className="font-mono">{user.monthlyReviewCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Audio Minutes</span>
                    <span className="font-mono">{user.audioMinutesUsed} / {user.audioMinutesLimit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Digest</span>
                    <span className="capitalize">{user.digestFrequency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Persona</span>
                    <span className="capitalize">{user.preferredPersona}</span>
                  </div>
                  {user.stripeSubscriptionId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stripe Sub</span>
                      <span className="font-mono text-xs">{user.stripeSubscriptionId.slice(0, 20)}...</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Admin Actions */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <h4 className="text-sm font-medium">Admin Actions</h4>

                  {/* Role Management */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={user.role === "admin" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleRoleChange("admin")}
                        disabled={user.role === "admin" || updateRole.isPending}
                      >
                        <Shield className="h-3 w-3 mr-1" /> Promote to Admin
                      </Button>
                      <Button
                        variant={user.role === "user" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleRoleChange("user")}
                        disabled={user.role === "user" || updateRole.isPending}
                      >
                        <ShieldOff className="h-3 w-3 mr-1" /> Demote to User
                      </Button>
                    </div>
                  </div>

                  {/* Tier Management */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tier</span>
                    <Select
                      value={user.tier}
                      onValueChange={(val) => {
                        if (userId) updateTier.mutate({ userId, tier: val as "free" | "artist" | "pro" });
                      }}
                      disabled={updateTier.isPending}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="artist">Artist</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reset Monthly Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Count</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (userId) resetCount.mutate({ userId });
                      }}
                      disabled={resetCount.isPending || user.monthlyReviewCount === 0}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset to 0
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Action History (Audit Log) */}
              <UserAuditHistory userId={userId} open={open} />

              {/* Subscription Lifecycle Timeline */}
              <TierTimeline userId={userId} open={open} userCreatedAt={user.createdAt} currentTier={user.tier} />

              {/* Recent Reviews */}
              {user.recentReviews.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium mb-2">Recent Reviews</h4>
                    <div className="space-y-1.5">
                      {user.recentReviews.map((r) => (
                        <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {r.reviewType === "album" ? "Album" : r.reviewType === "comparison" ? "Compare" : "Track"}
                            </Badge>
                            <span>Review #{r.id}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">User not found</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={showRoleConfirm} onOpenChange={setShowRoleConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Role Change
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingRole === "admin"
              ? `Promote "${user?.name || "this user"}" to Admin? They will gain full access to the admin dashboard and user management.`
              : `Demote "${user?.name || "this user"}" to regular User? They will lose admin dashboard access.`}
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowRoleConfirm(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={pendingRole === "admin" ? "default" : "destructive"}
              onClick={confirmRoleChange}
              disabled={updateRole.isPending}
            >
              {pendingRole === "admin" ? (
                <><Crown className="h-3.5 w-3.5 mr-1" /> Promote</>
              ) : (
                <><ShieldOff className="h-3.5 w-3.5 mr-1" /> Demote</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

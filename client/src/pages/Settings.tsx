import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { User, Crown, CreditCard, Bell, Shield, Calendar, Music, Zap, ExternalLink, Loader2, AlertTriangle, Send, Mail, Clock, Eye } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  artist: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  pro: "bg-primary/20 text-primary border-primary/30",
};

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  artist: "Artist",
  pro: "Pro",
};

export default function Settings() {
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const subscriptionQuery = trpc.subscription.status.useQuery(undefined, {
    retry: false,
  });

  const checkoutMutation = trpc.subscription.checkout.useMutation({
    onSuccess: ({ url }) => {
      if (url) {
        window.open(url, "_blank");
        toast.info("Redirecting to checkout...");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to start checkout");
    },
  });

  const billingMutation = trpc.subscription.manageBilling.useMutation({
    onSuccess: ({ url }) => {
      if (url) {
        window.open(url, "_blank");
        toast.info("Opening billing portal...");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to open billing portal");
    },
  });

  const deleteAccountMutation = trpc.subscription.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted. Redirecting...");
      setDeleteDialogOpen(false);
      // Redirect to landing page after a short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete account");
    },
  });

  const tier = subscriptionQuery.data?.tier ?? user?.tier ?? "free";
  const sub = subscriptionQuery.data?.subscription;

  const handleUpgrade = (plan: "artist" | "pro") => {
    checkoutMutation.mutate({ plan, origin: window.location.origin });
  };

  const handleManageBilling = () => {
    billingMutation.mutate({ origin: window.location.origin });
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmation !== "DELETE") return;
    deleteAccountMutation.mutate({ confirmation: "DELETE" });
  };

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, subscription, and preferences</p>
      </div>

      {/* Account Section */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Account</CardTitle>
              <CardDescription>Your profile information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <span className="text-muted-foreground font-medium">Name</span>
            <span>{user?.name || "—"}</span>
            <span className="text-muted-foreground font-medium">Email</span>
            <span className="flex items-center gap-2">
              {user?.email || "—"}
              {user?.email && (
                user?.emailVerified ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">Verified</Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">Unverified</Badge>
                )
              )}
            </span>
            <span className="text-muted-foreground font-medium">Role</span>
            <span className="capitalize">{user?.role || "user"}</span>
            <span className="text-muted-foreground font-medium">Member since</span>
            <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Section */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Subscription</CardTitle>
                <Badge variant="outline" className={TIER_COLORS[tier]}>
                  {TIER_LABELS[tier] || tier}
                </Badge>
              </div>
              <CardDescription>Manage your plan and billing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {subscriptionQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription details...
            </div>
          ) : (
            <>
              {/* Current plan details */}
              <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current Plan</span>
                  <span className="text-sm font-semibold">
                    {tier === "free" ? "Free" : tier === "artist" ? "$19/month" : "$49/month"}
                  </span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Audio minutes</span>
                  </div>
                  <span className="text-right">
                    {subscriptionQuery.data?.audioMinutesUsed ?? 0} / {subscriptionQuery.data?.audioMinutesLimit ?? 60} min
                  </span>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Reviews</span>
                  </div>
                  <span className="text-right">
                    {tier === "free" ? "1/month" : "Unlimited"}
                  </span>
                </div>
                {sub && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Renews</span>
                      </div>
                      <span className="text-right">
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Status</span>
                      </div>
                      <span className="text-right capitalize">
                        {sub.cancelAtPeriodEnd ? (
                          <span className="text-amber-400">Cancels at period end</span>
                        ) : (
                          <span className="text-green-400">{sub.status}</span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {tier === "free" && (
                  <>
                    <Button
                      onClick={() => handleUpgrade("artist")}
                      disabled={checkoutMutation.isPending}
                      className="gap-2"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4" />
                      )}
                      Upgrade to Artist — $19/mo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpgrade("pro")}
                      disabled={checkoutMutation.isPending}
                      className="gap-2"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Upgrade to Pro — $49/mo
                    </Button>
                  </>
                )}
                {tier === "artist" && (
                  <Button
                    onClick={() => handleUpgrade("pro")}
                    disabled={checkoutMutation.isPending}
                    className="gap-2"
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Upgrade to Pro — $49/mo
                  </Button>
                )}
                {tier !== "free" && subscriptionQuery.data?.stripeCustomerId && (
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={billingMutation.isPending}
                    className="gap-2"
                  >
                    {billingMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Manage Billing
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Bell className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Notifications</CardTitle>
              <CardDescription>Choose which notifications you want to receive</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <NotificationPreferencesSection />
        </CardContent>
      </Card>

      {/* Digest Preferences */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Digest Preferences</CardTitle>
              <CardDescription>Control how often you receive digest summaries</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DigestPreferencesSection />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0 ml-4"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeleteConfirmation("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <span className="block">This action is <strong className="text-foreground">permanent and irreversible</strong>. Deleting your account will:</span>
              <span className="block text-sm space-y-1">
                <span className="block">• Cancel any active subscription immediately</span>
                <span className="block">• Remove access to all your projects and reviews</span>
                <span className="block">• Delete your profile and usage data</span>
              </span>
              <span className="block pt-1">
                Type <strong className="text-foreground font-mono">DELETE</strong> below to confirm.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Type DELETE to confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== "DELETE" || deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DIGEST_OPTIONS = [
  { value: "weekly", label: "Weekly", description: "Every Monday morning" },
  { value: "biweekly", label: "Bi-weekly", description: "Every other Monday" },
  { value: "monthly", label: "Monthly", description: "First Monday of each month" },
  { value: "disabled", label: "Disabled", description: "No digest emails" },
] as const;

function DigestPreferencesSection() {
  const prefsQuery = trpc.digest.getPreferences.useQuery();
  const updateMutation = trpc.digest.updatePreferences.useMutation({
    onSuccess: (data) => {
      prefsQuery.refetch();
      const label = DIGEST_OPTIONS.find(o => o.value === data.frequency)?.label ?? data.frequency;
      toast.success(`Digest frequency updated to ${label}`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to update digest preferences");
    },
  });

  const sendTestMutation = trpc.digest.sendTest.useMutation({
    onSuccess: (data) => {
      prefsQuery.refetch();
      toast.success(`Test digest sent to ${data.email}`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || "Failed to send test digest");
    },
  });

  const [showPreview, setShowPreview] = useState(false);
  const previewQuery = trpc.digest.preview.useQuery(undefined, {
    enabled: showPreview,
  });

  const currentFrequency = prefsQuery.data?.frequency ?? "weekly";
  const lastDigestSentAt = prefsQuery.data?.lastDigestSentAt;

  const formatLastSent = (ts: number | null | undefined) => {
    if (!ts) return null;
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return "Less than an hour ago";
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Choose how often you'd like to receive a summary of your review activity, scores, and project progress.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DIGEST_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              if (option.value !== currentFrequency) {
                updateMutation.mutate({ frequency: option.value });
              }
            }}
            disabled={updateMutation.isPending}
            className={`text-left p-4 rounded-lg border transition-all ${
              currentFrequency === option.value
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/50 hover:border-border hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{option.label}</span>
              {currentFrequency === option.value && (
                <Badge variant="outline" className="text-xs border-primary/50 text-primary">Active</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </button>
        ))}
      </div>

      {currentFrequency === "disabled" && (
        <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          You won't receive any digest emails. You can still generate digests manually from the Digest page.
        </p>
      )}

      {/* Last digest sent + test button */}
      <Separator className="opacity-50" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {lastDigestSentAt
              ? <>Last digest sent: <span className="text-foreground font-medium">{formatLastSent(lastDigestSentAt)}</span></>
              : "No digest sent yet"
            }
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="shrink-0"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendTestMutation.mutate()}
            disabled={sendTestMutation.isPending}
            className="shrink-0"
          >
            {sendTestMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-3.5 w-3.5 mr-1.5" /> Send Test Digest</>
            )}
          </Button>
        </div>
      </div>

      {/* Digest Preview Modal */}
      {showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Weekly Digest Preview
              </DialogTitle>
              <DialogDescription>
                This is what your weekly email will look like based on your current data.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto rounded-lg border border-border/50">
              {previewQuery.isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Generating preview...</span>
                </div>
              ) : previewQuery.error ? (
                <div className="flex items-center justify-center py-16 text-sm text-destructive">
                  Failed to load preview: {previewQuery.error.message}
                </div>
              ) : previewQuery.data ? (
                <iframe
                  srcDoc={previewQuery.data.htmlContent}
                  className="w-full h-[500px] border-0"
                  title="Digest Preview"
                  sandbox="allow-same-origin"
                />
              ) : null}
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  sendTestMutation.mutate();
                  setShowPreview(false);
                }}
                disabled={sendTestMutation.isPending}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send This to My Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


const NOTIFICATION_TYPES = [
  { key: "review_complete" as const, label: "Review Complete", description: "When your AI review finishes processing", icon: Music },
  { key: "collaboration_invite" as const, label: "Collaboration Invites", description: "When someone invites you to collaborate on a project", icon: User },
  { key: "collaboration_accepted" as const, label: "Collaboration Accepted", description: "When someone accepts your collaboration invite", icon: User },
  { key: "digest" as const, label: "Weekly Digest", description: "Periodic summary of your review activity and scores", icon: Mail },
  { key: "payment_failed" as const, label: "Payment Alerts", description: "Important billing and subscription notifications", icon: CreditCard },
  { key: "system" as const, label: "System Updates", description: "Platform announcements and feature updates", icon: Bell },
];

function NotificationPreferencesSection() {
  const { data: prefs, isLoading } = trpc.notification.getPreferences.useQuery();
  const utils = trpc.useUtils();
  const updatePrefs = trpc.notification.updatePreferences.useMutation({
    onMutate: async (newPrefs) => {
      await utils.notification.getPreferences.cancel();
      const prev = utils.notification.getPreferences.getData();
      utils.notification.getPreferences.setData(undefined, (old) => old ? { ...old, ...newPrefs } : old);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.notification.getPreferences.setData(undefined, context.prev);
      toast.error("Failed to update preferences");
    },
    onSettled: () => utils.notification.getPreferences.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between py-3 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted/50 rounded" />
            </div>
            <div className="h-6 w-10 bg-muted rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div className="space-y-1">
      {NOTIFICATION_TYPES.map(({ key, label, description, icon: Icon }, idx) => (
        <div key={key}>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-start gap-3">
              <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(checked) => updatePrefs.mutate({ [key]: checked })}
            />
          </div>
          {idx < NOTIFICATION_TYPES.length - 1 && <Separator className="opacity-30" />}
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-2">
        Disabling a notification type will prevent it from appearing in your notification center. Critical security alerts cannot be disabled.
      </p>
    </div>
  );
}

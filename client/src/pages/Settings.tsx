import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
import { User, Crown, CreditCard, Bell, Shield, Calendar, Music, Zap, ExternalLink, Loader2, AlertTriangle } from "lucide-react";

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
            <span>{user?.email || "—"}</span>
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
                    {tier === "free" ? "3/month" : "Unlimited"}
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
              <CardDescription>How you receive updates about your reviews</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 bg-card/50 p-4">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Review notifications</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll receive in-app notifications when your AI reviews are complete, when batch jobs finish, and when payment events occur.
                  Notification preferences can be managed from the Dashboard settings panel.
                </p>
              </div>
            </div>
          </div>
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

  const currentFrequency = prefsQuery.data?.frequency ?? "weekly";

  return (
    <div className="space-y-4">
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
    </div>
  );
}

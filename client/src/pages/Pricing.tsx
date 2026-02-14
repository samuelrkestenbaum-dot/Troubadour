import { Check, X, Zap, Crown, Music, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { trackCheckoutStarted, trackUpgradeClicked } from "@/lib/analytics";

const PLANS = [
  {
    key: "free" as const,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try Troubadour with basic features",
    icon: Music,
    color: "text-muted-foreground",
    bgGradient: "from-slate-800/50 to-slate-900/50",
    borderColor: "border-border/50",
    features: [
      { text: "3 AI reviews per month", included: true },
      { text: "Basic audio analysis", included: true },
      { text: "Genre detection", included: true },
      { text: "Score breakdown", included: true },
      { text: "Version comparison", included: false },
      { text: "Smart re-review", included: false },
      { text: "AI chat follow-ups", included: false },
      { text: "Shareable review links", included: false },
      { text: "Album-level A&R memos", included: false },
    ],
  },
  {
    key: "artist" as const,
    name: "Artist",
    price: "$19",
    period: "/month",
    description: "For serious musicians and producers",
    icon: Zap,
    color: "text-amber-400",
    bgGradient: "from-amber-950/30 to-slate-900/50",
    borderColor: "border-amber-500/30",
    popular: true,
    features: [
      { text: "Unlimited AI reviews", included: true },
      { text: "Full audio analysis", included: true },
      { text: "All review focus modes", included: true },
      { text: "Version comparison", included: true },
      { text: "Smart re-review with context", included: true },
      { text: "AI chat follow-ups", included: true },
      { text: "Reference track comparison", included: true },
      { text: "Shareable review links", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Album-level A&R memos", included: false },
    ],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "For labels, A&R, and power users",
    icon: Crown,
    color: "text-violet-400",
    bgGradient: "from-violet-950/30 to-slate-900/50",
    borderColor: "border-violet-500/30",
    features: [
      { text: "Everything in Artist", included: true },
      { text: "480+ audio minutes/month", included: true },
      { text: "Album-level A&R memos", included: true },
      { text: "Priority job processing", included: true },
      { text: "Batch review all tracks", included: true },
      { text: "Export reviews (MD/PDF)", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Tag & label system", included: true },
      { text: "Dedicated support", included: true },
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const checkoutMutation = trpc.subscription.checkout.useMutation({
    onSuccess: (data) => {
      toast.success("Redirecting to checkout...");
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err.message);
      setLoadingPlan(null);
    },
  });

  const handleUpgrade = (plan: "artist" | "pro") => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    trackUpgradeClicked(user.tier || "free", plan, "pricing_page");
    trackCheckoutStarted(plan);
    setLoadingPlan(plan);
    checkoutMutation.mutate({
      plan,
      origin: window.location.origin,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(user ? "/dashboard" : "/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
          </div>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-sm">
              <Music className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: "'UnifrakturMaguntia', 'Space Grotesk', system-ui, sans-serif" }}>Troubadour</span>
          </div>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </nav>

      {/* Header */}
      <div className="text-center pt-12 pb-12 px-4">
        <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
          Simple Pricing
        </Badge>
        <h1 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold mb-4">
          Choose your plan
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Start free, upgrade when you need more. Every plan includes our core AI critique engine.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrentPlan = user?.tier === plan.key;
          const Icon = plan.icon;

          return (
            <Card
              key={plan.key}
              className={`relative bg-gradient-to-b ${plan.bgGradient} ${plan.borderColor} border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                  MOST POPULAR
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg bg-background/50 ${plan.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-['Space_Grotesk'] text-xl">{plan.name}</CardTitle>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-['Space_Grotesk']">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={feature.included ? "text-foreground" : "text-muted-foreground/50"}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.key === "free" ? (
                    user ? (
                      user.tier === "free" ? (
                        <Button variant="outline" className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full text-muted-foreground"
                          onClick={() => toast.info("To downgrade, cancel your subscription from Settings → Subscription, or contact support.")}
                        >
                          Downgrade
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => window.location.href = getLoginUrl()}
                      >
                        Get Started Free
                      </Button>
                    )
                  ) : (
                    <Button
                      className={`w-full ${plan.key === "artist" ? "bg-amber-500 hover:bg-amber-600 text-black" : "bg-violet-500 hover:bg-violet-600"}`}
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={!!loadingPlan || checkoutMutation.isPending}
                    >
                      {loadingPlan === plan.key
                        ? "Redirecting..."
                        : !user
                          ? `Get Started with ${plan.name}`
                          : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Can I cancel anytime?</h3>
            <p className="text-muted-foreground text-sm">
              Yes. Cancel from your billing portal anytime. You'll keep access until the end of your billing period.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">What counts as an audio minute?</h3>
            <p className="text-muted-foreground text-sm">
              Each track's duration in minutes is counted when you run an analysis. A 4-minute song uses 4 audio minutes.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Can I upgrade mid-cycle?</h3>
            <p className="text-muted-foreground text-sm">
              Absolutely. Upgrading is prorated — you only pay the difference for the remaining days in your billing cycle.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Do you offer team plans?</h3>
            <p className="text-muted-foreground text-sm">
              Not yet, but it's on the roadmap. For now, Pro plan users get everything they need for label-level workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

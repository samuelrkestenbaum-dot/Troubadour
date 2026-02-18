import { useState } from "react";
import { useLocation } from "wouter";
import { X, Sparkles, Zap, Crown, ArrowRight, Music, BarChart3, Target, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UpgradePromptProps {
  /** The error message from the FORBIDDEN response */
  message: string;
  /** Called when user dismisses the prompt */
  onDismiss: () => void;
  /** Optional: which feature triggered the limit */
  trigger?: "review" | "feature" | "upload";
}

const TIER_BENEFITS = [
  {
    tier: "Artist",
    price: "$9.99/mo",
    color: "from-blue-500 to-indigo-600",
    icon: Music,
    highlights: [
      "10 AI reviews per month",
      "All Action Modes (Mix Check, Hook Test, etc.)",
      "Skill Progression tracking",
      "Competitive Benchmarking",
    ],
  },
  {
    tier: "Pro",
    price: "$24.99/mo",
    color: "from-amber-500 to-orange-600",
    icon: Crown,
    highlights: [
      "Unlimited AI reviews",
      "Priority processing (2x faster)",
      "Release Readiness scoring",
      "Artist DNA profiling",
      "Full Intelligence Suite",
    ],
  },
];

export function UpgradePrompt({ message, onDismiss, trigger = "review" }: UpgradePromptProps) {
  const [, navigate] = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss();
  };

  const headlineMap = {
    review: "You've used your free review",
    feature: "This feature requires an upgrade",
    upload: "You've hit your upload limit",
  };

  const subtitleMap = {
    review: "Your free taste of Troubadour is done. Upgrade to keep getting real feedback on your music.",
    feature: "This feature is available on a paid plan. Unlock it to take your music further.",
    upload: "You've reached your upload limit for this month. Upgrade for more capacity.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              Upgrade Available
            </Badge>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {headlineMap[trigger]}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {subtitleMap[trigger]}
          </p>
        </div>

        {/* Tier cards */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-3">
          {TIER_BENEFITS.map((tier) => (
            <button
              key={tier.tier}
              onClick={() => {
                handleDismiss();
                navigate("/pricing");
              }}
              className="group text-left p-4 rounded-xl border border-border/50 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5 bg-muted/20 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${tier.color}`}>
                  <tier.icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold">{tier.tier}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{tier.price}</span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {tier.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Zap className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                View plan <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
          <Button
            onClick={() => {
              handleDismiss();
              navigate("/pricing");
            }}
            className="gap-2"
          >
            <Crown className="h-4 w-4" />
            View Plans
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage upgrade prompt state.
 * Usage:
 *   const { showUpgrade, upgradeProps } = useUpgradePrompt();
 *   // In mutation onError:
 *   if (err.data?.code === "FORBIDDEN") showUpgrade(err.message, "review");
 *   // In JSX:
 *   {upgradeProps && <UpgradePrompt {...upgradeProps} />}
 */
export function useUpgradePrompt() {
  const [upgradeState, setUpgradeState] = useState<{
    message: string;
    trigger: "review" | "feature" | "upload";
  } | null>(null);

  const showUpgrade = (message: string, trigger: "review" | "feature" | "upload" = "review") => {
    setUpgradeState({ message, trigger });
  };

  const upgradeProps = upgradeState
    ? {
        message: upgradeState.message,
        trigger: upgradeState.trigger,
        onDismiss: () => setUpgradeState(null),
      }
    : null;

  return { showUpgrade, upgradeProps };
}

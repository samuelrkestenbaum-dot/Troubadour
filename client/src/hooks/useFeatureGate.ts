import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

/**
 * Feature-to-tier mapping. Mirrors server-side isFeatureGated in products.ts.
 * "free" = available to all, "artist" = artist+pro, "pro" = pro only.
 */
const FEATURE_TIERS: Record<string, "free" | "artist" | "pro"> = {
  // Free tier features
  basicReview: "free",
  audioAnalysis: "free",
  genreDetection: "free",

  // Artist tier features
  versionComparison: "artist",
  smartReReview: "artist",
  aiChat: "artist",
  referenceComparison: "artist",
  shareLinks: "artist",
  analytics: "artist",

  // Pro tier features
  albumReview: "pro",
  batchReview: "pro",
  exportReview: "pro",
  tagSystem: "pro",
};

const TIER_RANK: Record<string, number> = {
  free: 0,
  artist: 1,
  pro: 2,
};

type FeatureKey = keyof typeof FEATURE_TIERS;

/**
 * Centralized feature gating hook.
 *
 * Usage:
 *   const { canAccess, guardAction } = useFeatureGate();
 *
 *   // Check access silently
 *   if (canAccess("aiChat")) { ... }
 *
 *   // Guard an action with toast + redirect
 *   guardAction("exportReview", () => handleExport());
 */
export function useFeatureGate() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const userTier = user?.tier || "free";
  const userRank = TIER_RANK[userTier] ?? 0;

  function canAccess(feature: FeatureKey): boolean {
    const requiredTier = FEATURE_TIERS[feature];
    if (!requiredTier) return true; // unknown features are allowed
    const requiredRank = TIER_RANK[requiredTier] ?? 0;
    return userRank >= requiredRank;
  }

  function requiredTier(feature: FeatureKey): string {
    return FEATURE_TIERS[feature] || "free";
  }

  /**
   * Run `action` if the user has access to `feature`.
   * Otherwise, show an upgrade toast and optionally redirect to /pricing.
   */
  function guardAction(feature: FeatureKey, action: () => void, options?: { redirect?: boolean }) {
    if (canAccess(feature)) {
      action();
    } else {
      const tier = requiredTier(feature);
      const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
      toast.error(`This feature requires the ${tierLabel} plan`, {
        action: {
          label: "Upgrade",
          onClick: () => navigate("/pricing"),
        },
      });
      if (options?.redirect) {
        navigate("/pricing");
      }
    }
  }

  return { canAccess, guardAction, requiredTier, userTier };
}

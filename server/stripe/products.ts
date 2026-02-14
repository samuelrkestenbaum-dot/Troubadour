/**
 * Troubadour Subscription Plans
 * 
 * Free: 3 reviews/month, basic features
 * Artist ($19/mo): 120 min, all features
 * Pro ($49/mo): 480 min, priority, all features
 */

export const PLANS = {
  free: {
    name: "Free",
    tier: "free" as const,
    audioMinutesLimit: 60,
    monthlyReviewLimit: 3,
    priceMonthly: 0,
    features: [
      "3 AI reviews per month",
      "Basic audio analysis",
      "Genre detection",
      "Score breakdown",
    ],
    gatedFeatures: [] as string[],
  },
  artist: {
    name: "Artist",
    tier: "artist" as const,
    audioMinutesLimit: 240,
    monthlyReviewLimit: 999,
    priceMonthly: 1900, // $19.00 in cents
    stripePriceId: "", // Will be created dynamically or set via env
    features: [
      "Unlimited AI reviews",
      "All review focus modes",
      "Version comparison",
      "Smart re-review with context",
      "AI chat follow-ups",
      "Reference track comparison",
      "Shareable review links",
      "Analytics dashboard",
    ],
    gatedFeatures: ["version_comparison", "re_review", "chat", "reference", "share", "analytics"],
  },
  pro: {
    name: "Pro",
    tier: "pro" as const,
    audioMinutesLimit: 720,
    monthlyReviewLimit: 999,
    priceMonthly: 4900, // $49.00 in cents
    stripePriceId: "", // Will be created dynamically or set via env
    features: [
      "Everything in Artist",
      "480+ audio minutes/month",
      "Album-level A&R memos",
      "Priority job processing",
      "Batch review all tracks",
      "Export reviews (Markdown/PDF)",
    ],
    gatedFeatures: ["album_review", "batch_review", "export", "priority"],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByTier(tier: string) {
  return Object.values(PLANS).find(p => p.tier === tier) ?? PLANS.free;
}

export function isFeatureGated(tier: string, feature: string): boolean {
  // Free users: check if feature is gated behind artist or pro
  if (tier === "free") {
    return (PLANS.artist.gatedFeatures as readonly string[]).includes(feature) || (PLANS.pro.gatedFeatures as readonly string[]).includes(feature);
  }
  // Artist users: check if feature is gated behind pro only
  if (tier === "artist") {
    return (PLANS.pro.gatedFeatures as readonly string[]).includes(feature);
  }
  // Pro users: nothing is gated
  return false;
}

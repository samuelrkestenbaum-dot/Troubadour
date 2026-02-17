/**
 * Shared gating / guard helpers used across all router files.
 * Extracted from routers.ts to avoid circular imports.
 */
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { isFeatureGated, PLANS, getPlanByTier } from "./stripe/products";

export const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
  "audio/ogg", "audio/flac", "audio/webm",
]);

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function assertUsageAllowed(userId: number) {
  // Auto-reset monthly counters if needed
  await db.resetMonthlyUsageIfNeeded(userId);
  const user = await db.getUserById(userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  if (user.audioMinutesUsed >= user.audioMinutesLimit) {
    const tierLabel = user.tier === "free" ? "Free" : user.tier === "artist" ? "Artist" : "Pro";
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've used ${user.audioMinutesUsed} of your ${user.audioMinutesLimit} minute ${tierLabel} plan limit. Upgrade your plan for more capacity.`,
    });
  }
}

export function assertFeatureAllowed(tier: string, feature: string) {
  if (isFeatureGated(tier, feature)) {
    const requiredTier = (PLANS.artist.gatedFeatures as readonly string[]).includes(feature) ? "Artist" : "Pro";
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This feature requires the ${requiredTier} plan. Upgrade at /pricing to unlock it.`,
    });
  }
}

export async function assertMonthlyReviewAllowed(userId: number) {
  await db.resetMonthlyUsageIfNeeded(userId);
  const user = await db.getUserById(userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  const plan = getPlanByTier(user.tier);
  if (user.monthlyReviewCount >= plan.monthlyReviewLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've used ${user.monthlyReviewCount} of your ${plan.monthlyReviewLimit} monthly reviews on the ${plan.name} plan. Upgrade for unlimited reviews.`,
    });
  }
}

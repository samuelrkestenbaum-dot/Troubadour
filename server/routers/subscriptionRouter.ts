import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { getPlanByTier } from "../stripe/products";
import { logAuditEvent } from "../utils/auditTrail";

export const subscriptionRouter = {
  // ── Usage ──
  usage: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const plan = getPlanByTier(user.tier);
      // Compute next reset date (1st of next month)
      const resetAt = new Date(user.monthlyResetAt);
      const nextReset = new Date(resetAt.getFullYear(), resetAt.getMonth() + 1, 1);
      return {
        audioMinutesUsed: user.audioMinutesUsed,
        audioMinutesLimit: user.audioMinutesLimit,
        tier: user.tier,
        monthlyReviewCount: user.monthlyReviewCount,
        monthlyReviewLimit: plan.monthlyReviewLimit,
        monthlyResetDate: nextReset.toISOString(),
      };
    }),
  }),

  // ── Subscription ──
  subscription: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      let subscriptionDetails = null;
      if (user.stripeSubscriptionId) {
        try {
          const { getSubscriptionDetails } = await import("../stripe/stripe");
          subscriptionDetails = await getSubscriptionDetails(user.stripeSubscriptionId);
        } catch { /* Stripe not configured */ }
      }
      return {
        tier: user.tier,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        audioMinutesUsed: user.audioMinutesUsed,
        audioMinutesLimit: user.audioMinutesLimit,
        subscription: subscriptionDetails,
      };
    }),

    checkout: protectedProcedure
      .input(z.object({
        plan: z.enum(["artist", "pro"]),
        origin: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Email required for checkout" });

        const { PLANS } = await import("../stripe/products");
        const plan = PLANS[input.plan];

        // Create or get Stripe products/prices dynamically
        const { getStripe, createCheckoutSession } = await import("../stripe/stripe");
        const stripe = getStripe();

        // Find or create the price
        let priceId: string = plan.stripePriceId as string;
        if (!priceId) {
          // Search for existing product
          const products = await stripe.products.list({ limit: 10 });
          let product = products.data.find(p => p.metadata?.tier === input.plan);
          if (!product) {
            product = await stripe.products.create({
              name: `Troubadour ${plan.name}`,
              description: `${plan.name} plan - ${plan.features.join(", ")}`,
              metadata: { tier: input.plan },
            });
          }
          // Find or create price
          const prices = await stripe.prices.list({ product: product.id, active: true, limit: 5 });
          const existingPrice = prices.data.find(p => p.unit_amount === plan.priceMonthly && p.recurring?.interval === "month");
          if (existingPrice) {
            priceId = existingPrice.id;
          } else {
            const newPrice = await stripe.prices.create({
              product: product.id,
              unit_amount: plan.priceMonthly,
              currency: "usd",
              recurring: { interval: "month" },
            });
            priceId = newPrice.id;
          }
        }

        const { url } = await createCheckoutSession({
          userId: ctx.user.id,
          email: user.email,
          name: user.name ?? undefined,
          stripeCustomerId: user.stripeCustomerId,
          priceId,
          origin: input.origin,
        });

        logAuditEvent({ userId: ctx.user.id, action: "subscription.checkout", resourceType: "subscription", metadata: { plan: input.plan } });
        return { url };
      }),

    manageBilling: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        if (!user.stripeCustomerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found" });
        }
        const { createBillingPortalSession } = await import("../stripe/stripe");
        const { url } = await createBillingPortalSession({
          stripeCustomerId: user.stripeCustomerId,
          origin: input.origin,
        });
        return { url };
      }),

    deleteAccount: protectedProcedure
      .input(z.object({ confirmation: z.literal("DELETE") }))
      .mutation(async ({ ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        // Cancel active Stripe subscription if exists
        if (user.stripeSubscriptionId) {
          try {
            const { getStripe } = await import("../stripe/stripe");
            const stripe = getStripe();
            await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            console.log(`[DeleteAccount] Cancelled Stripe subscription ${user.stripeSubscriptionId} for user ${user.id}`);
          } catch (err: any) {
            console.warn(`[DeleteAccount] Failed to cancel Stripe subscription: ${err.message}`);
            // Continue with deletion even if Stripe cancel fails
          }
        }

        // Soft-delete the user (sets deletedAt, clears subscription data, zeroes limits)
        await db.softDeleteUser(user.id);
        console.log(`[DeleteAccount] Soft-deleted user ${user.id} (${user.email})`);

        // Clear the session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

        return { success: true };
      }),
  }),
};

import { Request, Response } from "express";
import Stripe from "stripe";
import { constructWebhookEvent } from "./stripe";
import { PLANS } from "./products";
import * as db from "../db";

/**
 * Map a Stripe Price ID to our tier.
 * In test mode, we look up by subscription metadata.
 */
function tierFromPriceId(priceId: string): "artist" | "pro" | "free" {
  // Check against configured price IDs (set at runtime)
  if (PLANS.artist.stripePriceId && priceId === PLANS.artist.stripePriceId) return "artist";
  if (PLANS.pro.stripePriceId && priceId === PLANS.pro.stripePriceId) return "pro";
  // Fallback: if price amount matches
  return "artist"; // default to artist for unknown prices
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id
    ? parseInt(session.client_reference_id, 10)
    : null;
  if (!userId) {
    console.warn("[Webhook] checkout.session.completed missing client_reference_id");
    return;
  }

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : (session.subscription as any)?.id;

  const customerId = typeof session.customer === "string"
    ? session.customer
    : (session.customer as any)?.id;

  if (subscriptionId && customerId) {
    // Determine tier from the subscription's price
    let tier: "artist" | "pro" = "artist";
    try {
      const { getStripe } = await import("./stripe");
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId) {
        const detected = tierFromPriceId(priceId);
        if (detected !== "free") tier = detected;
      }
    } catch (e) {
      console.warn("[Webhook] Could not retrieve subscription details:", e);
    }

    const plan = PLANS[tier];
    await db.updateUserSubscription(userId, {
      tier,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      audioMinutesLimit: plan.audioMinutesLimit,
    });
    console.log(`[Webhook] User ${userId} upgraded to ${tier}`);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : (subscription.customer as any)?.id;

  if (!customerId) return;

  const user = await db.getUserByStripeCustomerId(customerId);
  if (!user) {
    console.warn(`[Webhook] No user found for Stripe customer ${customerId}`);
    return;
  }

  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id;

  if (status === "active" || status === "trialing") {
    const tier = priceId ? tierFromPriceId(priceId) : "artist";
    if (tier !== "free") {
      const plan = PLANS[tier];
      await db.updateUserSubscription(user.id, {
        tier,
        stripeSubscriptionId: subscription.id,
        audioMinutesLimit: plan.audioMinutesLimit,
      });
      console.log(`[Webhook] User ${user.id} subscription updated to ${tier}`);
    }
  } else if (status === "canceled" || status === "unpaid" || status === "past_due") {
    // Downgrade to free
    await db.updateUserSubscription(user.id, {
      tier: "free",
      stripeSubscriptionId: null,
      audioMinutesLimit: PLANS.free.audioMinutesLimit,
    });
    console.log(`[Webhook] User ${user.id} downgraded to free (status: ${status})`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : (subscription.customer as any)?.id;

  if (!customerId) return;

  const user = await db.getUserByStripeCustomerId(customerId);
  if (!user) return;

  await db.updateUserSubscription(user.id, {
    tier: "free",
    stripeSubscriptionId: null,
    audioMinutesLimit: PLANS.free.audioMinutesLimit,
  });
  console.log(`[Webhook] User ${user.id} subscription deleted, downgraded to free`);
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(req.body, signature as string);
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        console.log(`[Webhook] Invoice paid: ${(event.data.object as any).id}`);
        break;
      case "invoice.payment_failed":
        console.log(`[Webhook] Invoice payment failed: ${(event.data.object as any).id}`);
        break;
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[Webhook] Error processing ${event.type}:`, err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  return res.json({ received: true });
}

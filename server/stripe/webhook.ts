import { Request, Response } from "express";
import Stripe from "stripe";
import { constructWebhookEvent, getStripe } from "./stripe";
import { PLANS } from "./products";
import * as db from "../db";
import { sendPaymentAlert, sendSubscriptionChangeAlert } from "../services/slackNotification";
import { syncSubscriberToHubSpot, updateSubscriberTier, logSubscriptionEvent } from "../services/hubspotSync";

/**
 * Map a Stripe Price ID to our tier.
 * First checks configured price IDs, then falls back to looking up
 * the price amount from Stripe API to determine the correct tier.
 */
async function tierFromPriceId(priceId: string): Promise<"artist" | "pro" | "free"> {
  // Check against configured price IDs (set at runtime)
  if (PLANS.artist.stripePriceId && priceId === PLANS.artist.stripePriceId) return "artist";
  if (PLANS.pro.stripePriceId && priceId === PLANS.pro.stripePriceId) return "pro";

  // Fallback: look up the price amount from Stripe to determine tier
  try {
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount ?? 0;

    // Pro is $49/mo (4900 cents), Artist is $19/mo (1900 cents)
    if (amount >= PLANS.pro.priceMonthly) return "pro";
    if (amount >= PLANS.artist.priceMonthly) return "artist";
    return "free";
  } catch (e) {
    console.warn(`[Webhook] Could not look up price ${priceId}, defaulting to artist:`, e);
    return "artist";
  }
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
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      if (priceId) {
        const detected = await tierFromPriceId(priceId);
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

    // Slack: notify about new checkout
    const user = await db.getUserById(userId);
    sendPaymentAlert({
      eventType: "checkout.session.completed",
      userName: user?.name || `User #${userId}`,
      amount: session.amount_total ?? undefined,
      currency: session.currency ?? undefined,
      tier,
      description: `New ${tier} subscription`,
    }).catch(() => {});

    // HubSpot: sync new subscriber
    if (user?.email) {
      syncSubscriberToHubSpot({
        userId,
        email: user.email,
        name: user.name || undefined,
        tier,
        signupDate: user.createdAt ? new Date(user.createdAt) : undefined,
      }).catch(() => {});
    }
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
    const tier = priceId ? await tierFromPriceId(priceId) : "artist";
    if (tier !== "free") {
      const plan = PLANS[tier];
      const previousTier = user.tier || "free";
      await db.updateUserSubscription(user.id, {
        tier,
        stripeSubscriptionId: subscription.id,
        audioMinutesLimit: plan.audioMinutesLimit,
      });
      console.log(`[Webhook] User ${user.id} subscription updated to ${tier}`);

      // Slack: notify about subscription change
      if (previousTier !== tier) {
        const changeType = PLANS[tier].priceMonthly > (PLANS[previousTier as keyof typeof PLANS]?.priceMonthly ?? 0) ? "upgrade" : "downgrade";
        sendSubscriptionChangeAlert({
          userName: user.name || `User #${user.id}`,
          previousTier,
          newTier: tier,
          changeType: changeType as "upgrade" | "downgrade",
        }).catch(() => {});

        // HubSpot: update tier
        updateSubscriberTier({
          userId: user.id,
          email: user.email || undefined,
          newTier: tier,
          previousTier,
        }).catch(() => {});
        logSubscriptionEvent({
          userId: user.id,
          email: user.email || undefined,
          eventType: changeType as "upgrade" | "downgrade",
          details: `${previousTier} → ${tier}`,
        }).catch(() => {});
      }
    }
  } else if (status === "canceled" || status === "unpaid" || status === "past_due") {
    const previousTier = user.tier || "free";
    // Downgrade to free
    await db.updateUserSubscription(user.id, {
      tier: "free",
      stripeSubscriptionId: null,
      audioMinutesLimit: PLANS.free.audioMinutesLimit,
    });
    console.log(`[Webhook] User ${user.id} downgraded to free (status: ${status})`);

    // Slack: notify about cancellation/downgrade
    sendSubscriptionChangeAlert({
      userName: user.name || `User #${user.id}`,
      previousTier,
      newTier: "free",
      changeType: status === "canceled" ? "cancel" : "downgrade",
    }).catch(() => {});

    // HubSpot: update tier to free
    updateSubscriberTier({
      userId: user.id,
      email: user.email || undefined,
      newTier: "free",
      previousTier,
    }).catch(() => {});
    logSubscriptionEvent({
      userId: user.id,
      email: user.email || undefined,
      eventType: status === "canceled" ? "cancel" : "downgrade",
      details: `${previousTier} → free (${status})`,
    }).catch(() => {});
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : (subscription.customer as any)?.id;

  if (!customerId) return;

  const user = await db.getUserByStripeCustomerId(customerId);
  if (!user) return;

  const previousTier = user.tier || "free";
  await db.updateUserSubscription(user.id, {
    tier: "free",
    stripeSubscriptionId: null,
    audioMinutesLimit: PLANS.free.audioMinutesLimit,
  });
  console.log(`[Webhook] User ${user.id} subscription deleted, downgraded to free`);

  // Slack: notify about subscription deletion
  sendSubscriptionChangeAlert({
    userName: user.name || `User #${user.id}`,
    previousTier,
    newTier: "free",
    changeType: "cancel",
  }).catch(() => {});

  // HubSpot: update tier to free on deletion
  updateSubscriberTier({
    userId: user.id,
    email: user.email || undefined,
    newTier: "free",
    previousTier,
  }).catch(() => {});
  logSubscriptionEvent({
    userId: user.id,
    email: user.email || undefined,
    eventType: "cancel",
    details: `Subscription deleted (${previousTier} → free)`,
  }).catch(() => {});
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : (invoice.customer as any)?.id;

  if (!customerId) return;

  const user = await db.getUserByStripeCustomerId(customerId);
  if (!user) return;

  // Check attempt count — Stripe sends this on each retry
  const attemptCount = invoice.attempt_count ?? 1;
  console.warn(`[Webhook] Invoice payment failed for user ${user.id}, attempt ${attemptCount}`);

  // After 3 failed attempts, downgrade to free
  if (attemptCount >= 3) {
    await db.updateUserSubscription(user.id, {
      tier: "free",
      audioMinutesLimit: PLANS.free.audioMinutesLimit,
    });
    console.log(`[Webhook] User ${user.id} downgraded to free after ${attemptCount} failed payment attempts`);
  }
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

  // ── Idempotency check ──
  // Stripe can send duplicate events; skip if already processed
  const alreadyProcessed = await db.isWebhookEventProcessed(event.id);
  if (alreadyProcessed) {
    console.log(`[Webhook] Duplicate event ${event.id}, skipping`);
    return res.json({ received: true, duplicate: true });
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
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        // Slack: notify about payment failure
        sendPaymentAlert({
          eventType: "invoice.payment_failed",
          amount: (event.data.object as any).amount_due,
          currency: (event.data.object as any).currency,
          description: `Payment failed (attempt ${(event.data.object as any).attempt_count ?? 1})`,
        }).catch(() => {});
        break;
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Mark event as processed after successful handling
    await db.markWebhookEventProcessed(event.id, event.type);
  } catch (err: any) {
    console.error(`[Webhook] Error processing ${event.type}:`, err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  return res.json({ received: true });
}

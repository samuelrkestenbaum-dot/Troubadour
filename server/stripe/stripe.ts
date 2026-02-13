import Stripe from "stripe";
import { ENV } from "../_core/env";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2026-01-28.clover" as any,
    });
  }
  return stripeInstance;
}

/**
 * Find or create a Stripe customer for a user
 */
export async function findOrCreateCustomer(opts: {
  userId: number;
  email: string;
  name?: string;
  stripeCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripe();

  // If we already have a customer ID, verify it exists
  if (opts.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(opts.stripeCustomerId);
      return opts.stripeCustomerId;
    } catch {
      // Customer was deleted, create a new one
    }
  }

  // Search by email
  const existing = await stripe.customers.list({ email: opts.email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: opts.email,
    name: opts.name ?? undefined,
    metadata: { userId: opts.userId.toString() },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a subscription
 */
export async function createCheckoutSession(opts: {
  userId: number;
  email: string;
  name?: string;
  stripeCustomerId?: string | null;
  priceId: string;
  origin: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();

  const customerId = await findOrCreateCustomer({
    userId: opts.userId,
    email: opts.email,
    name: opts.name,
    stripeCustomerId: opts.stripeCustomerId,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: `${opts.origin}${opts.successPath ?? "/dashboard?upgraded=true"}`,
    cancel_url: `${opts.origin}${opts.cancelPath ?? "/pricing"}`,
    client_reference_id: opts.userId.toString(),
    allow_promotion_codes: true,
    metadata: {
      user_id: opts.userId.toString(),
      customer_email: opts.email,
    },
  });

  return { url: session.url! };
}

/**
 * Create a Stripe Billing Portal session for managing subscriptions
 */
export async function createBillingPortalSession(opts: {
  stripeCustomerId: string;
  origin: string;
  returnPath?: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: opts.stripeCustomerId,
    return_url: `${opts.origin}${opts.returnPath ?? "/dashboard"}`,
  });

  return { url: session.url };
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscriptionDetails(subscriptionId: string) {
  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      status: sub.status,
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId: sub.items.data[0]?.price?.id,
    };
  } catch {
    return null;
  }
}

/**
 * Construct and verify a webhook event
 */
export function constructWebhookEvent(
  payload: Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    ENV.stripeWebhookSecret,
  );
}

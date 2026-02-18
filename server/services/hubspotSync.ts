/**
 * HubSpot CRM Sync Service
 *
 * Syncs paying Troubadour subscribers (Artist/Pro tiers) to HubSpot as contacts.
 * Tracks subscription lifecycle events (upgrades, downgrades, cancellations).
 *
 * Uses HubSpot API v3 directly for full control over contact properties.
 * Gracefully degrades when HUBSPOT_ACCESS_TOKEN is not configured.
 *
 * Custom properties created in HubSpot:
 *  - troubadour_tier: free | artist | pro
 *  - troubadour_signup_date: ISO date string
 *  - troubadour_mrr: monthly revenue from this contact
 *  - troubadour_user_id: internal Troubadour user ID
 */

import { ENV } from "../_core/env";
import { logger } from "../logger";

// ── Types ──

interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
}

interface HubSpotSearchResult {
  total: number;
  results: HubSpotContact[];
}

interface HubSpotError {
  status: string;
  message: string;
  correlationId?: string;
  category?: string;
}

// ── Tier → MRR mapping (cents) ──
const TIER_MRR: Record<string, number> = {
  free: 0,
  artist: 1900, // $19/mo
  pro: 4900,    // $49/mo
};

// ── Core API helper ──

async function hubspotFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = ENV.hubspotAccessToken;

  if (!token) {
    logger.info("[HubSpot] Not configured — skipping API call", { path });
    return { success: true }; // Graceful degradation
  }

  try {
    const response = await fetch(`https://api.hubapi.com${path}`, {
      method: options.method || "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as HubSpotError;
      const errorMsg = errorData.message || `HTTP ${response.status}`;
      logger.error("[HubSpot] API error", {
        path,
        status: response.status,
        error: errorMsg,
        category: errorData.category,
      });
      return { success: false, error: errorMsg };
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error("[HubSpot] Request failed", { path, error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// ── Contact Search ──

/**
 * Search for a HubSpot contact by email.
 */
export async function findContactByEmail(email: string): Promise<HubSpotContact | null> {
  const result = await hubspotFetch<HubSpotSearchResult>("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [{
        filters: [{
          propertyName: "email",
          operator: "EQ",
          value: email,
        }],
      }],
      properties: [
        "email", "firstname", "lastname",
        "troubadour_tier", "troubadour_user_id", "troubadour_mrr", "troubadour_signup_date",
      ],
      limit: 1,
    },
  });

  if (!result.success || !result.data) return null;
  return result.data.results[0] || null;
}

/**
 * Search for a HubSpot contact by Troubadour user ID.
 */
export async function findContactByUserId(userId: number): Promise<HubSpotContact | null> {
  const result = await hubspotFetch<HubSpotSearchResult>("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [{
        filters: [{
          propertyName: "troubadour_user_id",
          operator: "EQ",
          value: String(userId),
        }],
      }],
      properties: [
        "email", "firstname", "lastname",
        "troubadour_tier", "troubadour_user_id", "troubadour_mrr", "troubadour_signup_date",
      ],
      limit: 1,
    },
  });

  if (!result.success || !result.data) return null;
  return result.data.results[0] || null;
}

// ── Contact Create / Update ──

/**
 * Create or update a HubSpot contact for a Troubadour subscriber.
 * Uses email as the dedup key — if a contact with that email exists, updates it.
 */
export async function syncSubscriberToHubSpot(params: {
  userId: number;
  email: string;
  name?: string;
  tier: string;
  signupDate?: Date;
}): Promise<{ success: boolean; contactId?: string; action?: "created" | "updated"; error?: string }> {
  if (!ENV.hubspotAccessToken) {
    logger.info("[HubSpot] Not configured — skipping subscriber sync", { userId: params.userId });
    return { success: true };
  }

  const mrr = TIER_MRR[params.tier] ?? 0;
  const nameParts = (params.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const properties: Record<string, string> = {
    email: params.email,
    troubadour_tier: params.tier,
    troubadour_user_id: String(params.userId),
    troubadour_mrr: String(mrr / 100), // Store as dollars
  };

  if (firstName) properties.firstname = firstName;
  if (lastName) properties.lastname = lastName;
  if (params.signupDate) {
    properties.troubadour_signup_date = params.signupDate.toISOString().split("T")[0];
  }

  // Try to find existing contact by email
  const existing = await findContactByEmail(params.email);

  if (existing) {
    // Update existing contact
    const result = await hubspotFetch<HubSpotContact>(`/crm/v3/objects/contacts/${existing.id}`, {
      method: "PATCH",
      body: { properties },
    });

    if (result.success) {
      logger.info("[HubSpot] Updated contact", { contactId: existing.id, tier: params.tier });
      return { success: true, contactId: existing.id, action: "updated" };
    }
    return { success: false, error: result.error };
  }

  // Create new contact
  const result = await hubspotFetch<HubSpotContact>("/crm/v3/objects/contacts", {
    method: "POST",
    body: { properties },
  });

  if (result.success && result.data) {
    logger.info("[HubSpot] Created contact", { contactId: result.data.id, tier: params.tier });
    return { success: true, contactId: result.data.id, action: "created" };
  }
  return { success: false, error: result.error };
}

// ── Subscription Lifecycle Events ──

/**
 * Update a contact's tier when their subscription changes.
 */
export async function updateSubscriberTier(params: {
  userId: number;
  email?: string;
  newTier: string;
  previousTier?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!ENV.hubspotAccessToken) {
    logger.info("[HubSpot] Not configured — skipping tier update", { userId: params.userId });
    return { success: true };
  }

  // Find contact by userId first, then by email
  let contact = await findContactByUserId(params.userId);
  if (!contact && params.email) {
    contact = await findContactByEmail(params.email);
  }

  if (!contact) {
    logger.warn("[HubSpot] Contact not found for tier update", { userId: params.userId });
    return { success: false, error: "Contact not found in HubSpot" };
  }

  const mrr = TIER_MRR[params.newTier] ?? 0;
  const result = await hubspotFetch(`/crm/v3/objects/contacts/${contact.id}`, {
    method: "PATCH",
    body: {
      properties: {
        troubadour_tier: params.newTier,
        troubadour_mrr: String(mrr / 100),
      },
    },
  });

  if (result.success) {
    logger.info("[HubSpot] Updated tier", {
      contactId: contact.id,
      from: params.previousTier,
      to: params.newTier,
    });
  }

  return result;
}

/**
 * Log a subscription event as a HubSpot engagement note.
 */
export async function logSubscriptionEvent(params: {
  userId: number;
  email?: string;
  eventType: "upgrade" | "downgrade" | "cancel" | "reactivate" | "signup";
  details: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!ENV.hubspotAccessToken) {
    return { success: true };
  }

  // Find contact
  let contact = await findContactByUserId(params.userId);
  if (!contact && params.email) {
    contact = await findContactByEmail(params.email);
  }

  if (!contact) {
    logger.warn("[HubSpot] Contact not found for event logging", { userId: params.userId });
    return { success: false, error: "Contact not found" };
  }

  // Create a note engagement
  const result = await hubspotFetch("/crm/v3/objects/notes", {
    method: "POST",
    body: {
      properties: {
        hs_note_body: `[Troubadour] ${params.eventType.toUpperCase()}: ${params.details}`,
        hs_timestamp: new Date().toISOString(),
      },
      associations: [{
        to: { id: contact.id },
        types: [{
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 202, // note_to_contact
        }],
      }],
    },
  });

  if (result.success) {
    logger.info("[HubSpot] Logged subscription event", {
      contactId: contact.id,
      eventType: params.eventType,
    });
  }

  return result;
}

// ── Bulk Sync ──

/**
 * Sync all paying subscribers to HubSpot.
 * Intended for initial setup or periodic reconciliation.
 */
export async function bulkSyncSubscribers(subscribers: Array<{
  userId: number;
  email: string;
  name?: string;
  tier: string;
  signupDate?: Date;
}>): Promise<{ synced: number; failed: number; errors: string[] }> {
  if (!ENV.hubspotAccessToken) {
    logger.info("[HubSpot] Not configured — skipping bulk sync");
    return { synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sub of subscribers) {
    const result = await syncSubscriberToHubSpot(sub);
    if (result.success) {
      synced++;
    } else {
      failed++;
      errors.push(`User ${sub.userId} (${sub.email}): ${result.error}`);
    }

    // Rate limit: HubSpot allows 100 requests per 10 seconds
    if ((synced + failed) % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  logger.info("[HubSpot] Bulk sync complete", { synced, failed });
  return { synced, failed, errors };
}

/**
 * Check if HubSpot integration is configured.
 */
export function isHubSpotConfigured(): boolean {
  return !!ENV.hubspotAccessToken;
}

// ── Setup: Create custom properties ──

/**
 * Ensure Troubadour custom properties exist in HubSpot.
 * Call this once during initial setup.
 */
export async function ensureCustomProperties(): Promise<{ success: boolean; error?: string }> {
  if (!ENV.hubspotAccessToken) {
    return { success: true };
  }

  const properties = [
    {
      name: "troubadour_tier",
      label: "Troubadour Tier",
      description: "Subscription tier in Troubadour",
      groupName: "contactinformation",
      type: "enumeration",
      fieldType: "select",
      options: [
        { value: "free", label: "Free", displayOrder: 1 },
        { value: "artist", label: "Artist", displayOrder: 2 },
        { value: "pro", label: "Pro", displayOrder: 3 },
      ],
    },
    {
      name: "troubadour_user_id",
      label: "Troubadour User ID",
      description: "Internal Troubadour user ID",
      groupName: "contactinformation",
      type: "string",
      fieldType: "text",
    },
    {
      name: "troubadour_mrr",
      label: "Troubadour MRR",
      description: "Monthly recurring revenue from this subscriber (USD)",
      groupName: "contactinformation",
      type: "number",
      fieldType: "number",
    },
    {
      name: "troubadour_signup_date",
      label: "Troubadour Signup Date",
      description: "Date the user signed up for Troubadour",
      groupName: "contactinformation",
      type: "date",
      fieldType: "date",
    },
  ];

  for (const prop of properties) {
    const result = await hubspotFetch(`/crm/v3/properties/contacts`, {
      method: "POST",
      body: prop,
    });

    if (!result.success) {
      // 409 Conflict means property already exists — that's fine
      if (result.error?.includes("409") || result.error?.includes("already exists")) {
        logger.info("[HubSpot] Property already exists", { name: prop.name });
        continue;
      }
      logger.warn("[HubSpot] Failed to create property", { name: prop.name, error: result.error });
    } else {
      logger.info("[HubSpot] Created property", { name: prop.name });
    }
  }

  return { success: true };
}

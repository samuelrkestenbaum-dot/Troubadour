/**
 * Slack Notification Service
 *
 * Sends admin alerts to a Slack channel via Incoming Webhook.
 * Gracefully degrades when SLACK_WEBHOOK_URL is not configured — logs instead.
 *
 * Alert types:
 *  - Churn alerts (retention drops below threshold)
 *  - New signup notifications
 *  - Payment events (subscription created, upgraded, cancelled)
 *  - System health warnings
 */

import { ENV } from "../_core/env";
import { logger } from "../logger";
import * as db from "../db";

// ── Types ──

export type SlackAlertType =
  | "churn_alert"
  | "new_signup"
  | "payment_event"
  | "subscription_change"
  | "system_health"
  | "admin_action";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
  accessory?: Record<string, unknown>;
}

interface SlackMessage {
  text: string; // Fallback text for notifications
  blocks?: SlackBlock[];
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

// ── Color mapping for alert types ──
const ALERT_EMOJI: Record<SlackAlertType, string> = {
  churn_alert: "🔴",
  new_signup: "🎉",
  payment_event: "💰",
  subscription_change: "📊",
  system_health: "⚙️",
  admin_action: "🔧",
};

// ── Core send function ──

async function sendSlackMessage(message: SlackMessage): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = ENV.slackWebhookUrl;

  if (!webhookUrl) {
    logger.info("[Slack] Webhook not configured — logging message instead", {
      text: message.text,
    });
    return { success: true }; // Graceful degradation
  }

  // Check admin preference — if any admin has slackEnabled=false, skip
  try {
    const adminsWithSlackOff = await db.getAdminsWithPref("slackEnabled", false);
    if (adminsWithSlackOff.length > 0) {
      logger.info("[Slack] Disabled by admin preference — skipping", { text: message.text.slice(0, 80) });
      return { success: true };
    }
  } catch {
    // If pref check fails, proceed with sending (fail open)
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("[Slack] Webhook error", { status: response.status, error: errorText });
      return { success: false, error: `Slack webhook error: ${response.status} — ${errorText}` };
    }

    logger.info("[Slack] Message sent successfully", { text: message.text.slice(0, 80) });
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error("[Slack] Failed to send message", { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// ── Alert Builders ──

/**
 * Send a churn alert when retention drops below threshold.
 */
export async function sendChurnAlert(params: {
  retentionRate: number;
  threshold: number;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  avgDaysSinceLogin: number;
}): Promise<{ success: boolean; error?: string }> {
  const emoji = ALERT_EMOJI.churn_alert;
  const message: SlackMessage = {
    text: `${emoji} Churn Alert: Retention at ${params.retentionRate}% (threshold: ${params.threshold}%)`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} Churn Alert — Retention Below Threshold`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Retention Rate:*\n${params.retentionRate}%` },
          { type: "mrkdwn", text: `*Threshold:*\n${params.threshold}%` },
          { type: "mrkdwn", text: `*Active Users (30d):*\n${params.activeUsers}` },
          { type: "mrkdwn", text: `*Inactive Users:*\n${params.inactiveUsers}` },
          { type: "mrkdwn", text: `*Total Users:*\n${params.totalUsers}` },
          { type: "mrkdwn", text: `*Avg Days Since Login:*\n${params.avgDaysSinceLogin}` },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `⏰ ${new Date().toISOString()} | Automated by Troubadour Churn Scheduler` },
        ],
      },
    ],
  };

  return sendSlackMessage(message);
}

/**
 * Send a new signup notification.
 */
export async function sendNewSignupAlert(params: {
  userName: string;
  userEmail?: string;
  tier: string;
  signupNumber: number;
}): Promise<{ success: boolean; error?: string }> {
  const emoji = ALERT_EMOJI.new_signup;
  const message: SlackMessage = {
    text: `${emoji} New signup: ${params.userName} (${params.tier} tier) — User #${params.signupNumber}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *New Signup!*\n*${params.userName}*${params.userEmail ? ` (${params.userEmail})` : ""} just joined Troubadour on the *${params.tier}* tier.\n_User #${params.signupNumber}_`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `⏰ ${new Date().toISOString()}` },
        ],
      },
    ],
  };

  return sendSlackMessage(message);
}

/**
 * Send a payment event notification (checkout, invoice, subscription change).
 */
export async function sendPaymentAlert(params: {
  eventType: string;
  userName?: string;
  amount?: number;
  currency?: string;
  tier?: string;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  const emoji = ALERT_EMOJI.payment_event;
  const amountStr = params.amount
    ? `${(params.amount / 100).toFixed(2)} ${(params.currency || "USD").toUpperCase()}`
    : "N/A";

  const message: SlackMessage = {
    text: `${emoji} Payment: ${params.eventType} — ${params.userName || "Unknown"} — ${amountStr}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *Payment Event: ${params.eventType}*`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*User:*\n${params.userName || "Unknown"}` },
          { type: "mrkdwn", text: `*Amount:*\n${amountStr}` },
          ...(params.tier ? [{ type: "mrkdwn", text: `*Tier:*\n${params.tier}` }] : []),
          ...(params.description ? [{ type: "mrkdwn", text: `*Details:*\n${params.description}` }] : []),
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `⏰ ${new Date().toISOString()}` },
        ],
      },
    ],
  };

  return sendSlackMessage(message);
}

/**
 * Send a subscription change notification (upgrade, downgrade, cancel).
 */
export async function sendSubscriptionChangeAlert(params: {
  userName: string;
  previousTier: string;
  newTier: string;
  changeType: "upgrade" | "downgrade" | "cancel" | "reactivate";
}): Promise<{ success: boolean; error?: string }> {
  const emoji = ALERT_EMOJI.subscription_change;
  const arrow = params.changeType === "upgrade" ? "⬆️" :
    params.changeType === "downgrade" ? "⬇️" :
    params.changeType === "cancel" ? "❌" : "♻️";

  const message: SlackMessage = {
    text: `${emoji} Subscription ${params.changeType}: ${params.userName} — ${params.previousTier} → ${params.newTier}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *Subscription ${params.changeType.charAt(0).toUpperCase() + params.changeType.slice(1)}*\n${arrow} *${params.userName}*: ${params.previousTier} → ${params.newTier}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `⏰ ${new Date().toISOString()}` },
        ],
      },
    ],
  };

  return sendSlackMessage(message);
}

/**
 * Send a system health warning.
 */
export async function sendSystemHealthAlert(params: {
  component: string;
  status: "degraded" | "down" | "recovered";
  details: string;
}): Promise<{ success: boolean; error?: string }> {
  const emoji = ALERT_EMOJI.system_health;
  const statusEmoji = params.status === "recovered" ? "✅" :
    params.status === "degraded" ? "⚠️" : "🔴";

  const message: SlackMessage = {
    text: `${emoji} System Health: ${params.component} is ${params.status}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *System Health Alert*\n${statusEmoji} *${params.component}* is *${params.status}*\n${params.details}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `⏰ ${new Date().toISOString()}` },
        ],
      },
    ],
  };

  return sendSlackMessage(message);
}

/**
 * Send a generic admin action notification.
 */
export async function sendAdminActionAlert(params: {
  adminName: string;
  action: string;
  targetUser?: string;
  details?: string;
}): Promise<{ success: boolean; error?: string }> {
  const emoji = ALERT_EMOJI.admin_action;
  const message: SlackMessage = {
    text: `${emoji} Admin Action: ${params.adminName} — ${params.action}${params.targetUser ? ` on ${params.targetUser}` : ""}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *Admin Action*\n*${params.adminName}* performed *${params.action}*${params.targetUser ? ` on *${params.targetUser}*` : ""}${params.details ? `\n_${params.details}_` : ""}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `⏰ ${new Date().toISOString()}` },
        ],
      },
    ],
  };

  return sendSlackMessage(message);
}

/**
 * Check if Slack notifications are configured.
 */
export function isSlackConfigured(): boolean {
  return !!ENV.slackWebhookUrl;
}

// Export the raw send function for custom messages
export { sendSlackMessage };

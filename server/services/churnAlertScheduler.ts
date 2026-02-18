/**
 * Churn Alert Scheduler
 *
 * Runs daily at 9:00 AM UTC. Checks the 30-day retention rate
 * against a configurable threshold (default 50%). If retention
 * drops below the threshold, sends an alert to the project owner
 * via notifyOwner and logs the event in the admin audit log.
 *
 * The scheduler uses a date-based dedup key to ensure only one
 * alert fires per day, even across server restarts.
 */

import * as db from "../db";
import { logger } from "../logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const ALERT_HOUR = 9; // 9 AM UTC
const DEFAULT_THRESHOLD = 50; // 50% retention rate

let churnTimer: ReturnType<typeof setInterval> | null = null;
let lastAlertDate: string | null = null;

// Configurable threshold — can be updated at runtime via setChurnThreshold
let currentThreshold = DEFAULT_THRESHOLD;

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function isAlertTime(): boolean {
  return new Date().getUTCHours() === ALERT_HOUR;
}

async function runChurnCheck(): Promise<void> {
  const dateKey = getDateKey();

  // Skip if already checked today
  if (lastAlertDate === dateKey) {
    return;
  }

  // Only run at the scheduled hour
  if (!isAlertTime()) {
    return;
  }

  logger.info("[ChurnAlertScheduler] Running daily churn check", { dateKey, threshold: currentThreshold });
  lastAlertDate = dateKey;

  try {
    const metrics = await db.getRetentionMetrics();
    const isAlert = metrics.retentionRate < currentThreshold;

    if (isAlert) {
      logger.warn("[ChurnAlertScheduler] Retention below threshold", {
        retentionRate: metrics.retentionRate,
        threshold: currentThreshold,
      });

      // Send notification to owner
      try {
        const { notifyOwner } = await import("../_core/notification");
        const title = `⚠️ Daily Churn Alert: Retention at ${metrics.retentionRate}%`;
        const content = [
          `**Automated Churn Alert** (${dateKey})`,
          ``,
          `- Total Users: ${metrics.totalUsers}`,
          `- Active (30d): ${metrics.activeUsers}`,
          `- Inactive (30d+): ${metrics.inactiveUsers}`,
          `- Retention Rate: ${metrics.retentionRate}%`,
          `- Avg Days Since Login: ${metrics.avgDaysSinceLogin}`,
          `- Alert Threshold: ${currentThreshold}%`,
          ``,
          `🔴 Retention is below the ${currentThreshold}% threshold. Consider re-engagement campaigns.`,
        ].join("\n");

        await notifyOwner({ title, content });
      } catch (notifyErr) {
        logger.warn("[ChurnAlertScheduler] Failed to notify owner", { error: String(notifyErr) });
      }

      // Send Slack alert (parallel, non-blocking)
      try {
        const { sendChurnAlert } = await import("./slackNotification");
        await sendChurnAlert({
          retentionRate: metrics.retentionRate,
          threshold: currentThreshold,
          totalUsers: metrics.totalUsers,
          activeUsers: metrics.activeUsers,
          inactiveUsers: metrics.inactiveUsers,
          avgDaysSinceLogin: metrics.avgDaysSinceLogin,
        });
      } catch (slackErr) {
        logger.warn("[ChurnAlertScheduler] Failed to send Slack alert", { error: String(slackErr) });
      }

      // Log in audit log (system action, no admin user)
      try {
        await db.createAuditLogEntry({
          adminUserId: 0, // System-generated
          action: "auto_churn_alert",
          targetUserId: undefined,
          details: {
            retentionRate: metrics.retentionRate,
            threshold: currentThreshold,
            activeUsers: metrics.activeUsers,
            inactiveUsers: metrics.inactiveUsers,
            automated: true,
          },
        });
      } catch (auditErr) {
        logger.warn("[ChurnAlertScheduler] Failed to log audit entry", { error: String(auditErr) });
      }
    } else {
      logger.info("[ChurnAlertScheduler] Retention healthy", {
        retentionRate: metrics.retentionRate,
        threshold: currentThreshold,
      });
    }
  } catch (err) {
    logger.error("[ChurnAlertScheduler] Fatal error during churn check", { error: String(err) });
    lastAlertDate = null; // Reset so it can retry next hour
  }
}

export function setChurnThreshold(threshold: number): void {
  currentThreshold = Math.max(0, Math.min(100, threshold));
  logger.info("[ChurnAlertScheduler] Threshold updated", { threshold: currentThreshold });
}

export function getChurnThreshold(): number {
  return currentThreshold;
}

export function startChurnAlertScheduler(): void {
  if (churnTimer) {
    logger.warn("[ChurnAlertScheduler] Already running, skipping start");
    return;
  }

  logger.info("[ChurnAlertScheduler] Starting churn alert scheduler", {
    checkInterval: `${CHECK_INTERVAL_MS / 60000} minutes`,
    scheduledHour: `${ALERT_HOUR}:00 UTC`,
    threshold: `${currentThreshold}%`,
  });

  // Run an initial check on startup
  runChurnCheck().catch(err => {
    logger.error("[ChurnAlertScheduler] Initial check failed", { error: String(err) });
  });

  // Then check every hour
  churnTimer = setInterval(() => {
    runChurnCheck().catch(err => {
      logger.error("[ChurnAlertScheduler] Scheduled check failed", { error: String(err) });
    });
  }, CHECK_INTERVAL_MS);
}

export function stopChurnAlertScheduler(): void {
  if (churnTimer) {
    clearInterval(churnTimer);
    churnTimer = null;
    logger.info("[ChurnAlertScheduler] Stopped");
  }
}

// For testing: force a churn check
export async function forceChurnCheck(): Promise<{
  retentionRate: number;
  threshold: number;
  isAlert: boolean;
  notified: boolean;
}> {
  lastAlertDate = null;
  const metrics = await db.getRetentionMetrics();
  const isAlert = metrics.retentionRate < currentThreshold;

  let notified = false;
  if (isAlert) {
    try {
      const { notifyOwner } = await import("../_core/notification");
      notified = await notifyOwner({
        title: `⚠️ Forced Churn Check: Retention at ${metrics.retentionRate}%`,
        content: `Forced churn check: ${metrics.activeUsers} active, ${metrics.inactiveUsers} inactive. Threshold: ${currentThreshold}%.`,
      });
    } catch {
      notified = false;
    }
  }

  return {
    retentionRate: metrics.retentionRate,
    threshold: currentThreshold,
    isAlert,
    notified,
  };
}

// Exported for testing
export { isAlertTime, getDateKey, DEFAULT_THRESHOLD };

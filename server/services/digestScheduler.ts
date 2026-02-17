/**
 * Weekly Digest Scheduler
 *
 * Runs a cron-like check every hour. On Monday mornings (8:00 AM UTC),
 * it generates and sends weekly digests to all active users who had
 * activity in the past 7 days.
 *
 * The scheduler uses a database-backed "last run" check to ensure
 * digests are only sent once per week, even if the server restarts.
 */

import * as db from "../db";
import { logger } from "../logger";

const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const DIGEST_DAY = 1; // Monday (0 = Sunday, 1 = Monday)
const DIGEST_HOUR = 8; // 8 AM UTC

let digestTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// Track last digest run to prevent duplicates
let lastDigestWeek: string | null = null;

function getWeekKey(): string {
  const now = new Date();
  // ISO week key: year-weekNumber
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${weekNumber}`;
}

function isDigestTime(): boolean {
  const now = new Date();
  return now.getUTCDay() === DIGEST_DAY && now.getUTCHours() === DIGEST_HOUR;
}

async function runWeeklyDigest(): Promise<void> {
  const weekKey = getWeekKey();

  // Skip if already sent this week
  if (lastDigestWeek === weekKey) {
    return;
  }

  // Only run on the scheduled day/hour
  if (!isDigestTime()) {
    return;
  }

  logger.info("[DigestScheduler] Starting weekly digest generation", { weekKey });
  lastDigestWeek = weekKey;

  try {
    const users = await db.getAllActiveUsers();
    if (!users || users.length === 0) {
      logger.info("[DigestScheduler] No active users found, skipping");
      return;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Get digest data for this user
        const data = await db.getDigestData(user.id, 7);

        // Skip users with no activity
        if (data.stats.totalReviews === 0 && data.stats.totalNewProjects === 0) {
          skipped++;
          continue;
        }

        // Create in-app notification
        await db.createNotification({
          userId: user.id,
          type: "digest",
          title: "Your Weekly Digest",
          message: `This week: ${data.stats.totalReviews} reviews, avg score ${data.stats.averageScore ?? '—'}/10. ${data.stats.highestScore ? `Top track: ${data.stats.highestScore.track} (${data.stats.highestScore.score}/10)` : ''}`,
          link: "/digest",
        });

        // Send email if user has email and Postmark is configured
        if (user.email) {
          try {
            const { sendDigestEmail } = await import("./emailService");
            const periodLabel = "This Week";

            // Generate a simple email summary (lightweight version)
            const htmlContent = generateDigestEmailHtml(user.name || "Artist", periodLabel, data);

            await sendDigestEmail({
              to: user.email,
              userName: user.name || "Artist",
              htmlContent,
              periodLabel,
            });
          } catch (emailErr) {
            // Email failure is non-fatal
            logger.warn("[DigestScheduler] Email failed for user", { userId: user.id, error: String(emailErr) });
          }
        }

        sent++;
      } catch (userErr) {
        failed++;
        logger.error("[DigestScheduler] Failed for user", { userId: user.id, error: String(userErr) });
      }
    }

    logger.info("[DigestScheduler] Weekly digest complete", { sent, skipped, failed, total: users.length });

    // Notify owner about the digest run
    try {
      const { notifyOwner } = await import("../_core/notification");
      await notifyOwner({
        title: "Weekly Digest Sent",
        content: `Digest sent to ${sent} users (${skipped} skipped, ${failed} failed) for week ${weekKey}.`,
      });
    } catch {
      // Owner notification is non-fatal
    }
  } catch (err) {
    logger.error("[DigestScheduler] Fatal error during digest run", { error: String(err) });
    // Reset the week key so it can retry next hour
    lastDigestWeek = null;
  }
}

function generateDigestEmailHtml(
  userName: string,
  periodLabel: string,
  data: Awaited<ReturnType<typeof db.getDigestData>>
): string {
  let trackRows = '';
  if (data.reviews && data.reviews.length > 0) {
    trackRows = data.reviews.slice(0, 10).map((r) => {
      const scores = (typeof r.scoresJson === 'string' ? JSON.parse(r.scoresJson) : r.scoresJson) as Record<string, number> | null;
      const score = scores?.overall ?? scores?.overallScore;
      const scoreDisplay = typeof score === 'number' ? score : '—';
      const scoreColor = typeof score === 'number'
        ? (score >= 8 ? '#22c55e' : score >= 6 ? '#3b82f6' : score >= 4 ? '#f59e0b' : '#ef4444')
        : '#888';
      return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e35;">${r.trackFilename || 'Unknown'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e35;color:${scoreColor};font-weight:700;text-align:center;">${scoreDisplay}/10</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e35;color:#888;font-size:0.85em;">${r.quickTake || '—'}</td>
      </tr>`;
    }).join('');
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Troubadour Weekly Digest</title></head>
<body style="margin:0;padding:0;background:#0a0a14;color:#e8e8f0;font-family:'Inter',system-ui,-apple-system,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding:24px 0;border-bottom:2px solid #1e1e35;margin-bottom:24px;">
      <h1 style="font-size:1.5em;font-weight:800;margin:0 0 4px;">Troubadour</h1>
      <p style="color:#888;margin:0;font-size:0.9em;">${periodLabel} Digest for ${userName}</p>
    </div>
    <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:24px;">
      <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalReviews}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Reviews</div></div>
      <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalNewProjects}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Projects</div></div>
      <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.averageScore ?? '—'}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Avg Score</div></div>
    </div>
    ${trackRows ? `
    <h2 style="font-size:1.1em;font-weight:600;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #1e1e35;">Recent Reviews</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="color:#888;font-size:0.8em;text-transform:uppercase;">
        <th style="text-align:left;padding:8px 14px;">Track</th>
        <th style="text-align:center;padding:8px 14px;">Score</th>
        <th style="text-align:left;padding:8px 14px;">Quick Take</th>
      </tr></thead>
      <tbody>${trackRows}</tbody>
    </table>` : '<p style="text-align:center;color:#888;padding:24px;">No reviews this period.</p>'}
    ${data.stats.highestScore ? `
    <div style="margin:24px 0;padding:16px;background:#12121f;border:1px solid #1e1e35;border-radius:12px;">
      <h3 style="margin:0 0 8px;font-size:0.9em;color:#888;">Top Track</h3>
      <p style="margin:0;font-weight:600;">${data.stats.highestScore.track} — <span style="color:#22c55e;">${data.stats.highestScore.score}/10</span></p>
    </div>` : ''}
    <div style="text-align:center;padding:24px 0;border-top:1px solid #1e1e35;margin-top:24px;color:#888;font-size:0.75em;">
      Generated by Troubadour AI &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body></html>`;
}

export function startDigestScheduler(): void {
  if (digestTimer) {
    logger.warn("[DigestScheduler] Already running, skipping start");
    return;
  }

  logger.info("[DigestScheduler] Starting weekly digest scheduler", {
    checkInterval: `${DIGEST_INTERVAL_MS / 60000} minutes`,
    scheduledDay: "Monday",
    scheduledHour: `${DIGEST_HOUR}:00 UTC`,
  });

  // Run an initial check on startup
  runWeeklyDigest().catch(err => {
    logger.error("[DigestScheduler] Initial check failed", { error: String(err) });
  });

  // Then check every hour
  digestTimer = setInterval(() => {
    runWeeklyDigest().catch(err => {
      logger.error("[DigestScheduler] Scheduled check failed", { error: String(err) });
    });
  }, DIGEST_INTERVAL_MS);
}

export function stopDigestScheduler(): void {
  if (digestTimer) {
    clearInterval(digestTimer);
    digestTimer = null;
    logger.info("[DigestScheduler] Stopped");
  }
}

// For testing: force a digest run
export async function forceDigestRun(): Promise<{ sent: number; skipped: number; failed: number }> {
  lastDigestWeek = null; // Reset so it can run
  const users = await db.getAllActiveUsers();
  if (!users || users.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  let sent = 0, skipped = 0, failed = 0;

  for (const user of users) {
    try {
      const data = await db.getDigestData(user.id, 7);
      if (data.stats.totalReviews === 0 && data.stats.totalNewProjects === 0) {
        skipped++;
        continue;
      }
      await db.createNotification({
        userId: user.id,
        type: "digest",
        title: "Your Weekly Digest",
        message: `This week: ${data.stats.totalReviews} reviews, avg score ${data.stats.averageScore ?? '—'}/10.`,
        link: "/digest",
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed };
}

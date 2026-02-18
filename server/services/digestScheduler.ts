/**
 * Digest Scheduler (Enhanced with Intelligence Suite Data)
 *
 * Runs a cron-like check every hour. On Monday mornings (8:00 AM UTC),
 * it generates and sends digests to users based on their frequency preference:
 * - weekly: every Monday
 * - biweekly: every other Monday
 * - monthly: first Monday of each month
 * - disabled: never
 *
 * Enhanced digest includes:
 * - Review stats (total, avg score, top track)
 * - Streak & retention data (current streak, longest, milestones)
 * - Skill progression summary (top improving dimensions)
 * - Claude 4.5 personalized summary text
 */

import * as db from "../db";
import { logger } from "../logger";
import { invokeLLM } from "../_core/llm";

const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const DIGEST_DAY = 1; // Monday (0 = Sunday, 1 = Monday)
const DIGEST_HOUR = 8; // 8 AM UTC

let digestTimer: ReturnType<typeof setInterval> | null = null;

// Track last digest run to prevent duplicates
let lastDigestWeek: string | null = null;

function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${weekNumber}`;
}

function getWeekNumber(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
}

function isFirstMondayOfMonth(): boolean {
  const now = new Date();
  return now.getUTCDate() <= 7;
}

function isDigestTime(): boolean {
  const now = new Date();
  return now.getUTCDay() === DIGEST_DAY && now.getUTCHours() === DIGEST_HOUR;
}

function shouldSendToUser(frequency: string): boolean {
  switch (frequency) {
    case "weekly":
      return true;
    case "biweekly":
      return getWeekNumber() % 2 === 0;
    case "monthly":
      return isFirstMondayOfMonth();
    case "disabled":
      return false;
    default:
      return true;
  }
}

function getDaysBackForFrequency(frequency: string): number {
  switch (frequency) {
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
    default: return 7;
  }
}

function getPeriodLabelForFrequency(frequency: string): string {
  switch (frequency) {
    case "weekly": return "This Week";
    case "biweekly": return "Last 2 Weeks";
    case "monthly": return "This Month";
    default: return "This Week";
  }
}

// ── Intelligence Suite Data Aggregation ──

interface IntelligenceSuiteData {
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalUploads: number;
    totalReviews: number;
  } | null;
  skillProgress: Array<{
    dimension: string;
    latestScore: number;
    delta: number;
    dataPoints: number;
  }>;
  artistDNA: {
    archetype: string;
    confidence: number;
    traits: string[];
  } | null;
}

async function getIntelligenceSuiteData(userId: number): Promise<IntelligenceSuiteData> {
  // Fetch streak data
  let streak: IntelligenceSuiteData["streak"] = null;
  try {
    const streakData = await db.getOrCreateUserStreak(userId);
    if (streakData) {
      streak = {
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        totalUploads: streakData.totalUploads,
        totalReviews: streakData.totalReviews,
      };
    }
  } catch (err) {
    logger.warn("[DigestScheduler] Failed to fetch streak data", { userId, error: String(err) });
  }

  // Fetch skill progression overview
  let skillProgress: IntelligenceSuiteData["skillProgress"] = [];
  try {
    const overview = await db.getSkillProgressionOverview(userId);
    if (overview && overview.length > 0) {
      skillProgress = overview
        .filter((d) => d.dataPoints >= 2)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5)
        .map((d) => ({
          dimension: d.dimension,
          latestScore: d.latestScore,
          delta: d.delta,
          dataPoints: d.dataPoints,
        }));
    }
  } catch (err) {
    logger.warn("[DigestScheduler] Failed to fetch skill data", { userId, error: String(err) });
  }

  // Fetch artist DNA summary
  let artistDNA: IntelligenceSuiteData["artistDNA"] = null;
  try {
    const dna = await db.getLatestArtistDNA(userId);
    if (dna && dna.dnaJson) {
      const parsed = typeof dna.dnaJson === "string" ? JSON.parse(dna.dnaJson) : dna.dnaJson;
      artistDNA = {
        archetype: parsed.archetype || parsed.label || "Unique Artist",
        confidence: parsed.confidence ?? 0,
        traits: (parsed.dominantTraits || parsed.traits || []).slice(0, 3),
      };
    }
  } catch (err) {
    logger.warn("[DigestScheduler] Failed to fetch artist DNA", { userId, error: String(err) });
  }

  return { streak, skillProgress, artistDNA };
}

// ── Claude 4.5 Personalized Summary ──

async function generatePersonalizedSummary(
  userName: string,
  periodLabel: string,
  reviewData: Awaited<ReturnType<typeof db.getDigestData>>,
  suiteData: IntelligenceSuiteData
): Promise<string> {
  try {
    const context = {
      period: periodLabel,
      reviews: reviewData.stats.totalReviews,
      avgScore: reviewData.stats.averageScore,
      topTrack: reviewData.stats.highestScore?.track,
      topScore: reviewData.stats.highestScore?.score,
      streak: suiteData.streak?.currentStreak ?? 0,
      longestStreak: suiteData.streak?.longestStreak ?? 0,
      topSkillGains: suiteData.skillProgress.map(
        (s) => `${s.dimension}: +${s.delta > 0 ? s.delta : 0} (now ${s.latestScore}/10)`
      ),
      archetype: suiteData.artistDNA?.archetype,
    };

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Troubadour's digest writer. Write a 2-3 sentence personalized summary for a musician's weekly digest email. Be encouraging, specific, and action-oriented. Reference their actual data. Keep it warm but professional. Do not use emojis. Do not use markdown.`,
        },
        {
          role: "user",
          content: `Write a personalized digest summary for ${userName}. Data: ${JSON.stringify(context)}`,
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 20) {
      return content.trim();
    }
  } catch (err) {
    logger.warn("[DigestScheduler] Claude summary generation failed", { error: String(err) });
  }

  // Fallback: generate a simple summary without LLM
  const parts: string[] = [];
  if (reviewData.stats.totalReviews > 0) {
    parts.push(`You completed ${reviewData.stats.totalReviews} review${reviewData.stats.totalReviews > 1 ? "s" : ""} with an average score of ${reviewData.stats.averageScore ?? "—"}/10.`);
  }
  if (suiteData.streak && suiteData.streak.currentStreak > 0) {
    parts.push(`Your creative streak is at ${suiteData.streak.currentStreak} day${suiteData.streak.currentStreak > 1 ? "s" : ""} — keep it going!`);
  }
  if (suiteData.skillProgress.length > 0 && suiteData.skillProgress[0].delta > 0) {
    parts.push(`Your ${suiteData.skillProgress[0].dimension} skill improved by +${suiteData.skillProgress[0].delta} this period.`);
  }
  return parts.join(" ") || `Here's your ${periodLabel.toLowerCase()} recap from Troubadour.`;
}

// ── Enhanced Email HTML Generation ──

function generateDigestEmailHtml(
  userName: string,
  periodLabel: string,
  data: Awaited<ReturnType<typeof db.getDigestData>>,
  suiteData: IntelligenceSuiteData,
  personalizedSummary: string
): string {
  let trackRows = "";
  if (data.reviews && data.reviews.length > 0) {
    trackRows = data.reviews.slice(0, 10).map((r) => {
      const scores = (typeof r.scoresJson === "string" ? JSON.parse(r.scoresJson) : r.scoresJson) as Record<string, number> | null;
      const score = scores?.overall ?? scores?.overallScore;
      const scoreDisplay = typeof score === "number" ? score : "—";
      const scoreColor = typeof score === "number"
        ? (score >= 8 ? "#22c55e" : score >= 6 ? "#3b82f6" : score >= 4 ? "#f59e0b" : "#ef4444")
        : "#888";
      return `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e35;">${r.trackFilename || "Unknown"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e35;color:${scoreColor};font-weight:700;text-align:center;">${scoreDisplay}/10</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e1e35;color:#888;font-size:0.85em;">${r.quickTake || "—"}</td>
      </tr>`;
    }).join("");
  }

  // Streak section
  const streakHtml = suiteData.streak ? `
    <div style="margin:24px 0;padding:16px;background:#12121f;border:1px solid #1e1e35;border-radius:12px;">
      <h3 style="margin:0 0 12px;font-size:1em;font-weight:600;color:#fb923c;">Creative Streak</h3>
      <div style="display:flex;justify-content:space-around;text-align:center;">
        <div>
          <div style="font-size:1.8em;font-weight:700;color:#fb923c;">${suiteData.streak.currentStreak}</div>
          <div style="font-size:0.7em;color:#888;text-transform:uppercase;">Current Streak</div>
        </div>
        <div>
          <div style="font-size:1.8em;font-weight:700;color:#f59e0b;">${suiteData.streak.longestStreak}</div>
          <div style="font-size:0.7em;color:#888;text-transform:uppercase;">Longest Streak</div>
        </div>
        <div>
          <div style="font-size:1.8em;font-weight:700;color:#e8e8f0;">${suiteData.streak.totalUploads + suiteData.streak.totalReviews}</div>
          <div style="font-size:0.7em;color:#888;text-transform:uppercase;">Total Activities</div>
        </div>
      </div>
    </div>` : "";

  // Skill progression section
  const skillHtml = suiteData.skillProgress.length > 0 ? `
    <div style="margin:24px 0;padding:16px;background:#12121f;border:1px solid #1e1e35;border-radius:12px;">
      <h3 style="margin:0 0 12px;font-size:1em;font-weight:600;color:#f59e0b;">Skill Growth</h3>
      ${suiteData.skillProgress.map((s) => {
        const deltaColor = s.delta > 0 ? "#22c55e" : s.delta < 0 ? "#ef4444" : "#888";
        const deltaSign = s.delta > 0 ? "+" : "";
        const barWidth = Math.min(100, Math.max(10, s.latestScore * 10));
        return `<div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:0.85em;color:#e8e8f0;">${s.dimension}</span>
            <span style="font-size:0.85em;color:${deltaColor};font-weight:600;">${deltaSign}${s.delta} (${s.latestScore}/10)</span>
          </div>
          <div style="height:6px;background:#1e1e35;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${barWidth}%;background:linear-gradient(90deg,#f59e0b,#fb923c);border-radius:3px;"></div>
          </div>
        </div>`;
      }).join("")}
    </div>` : "";

  // Artist DNA section
  const dnaHtml = suiteData.artistDNA ? `
    <div style="margin:24px 0;padding:16px;background:#12121f;border:1px solid #1e1e35;border-radius:12px;">
      <h3 style="margin:0 0 8px;font-size:1em;font-weight:600;color:#a78bfa;">Your Artist DNA</h3>
      <p style="margin:0 0 8px;font-size:1.1em;font-weight:700;color:#e8e8f0;">${suiteData.artistDNA.archetype}</p>
      ${suiteData.artistDNA.traits.length > 0 ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${suiteData.artistDNA.traits.map((t) => `<span style="padding:3px 10px;background:#a78bfa22;border:1px solid #a78bfa44;border-radius:12px;font-size:0.75em;color:#a78bfa;">${t}</span>`).join("")}
        </div>` : ""}
    </div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Troubadour ${periodLabel} Digest</title></head>
<body style="margin:0;padding:0;background:#0a0a14;color:#e8e8f0;font-family:'Inter',system-ui,-apple-system,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding:24px 0;border-bottom:2px solid #1e1e35;margin-bottom:24px;">
      <h1 style="font-size:1.5em;font-weight:800;margin:0 0 4px;">Troubadour</h1>
      <p style="color:#888;margin:0;font-size:0.9em;">${periodLabel} Digest for ${userName}</p>
    </div>

    <!-- Personalized AI Summary -->
    <div style="margin:0 0 24px;padding:16px 20px;background:linear-gradient(135deg,#1a1a2e,#12121f);border:1px solid #c8102e33;border-radius:12px;">
      <p style="margin:0;font-size:0.95em;line-height:1.6;color:#d4d4e8;font-style:italic;">${personalizedSummary}</p>
    </div>

    <!-- Quick Stats -->
    <div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:24px;">
      <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalReviews}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Reviews</div></div>
      <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.totalNewProjects}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Projects</div></div>
      <div><div style="font-size:2em;font-weight:700;color:#c8102e;">${data.stats.averageScore ?? "—"}</div><div style="font-size:0.75em;color:#888;text-transform:uppercase;">Avg Score</div></div>
    </div>

    ${streakHtml}
    ${skillHtml}

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
    </div>` : ""}

    ${dnaHtml}

    <div style="text-align:center;padding:24px 0;border-top:1px solid #1e1e35;margin-top:24px;color:#888;font-size:0.75em;">
      Generated by Troubadour AI &middot; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
    </div>
  </div>
</body></html>`;
}

// ── Main Scheduler Logic ──

async function runScheduledDigest(): Promise<void> {
  const weekKey = getWeekKey();

  if (lastDigestWeek === weekKey) {
    return;
  }

  if (!isDigestTime()) {
    return;
  }

  logger.info("[DigestScheduler] Starting enhanced digest generation", { weekKey });
  lastDigestWeek = weekKey;

  try {
    const users = await db.getAllActiveUsers();
    if (!users || users.length === 0) {
      logger.info("[DigestScheduler] No active users found, skipping");
      return;
    }

    let sent = 0;
    let skipped = 0;
    let frequencySkipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const frequency = (user as any).digestFrequency ?? "weekly";

        if (!shouldSendToUser(frequency)) {
          frequencySkipped++;
          continue;
        }

        const daysBack = getDaysBackForFrequency(frequency);
        const periodLabel = getPeriodLabelForFrequency(frequency);

        const data = await db.getDigestData(user.id, daysBack);

        // Skip users with zero activity AND no streak
        const suiteData = await getIntelligenceSuiteData(user.id);
        const hasActivity = data.stats.totalReviews > 0 || data.stats.totalNewProjects > 0;
        const hasStreak = (suiteData.streak?.currentStreak ?? 0) > 0;

        if (!hasActivity && !hasStreak) {
          skipped++;
          continue;
        }

        // Generate Claude 4.5 personalized summary
        const personalizedSummary = await generatePersonalizedSummary(
          user.name || "Artist",
          periodLabel,
          data,
          suiteData
        );

        // Create in-app notification with enhanced message
        const notifMessage = personalizedSummary.length > 200
          ? personalizedSummary.slice(0, 197) + "..."
          : personalizedSummary;

        await db.createNotification({
          userId: user.id,
          type: "digest",
          title: `Your ${periodLabel} Digest`,
          message: notifMessage,
          link: "/digest",
        });

        // Send email if user has email and Postmark is configured
        if (user.email) {
          try {
            const { sendDigestEmail } = await import("./emailService");
            const htmlContent = generateDigestEmailHtml(
              user.name || "Artist",
              periodLabel,
              data,
              suiteData,
              personalizedSummary
            );

            await sendDigestEmail({
              to: user.email,
              userName: user.name || "Artist",
              htmlContent,
              periodLabel,
            });
          } catch (emailErr) {
            logger.warn("[DigestScheduler] Email failed for user", { userId: user.id, error: String(emailErr) });
          }
        }

        sent++;
      } catch (userErr) {
        failed++;
        logger.error("[DigestScheduler] Failed for user", { userId: user.id, error: String(userErr) });
      }
    }

    logger.info("[DigestScheduler] Enhanced digest run complete", {
      sent,
      skipped,
      frequencySkipped,
      failed,
      total: users.length,
    });

    try {
      const { notifyOwner } = await import("../_core/notification");
      await notifyOwner({
        title: "Enhanced Digest Complete",
        content: `Sent to ${sent} users (${skipped} no activity, ${frequencySkipped} frequency skip, ${failed} failed) for ${weekKey}. Includes streak, skill, and DNA data.`,
      });
    } catch {
      // Owner notification is non-fatal
    }
  } catch (err) {
    logger.error("[DigestScheduler] Fatal error during digest run", { error: String(err) });
    lastDigestWeek = null;
  }
}

export function startDigestScheduler(): void {
  if (digestTimer) {
    logger.warn("[DigestScheduler] Already running, skipping start");
    return;
  }

  logger.info("[DigestScheduler] Starting enhanced digest scheduler", {
    checkInterval: `${DIGEST_INTERVAL_MS / 60000} minutes`,
    scheduledDay: "Monday",
    scheduledHour: `${DIGEST_HOUR}:00 UTC`,
    frequencies: "weekly, biweekly, monthly, disabled",
    enhancements: "streak, skill progression, artist DNA, Claude 4.5 summary",
  });

  runScheduledDigest().catch(err => {
    logger.error("[DigestScheduler] Initial check failed", { error: String(err) });
  });

  digestTimer = setInterval(() => {
    runScheduledDigest().catch(err => {
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
export async function forceDigestRun(): Promise<{ sent: number; skipped: number; frequencySkipped: number; failed: number }> {
  lastDigestWeek = null;
  const users = await db.getAllActiveUsers();
  if (!users || users.length === 0) return { sent: 0, skipped: 0, frequencySkipped: 0, failed: 0 };

  let sent = 0, skipped = 0, frequencySkipped = 0, failed = 0;

  for (const user of users) {
    try {
      const frequency = (user as any).digestFrequency ?? "weekly";
      if (frequency === "disabled") {
        frequencySkipped++;
        continue;
      }

      const daysBack = getDaysBackForFrequency(frequency);
      const data = await db.getDigestData(user.id, daysBack);
      const suiteData = await getIntelligenceSuiteData(user.id);

      if (data.stats.totalReviews === 0 && data.stats.totalNewProjects === 0 && (suiteData.streak?.currentStreak ?? 0) === 0) {
        skipped++;
        continue;
      }

      const periodLabel = getPeriodLabelForFrequency(frequency);
      const personalizedSummary = await generatePersonalizedSummary(
        user.name || "Artist",
        periodLabel,
        data,
        suiteData
      );

      await db.createNotification({
        userId: user.id,
        type: "digest",
        title: `Your ${periodLabel} Digest`,
        message: personalizedSummary.length > 200 ? personalizedSummary.slice(0, 197) + "..." : personalizedSummary,
        link: "/digest",
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, frequencySkipped, failed };
}

// Exported for testing
export {
  shouldSendToUser,
  getDaysBackForFrequency,
  getPeriodLabelForFrequency,
  isFirstMondayOfMonth,
  getIntelligenceSuiteData,
  generatePersonalizedSummary,
  generateDigestEmailHtml,
};

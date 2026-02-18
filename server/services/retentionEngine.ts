/**
 * Feature 4: Behavioral Retention Engine
 * 
 * Tracks upload streaks, cadence, and engagement patterns.
 * Sends personalized nudges and improvement digests.
 * Gamifies the review process with streaks and milestones.
 */

import * as db from "../db";
import { sendAdminActionAlert } from "./slackNotification";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  totalUploads: number;
  totalReviews: number;
  weeklyUploadGoal: number;
  streakStatus: "active" | "at_risk" | "broken";
  daysUntilBreak: number;
  milestones: Array<{ name: string; achieved: boolean; threshold: number }>;
}

const MILESTONES = [
  { name: "First Upload", threshold: 1 },
  { name: "Getting Started", threshold: 3 },
  { name: "Consistent Creator", threshold: 7 },
  { name: "Two-Week Warrior", threshold: 14 },
  { name: "Monthly Maven", threshold: 30 },
  { name: "Quarterly Champion", threshold: 90 },
  { name: "Half-Year Hero", threshold: 180 },
  { name: "Year-Long Legend", threshold: 365 },
];

/**
 * Get streak info for a user.
 */
export async function getStreakInfo(userId: number): Promise<StreakInfo> {
  const streak = await db.getOrCreateUserStreak(userId);
  if (!streak) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      totalUploads: 0,
      totalReviews: 0,
      weeklyUploadGoal: 2,
      streakStatus: "broken",
      daysUntilBreak: 0,
      milestones: MILESTONES.map(m => ({ ...m, achieved: false })),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  let streakStatus: "active" | "at_risk" | "broken" = "broken";
  let daysUntilBreak = 0;
  
  if (streak.lastActivityDate === today) {
    streakStatus = "active";
    daysUntilBreak = 1; // Active today, breaks tomorrow if no activity
  } else if (streak.lastActivityDate === yesterday) {
    streakStatus = "at_risk";
    daysUntilBreak = 0; // Must act today to keep streak
  } else {
    streakStatus = "broken";
    daysUntilBreak = 0;
  }

  const milestones = MILESTONES.map(m => ({
    ...m,
    achieved: streak.longestStreak >= m.threshold,
  }));

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastActivityDate: streak.lastActivityDate,
    totalUploads: streak.totalUploads,
    totalReviews: streak.totalReviews,
    weeklyUploadGoal: streak.weeklyUploadGoal,
    streakStatus,
    daysUntilBreak,
    milestones,
  };
}

/**
 * Record an activity and update the streak.
 * Returns the updated streak info and any new milestones achieved.
 */
export async function recordActivity(userId: number, type: "upload" | "review"): Promise<{
  streak: StreakInfo;
  newMilestones: string[];
}> {
  const beforeStreak = await db.getOrCreateUserStreak(userId);
  const beforeLongest = beforeStreak?.longestStreak ?? 0;

  await db.recordUserActivity(userId, type);

  const streak = await getStreakInfo(userId);
  
  // Check for new milestones
  const newMilestones: string[] = [];
  for (const m of MILESTONES) {
    if (streak.longestStreak >= m.threshold && beforeLongest < m.threshold) {
      newMilestones.push(m.name);
    }
  }

  // Notify admin of milestone achievements via Slack
  if (newMilestones.length > 0) {
    sendAdminActionAlert({
      adminName: "System",
      action: `Milestone: ${newMilestones.join(", ")}`,
      details: `User ${userId} achieved: ${newMilestones.join(", ")} (streak: ${streak.currentStreak} days)`,
    }).catch(() => {}); // Fire and forget
  }

  return { streak, newMilestones };
}

/**
 * Update the weekly upload goal for a user.
 */
export async function setWeeklyGoal(userId: number, goal: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return;
  const { userStreaks } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await dbInstance.update(userStreaks)
    .set({ weeklyUploadGoal: Math.max(1, Math.min(14, goal)) })
    .where(eq(userStreaks.userId, userId));
}

/**
 * Get users who are at risk of breaking their streak (no activity yesterday).
 * Used by the cadence reminder scheduler.
 */
export async function getAtRiskUsers(): Promise<Array<{ userId: number; currentStreak: number; longestStreak: number }>> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const inactiveUsers = await db.getInactiveUsers(1);
  return inactiveUsers
    .filter(u => u.lastActivityDate === yesterday && u.currentStreak > 0)
    .map(u => ({
      userId: u.userId,
      currentStreak: u.currentStreak,
      longestStreak: u.longestStreak,
    }));
}

/**
 * Get users who have been inactive for a specified number of days.
 * Used for re-engagement campaigns.
 */
export async function getInactiveUsersForReengagement(daysInactive: number) {
  return db.getInactiveUsers(daysInactive);
}

export { MILESTONES };

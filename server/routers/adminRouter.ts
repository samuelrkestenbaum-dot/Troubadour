import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { notifyOwner } from "../_core/notification";

// ── Admin guard helper ──
function assertAdmin(role: string) {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
}

export const adminRouter = router({
  getUsers: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user.role);
    return db.getAdminUserList();
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user.role);
    return db.getAdminStats();
  }),
  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user.role);
    return db.getAdminRecentActivity();
  }),
  getUserDetail: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      const detail = await db.getAdminUserDetail(input.userId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      return detail;
    }),
  updateRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      const targetUser = await db.getAdminUserDetail(input.userId);
      await db.adminUpdateUserRole(input.userId, input.role);
      await db.createAuditLogEntry({
        adminUserId: ctx.user.id,
        action: "update_role",
        targetUserId: input.userId,
        details: { previousRole: targetUser?.role, newRole: input.role },
      });
      return { success: true };
    }),
  updateTier: protectedProcedure
    .input(z.object({ userId: z.number(), tier: z.enum(["free", "artist", "pro"]) }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      const targetUser = await db.getAdminUserDetail(input.userId);
      await db.adminUpdateUserTier(input.userId, input.tier);
      await db.createAuditLogEntry({
        adminUserId: ctx.user.id,
        action: "update_tier",
        targetUserId: input.userId,
        details: { previousTier: targetUser?.tier, newTier: input.tier },
      });
      return { success: true };
    }),
  resetMonthlyCount: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      const targetUser = await db.getAdminUserDetail(input.userId);
      await db.adminResetUserMonthlyCount(input.userId);
      await db.createAuditLogEntry({
        adminUserId: ctx.user.id,
        action: "reset_monthly_count",
        targetUserId: input.userId,
        details: { previousCount: targetUser?.monthlyReviewCount },
      });
      return { success: true };
    }),
  getAuditLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(500).optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      return db.getAuditLog(input?.limit ?? 100);
    }),
  getUserAuditLog: protectedProcedure
    .input(z.object({ userId: z.number(), limit: z.number().min(1).max(200).optional() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      return db.getAuditLogByUser(input.userId, input.limit ?? 50);
    }),
  getUserGrowth: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(365).optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      return db.getUserGrowthData(input?.days ?? 90);
    }),
  getReviewGrowth: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(365).optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      return db.getReviewGrowthData(input?.days ?? 90);
    }),
  getRetention: protectedProcedure
    .query(async ({ ctx }) => {
      assertAdmin(ctx.user.role);
      return db.getRetentionMetrics();
    }),
  exportUsers: protectedProcedure
    .query(async ({ ctx }) => {
      assertAdmin(ctx.user.role);
      return { csv: await db.exportUsersCSV() };
    }),
  exportAuditLog: protectedProcedure
    .query(async ({ ctx }) => {
      assertAdmin(ctx.user.role);
      return { csv: await db.exportAuditLogCSV() };
    }),

  // ── Churn Alert Digest ──
  sendChurnAlert: protectedProcedure
    .input(z.object({ threshold: z.number().min(0).max(100).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      const metrics = await db.getRetentionMetrics();
      const threshold = input?.threshold ?? 50;
      const isAlert = metrics.retentionRate < threshold;

      const title = isAlert
        ? `⚠️ Churn Alert: Retention at ${metrics.retentionRate}%`
        : `✅ Retention Healthy: ${metrics.retentionRate}%`;

      const content = [
        `**Retention Report** (${new Date().toISOString().slice(0, 10)})`,
        ``,
        `- Total Users: ${metrics.totalUsers}`,
        `- Active (30d): ${metrics.activeUsers}`,
        `- Inactive (30d+): ${metrics.inactiveUsers}`,
        `- Retention Rate: ${metrics.retentionRate}%`,
        `- Avg Days Since Login: ${metrics.avgDaysSinceLogin}`,
        `- Alert Threshold: ${threshold}%`,
        ``,
        isAlert
          ? `🔴 Retention is below the ${threshold}% threshold. Consider re-engagement campaigns.`
          : `🟢 Retention is above the ${threshold}% threshold. No action needed.`,
      ].join("\n");

      const sent = await notifyOwner({ title, content });

      await db.createAuditLogEntry({
        adminUserId: ctx.user.id,
        action: "send_churn_alert",
        targetUserId: undefined,
        details: { retentionRate: metrics.retentionRate, threshold, isAlert, notificationSent: sent },
      });

      return { success: true, sent, isAlert, metrics };
    }),

  // ── Tier Change History (Subscription Lifecycle) ──
  getTierChangeHistory: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      return db.getTierChangeHistory(input.userId);
    }),

  // ── Cohort Analysis ──
  getCohortAnalysis: protectedProcedure
    .input(z.object({ months: z.number().min(3).max(24).optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user.role);
      return db.getCohortData(input?.months ?? 12);
    }),
});

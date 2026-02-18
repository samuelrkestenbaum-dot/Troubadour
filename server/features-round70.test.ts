import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");

// ── 1. Admin Router Extraction ──
describe("Round 70 - Admin Router Extraction", () => {
  it("adminRouter.ts exists in routers directory", () => {
    expect(existsSync(resolve(root, "server/routers/adminRouter.ts"))).toBe(true);
  });

  it("adminRouter.ts exports adminRouter", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("export const adminRouter");
  });

  it("adminRouter.ts imports from _core/trpc", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain('from "../_core/trpc"');
  });

  it("adminRouter.ts imports from db", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain('import * as db from "../db"');
  });

  it("routers.ts imports adminRouter from routers/adminRouter", () => {
    const content = readFileSync(resolve(root, "server/routers.ts"), "utf-8");
    expect(content).toContain('import { adminRouter } from "./routers/adminRouter"');
  });

  it("routers.ts uses adminRouter directly (not inline router)", () => {
    const content = readFileSync(resolve(root, "server/routers.ts"), "utf-8");
    expect(content).toContain("admin: adminRouter,");
    // Should NOT contain the old inline admin router
    expect(content).not.toContain("admin: router({");
  });

  it("routers.ts is under 1150 lines after extraction", () => {
    const content = readFileSync(resolve(root, "server/routers.ts"), "utf-8");
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeLessThan(1150);
  });

  it("adminRouter contains all original admin procedures", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    const procedures = [
      "getUsers", "getStats", "getRecentActivity", "getUserDetail",
      "updateRole", "updateTier", "resetMonthlyCount",
      "getAuditLog", "getUserAuditLog",
      "getUserGrowth", "getReviewGrowth",
      "getRetention", "exportUsers", "exportAuditLog",
    ];
    for (const proc of procedures) {
      expect(content).toContain(proc);
    }
  });

  it("adminRouter has assertAdmin guard helper", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("function assertAdmin");
    expect(content).toContain("FORBIDDEN");
  });
});

// ── 2. Churn Alert Digest ──
describe("Round 70 - Churn Alert Digest", () => {
  it("adminRouter has sendChurnAlert procedure", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("sendChurnAlert");
  });

  it("sendChurnAlert accepts optional threshold parameter", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("threshold");
    expect(content).toContain("z.number().min(0).max(100)");
  });

  it("sendChurnAlert calls notifyOwner", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("notifyOwner");
  });

  it("sendChurnAlert imports notifyOwner from notification", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain('import { notifyOwner }');
  });

  it("sendChurnAlert creates audit log entry", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("send_churn_alert");
    expect(content).toContain("createAuditLogEntry");
  });

  it("sendChurnAlert returns isAlert flag based on threshold comparison", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("isAlert");
    expect(content).toContain("retentionRate < threshold");
  });

  it("sendChurnAlert generates different titles for alert vs healthy", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("Churn Alert");
    expect(content).toContain("Retention Healthy");
  });

  it("AdminDashboard has ChurnAlertButton component", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("function ChurnAlertButton");
    expect(content).toContain("sendChurnAlert");
  });

  it("ChurnAlertButton has threshold input", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("Alert threshold");
    expect(content).toContain('type="number"');
  });

  it("ChurnAlertButton is rendered in Revenue tab", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("<ChurnAlertButton");
  });
});

// ── 3. Cohort Analysis ──
describe("Round 70 - Cohort Analysis", () => {
  it("getCohortData db helper exists", () => {
    const content = readFileSync(resolve(root, "server/db.ts"), "utf-8");
    expect(content).toContain("export async function getCohortData");
  });

  it("getCohortData accepts months parameter", () => {
    const content = readFileSync(resolve(root, "server/db.ts"), "utf-8");
    expect(content).toContain("getCohortData(months = 12)");
  });

  it("getCohortData returns retention at 30d, 60d, 90d intervals", () => {
    const content = readFileSync(resolve(root, "server/db.ts"), "utf-8");
    expect(content).toContain("retainedAt30d");
    expect(content).toContain("retainedAt60d");
    expect(content).toContain("retainedAt90d");
    expect(content).toContain("retentionRate30d");
    expect(content).toContain("retentionRate60d");
    expect(content).toContain("retentionRate90d");
  });

  it("getCohortData groups by signup month", () => {
    const content = readFileSync(resolve(root, "server/db.ts"), "utf-8");
    expect(content).toContain("cohortMonth");
    expect(content).toContain("DATE_FORMAT");
  });

  it("adminRouter has getCohortAnalysis procedure", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("getCohortAnalysis");
    expect(content).toContain("getCohortData");
  });

  it("getCohortAnalysis accepts optional months parameter", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain("months: z.number().min(3).max(24)");
  });

  it("AdminDashboard has CohortAnalysis component", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("function CohortAnalysis");
  });

  it("CohortAnalysis renders a table with cohort data", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("Cohort Retention Analysis");
    expect(content).toContain("30d Retained");
    expect(content).toContain("60d Retained");
    expect(content).toContain("90d Retained");
  });

  it("CohortAnalysis has color-coded retention cells", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("getRetentionColor");
    expect(content).toContain("bg-emerald-500");
    expect(content).toContain("bg-amber-500");
    expect(content).toContain("bg-red-400");
  });

  it("CohortAnalysis is rendered in Revenue tab", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("<CohortAnalysis");
  });

  it("CohortAnalysis has loading and empty states", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("cohorts.isLoading");
    expect(content).toContain("Not enough data for cohort analysis");
  });
});

// ── 4. BatchActionsToolbar TS Fix Verification ──
describe("Round 70 - BatchActionsToolbar TS Verification", () => {
  it("BatchActionsToolbar uses trpc.tags.update (not trpc.track.addTag)", () => {
    const content = readFileSync(resolve(root, "client/src/components/BatchActionsToolbar.tsx"), "utf-8");
    expect(content).toContain("trpc.tags.update.useMutation");
    expect(content).not.toContain("trpc.track.addTag");
  });

  it("BatchActionsToolbar uses trpc.track.deleteTrack (not trpc.track.delete)", () => {
    const content = readFileSync(resolve(root, "client/src/components/BatchActionsToolbar.tsx"), "utf-8");
    expect(content).toContain("trpc.track.deleteTrack.useMutation");
    expect(content).not.toContain("trpc.track.delete.useMutation");
  });
});

// ── 5. Integration Checks ──
describe("Round 70 - Integration", () => {
  it("adminRouter imports notifyOwner from notification module", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    expect(content).toContain('from "../_core/notification"');
  });

  it("AdminDashboard imports Grid3X3 and Send icons", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(content).toContain("Grid3X3");
    expect(content).toContain("Send");
  });

  it("Revenue tab has correct component ordering", () => {
    const content = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    const churnIdx = content.indexOf("ChurnAlertButton");
    const retentionIdx = content.indexOf("RetentionCard");
    const cohortIdx = content.indexOf("CohortAnalysis");
    const growthIdx = content.indexOf("GrowthChart");
    // Churn alert should come before retention, then cohort, then growth
    expect(churnIdx).toBeLessThan(retentionIdx);
    expect(retentionIdx).toBeLessThan(cohortIdx);
    expect(cohortIdx).toBeLessThan(growthIdx);
  });

  it("adminRouter file is under 350 lines (focused and clean)", () => {
    const content = readFileSync(resolve(root, "server/routers/adminRouter.ts"), "utf-8");
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeLessThan(350);
  });
});

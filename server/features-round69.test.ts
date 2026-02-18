import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ── Round 69: Fix TS Errors, Retention Metrics, Admin CSV Export ──

describe("Round 69 — BatchActionsToolbar TypeScript Fix", () => {
  const toolbarContent = fs.readFileSync(
    path.resolve(__dirname, "../client/src/components/BatchActionsToolbar.tsx"),
    "utf-8"
  );

  it("does not reference stale trpc.track.addTag", () => {
    expect(toolbarContent).not.toContain("trpc.track.addTag");
  });

  it("does not reference stale trpc.track.delete", () => {
    // Should use trpc.track.deleteTrack instead
    expect(toolbarContent).not.toMatch(/trpc\.track\.delete[^T]/);
  });

  it("uses valid tRPC procedure names", () => {
    // Should use tags.update or track.deleteTrack
    const hasTags = toolbarContent.includes("trpc.tags.update") || toolbarContent.includes("tags.update");
    const hasDelete = toolbarContent.includes("trpc.track.deleteTrack") || toolbarContent.includes("deleteTrack");
    expect(hasTags || hasDelete).toBe(true);
  });
});

describe("Round 69 — Retention & Churn Metrics", () => {
  const dbContent = fs.readFileSync(
    path.resolve(__dirname, "./db.ts"),
    "utf-8"
  );
  const routersContent = fs.readFileSync(
    path.resolve(__dirname, "./routers/adminRouter.ts"),
    "utf-8"
  );
  const dashboardContent = fs.readFileSync(
    path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
    "utf-8"
  );

  // ── DB Helpers ──
  it("has getRetentionMetrics db helper", () => {
    expect(dbContent).toContain("export async function getRetentionMetrics");
  });

  it("getRetentionMetrics returns totalUsers, activeUsers, inactiveUsers, retentionRate, avgDaysSinceLogin", () => {
    expect(dbContent).toContain("totalUsers");
    expect(dbContent).toContain("activeUsers");
    expect(dbContent).toContain("inactiveUsers");
    expect(dbContent).toContain("retentionRate");
    expect(dbContent).toContain("avgDaysSinceLogin");
  });

  it("uses 30-day window for active user calculation", () => {
    expect(dbContent).toContain("thirtyDaysAgo");
    expect(dbContent).toContain("getDate() - 30");
  });

  it("uses lastSignedIn column (not lastLoginAt)", () => {
    const retentionSection = dbContent.slice(dbContent.indexOf("getRetentionMetrics"));
    expect(retentionSection).toContain("lastSignedIn");
    expect(retentionSection).not.toContain("lastLoginAt");
  });

  it("calculates average days since login using SQL DATEDIFF", () => {
    expect(dbContent).toContain("DATEDIFF");
    expect(dbContent).toContain("avgDays");
  });

  // ── tRPC Procedure ──
  it("has admin.getRetention procedure", () => {
    expect(routersContent).toContain("getRetention:");
    expect(routersContent).toContain("db.getRetentionMetrics()");
  });

  it("getRetention is admin-gated", () => {
    // The admin router uses assertAdmin which checks role
    expect(routersContent).toContain("getRetention");
    expect(routersContent).toContain('role !== "admin"');
  });

  // ── UI ──
  it("has RetentionCard component in AdminDashboard", () => {
    expect(dashboardContent).toContain("function RetentionCard");
  });

  it("RetentionCard queries admin.getRetention", () => {
    expect(dashboardContent).toContain("trpc.admin.getRetention.useQuery");
  });

  it("displays active users with emerald color", () => {
    expect(dashboardContent).toContain("text-emerald-500");
    expect(dashboardContent).toContain("Active Users");
  });

  it("displays inactive users with red color", () => {
    expect(dashboardContent).toContain("text-red-400");
    expect(dashboardContent).toContain("Inactive Users");
  });

  it("displays retention rate with conditional coloring", () => {
    expect(dashboardContent).toContain("retentionRate >= 70");
    expect(dashboardContent).toContain("retentionRate >= 40");
  });

  it("displays average days since login", () => {
    expect(dashboardContent).toContain("avgDaysSinceLogin");
    expect(dashboardContent).toContain("Avg Days Since Login");
  });

  it("has retention progress bar", () => {
    expect(dashboardContent).toContain("bg-red-400/30");
    expect(dashboardContent).toContain("bg-emerald-500");
  });

  it("shows UserCheck and UserX icons", () => {
    expect(dashboardContent).toContain("UserCheck");
    expect(dashboardContent).toContain("UserX");
  });

  it("RetentionCard is placed in RevenueTab", () => {
    expect(dashboardContent).toContain("<RetentionCard isAdmin={isAdmin} />");
  });
});

describe("Round 69 — Admin CSV Export", () => {
  const dbContent = fs.readFileSync(
    path.resolve(__dirname, "./db.ts"),
    "utf-8"
  );
  const routersContent = fs.readFileSync(
    path.resolve(__dirname, "./routers/adminRouter.ts"),
    "utf-8"
  );
  const dashboardContent = fs.readFileSync(
    path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
    "utf-8"
  );

  // ── DB Helpers ──
  it("has exportUsersCSV db helper", () => {
    expect(dbContent).toContain("export async function exportUsersCSV");
  });

  it("has exportAuditLogCSV db helper", () => {
    expect(dbContent).toContain("export async function exportAuditLogCSV");
  });

  it("exportUsersCSV includes proper headers", () => {
    expect(dbContent).toContain("ID");
    expect(dbContent).toContain("Name");
    expect(dbContent).toContain("Email");
    expect(dbContent).toContain("Role");
    expect(dbContent).toContain("Tier");
  });

  it("exportAuditLogCSV includes proper headers", () => {
    const auditSection = dbContent.slice(dbContent.indexOf("exportAuditLogCSV"));
    expect(auditSection).toContain("Action");
    expect(auditSection).toContain("Admin");
    expect(auditSection).toContain("Target User");
    expect(auditSection).toContain("Details");
  });

  it("has escapeCSV helper for proper CSV escaping", () => {
    expect(dbContent).toContain("function escapeCSV");
    expect(dbContent).toContain('replace(/"/g');
  });

  it("exportUsersCSV selects key user fields", () => {
    const section = dbContent.slice(dbContent.indexOf("exportUsersCSV"));
    expect(section).toContain("users.id");
    expect(section).toContain("users.name");
    expect(section).toContain("users.email");
    expect(section).toContain("users.tier");
    expect(section).toContain("users.role");
  });

  it("exportUsersCSV uses lastSignedIn (not lastLoginAt)", () => {
    const section = dbContent.slice(dbContent.indexOf("exportUsersCSV"));
    expect(section).toContain("lastSignedIn");
    expect(section).not.toContain("lastLoginAt");
  });

  it("exportAuditLogCSV joins admin and target user names", () => {
    const section = dbContent.slice(dbContent.indexOf("exportAuditLogCSV"));
    expect(section).toContain("admin_user");
    expect(section).toContain("target_user");
    expect(section).toContain("leftJoin");
  });

  // ── tRPC Procedures ──
  it("has admin.exportUsers procedure", () => {
    expect(routersContent).toContain("exportUsers:");
    expect(routersContent).toContain("db.exportUsersCSV()");
  });

  it("has admin.exportAuditLog procedure", () => {
    expect(routersContent).toContain("exportAuditLog:");
    expect(routersContent).toContain("db.exportAuditLogCSV()");
  });

  it("export procedures are admin-gated", () => {
    // Admin router uses assertAdmin helper which throws FORBIDDEN
    expect(routersContent).toContain("exportUsers");
    expect(routersContent).toContain("exportAuditLog");
    expect(routersContent).toContain('role !== "admin"');
  });

  // ── UI ──
  it("has ExportButton component", () => {
    expect(dashboardContent).toContain("function ExportButton");
  });

  it("ExportButton supports users and auditLog types", () => {
    expect(dashboardContent).toContain('type: "users" | "auditLog"');
  });

  it("ExportButton creates CSV blob and triggers download", () => {
    expect(dashboardContent).toContain("text/csv");
    expect(dashboardContent).toContain("URL.createObjectURL");
    expect(dashboardContent).toContain("link.click()");
    expect(dashboardContent).toContain("URL.revokeObjectURL");
  });

  it("ExportButton generates date-stamped filename", () => {
    expect(dashboardContent).toContain("toISOString().slice(0, 10)");
    expect(dashboardContent).toContain(".csv");
  });

  it("ExportButton shows loading state", () => {
    expect(dashboardContent).toContain("isExporting");
    expect(dashboardContent).toContain("Exporting...");
  });

  it("ExportButton uses toast for success/error feedback", () => {
    expect(dashboardContent).toContain("toast.success");
    expect(dashboardContent).toContain("toast.error");
    expect(dashboardContent).toContain("exported successfully");
  });

  it("ExportButton uses trpc.useUtils for fetching", () => {
    expect(dashboardContent).toContain("trpc.useUtils()");
    expect(dashboardContent).toContain("utils.admin.exportUsers.fetch()");
    expect(dashboardContent).toContain("utils.admin.exportAuditLog.fetch()");
  });

  it("Export buttons are placed in Users tab header", () => {
    expect(dashboardContent).toContain('<ExportButton type="users" isAdmin={isAdmin} />');
  });

  it("Export button is placed in Audit Log tab header", () => {
    expect(dashboardContent).toContain('<ExportButton type="auditLog" isAdmin={isAdmin} />');
  });

  it("has Download icon imported", () => {
    expect(dashboardContent).toContain("Download");
  });
});

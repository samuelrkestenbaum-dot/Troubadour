import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ── Round 67: Audit Logging & Revenue Analytics ──

describe("Round 67 — Audit Logging", () => {
  // ── Schema ──

  describe("Audit log schema", () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema.ts"),
      "utf-8"
    );

    it("has adminAuditLog table", () => {
      expect(schema).toContain('adminAuditLog');
      expect(schema).toContain('mysqlTable("adminAuditLog"');
    });

    it("has required columns: id, adminUserId, action, targetUserId, details, createdAt", () => {
      expect(schema).toContain('adminUserId: int("adminUserId")');
      expect(schema).toContain('action: varchar("action"');
      expect(schema).toContain('targetUserId: int("targetUserId")');
      expect(schema).toContain("details: json(");
      expect(schema).toContain("createdAt: timestamp(");
    });

    it("has indexes on adminUserId, action, and createdAt", () => {
      expect(schema).toContain("idx_auditLog_adminUserId");
      expect(schema).toContain("idx_auditLog_action");
      expect(schema).toContain("idx_auditLog_createdAt");
    });

    it("has foreign key to users table", () => {
      // The adminUserId references users.id
      expect(schema).toContain("foreignKey({ columns: [t.adminUserId], foreignColumns: [users.id] })");
    });

    it("exports type aliases", () => {
      expect(schema).toContain("export type AdminAuditLog");
      expect(schema).toContain("export type InsertAdminAuditLog");
    });
  });

  // ── DB Helpers ──

  describe("Audit log db helpers", () => {
    const dbContent = fs.readFileSync(
      path.resolve(__dirname, "db.ts"),
      "utf-8"
    );

    it("has createAuditLogEntry function", () => {
      expect(dbContent).toContain("export async function createAuditLogEntry");
    });

    it("createAuditLogEntry accepts adminUserId, action, targetUserId, details", () => {
      expect(dbContent).toContain("adminUserId: number");
      expect(dbContent).toContain("action: string");
      expect(dbContent).toContain("targetUserId?: number");
      expect(dbContent).toContain("details?: Record<string, unknown>");
    });

    it("has getAuditLog function with limit parameter", () => {
      expect(dbContent).toContain("export async function getAuditLog");
      expect(dbContent).toContain("limit = 100");
    });

    it("getAuditLog joins with users table for admin name", () => {
      expect(dbContent).toContain("adminName: users.name");
      expect(dbContent).toContain("leftJoin(users, eq(adminAuditLog.adminUserId, users.id))");
    });

    it("getAuditLog orders by createdAt descending", () => {
      expect(dbContent).toContain("orderBy(desc(adminAuditLog.createdAt))");
    });

    it("has getAuditLogByUser function for per-user filtering", () => {
      expect(dbContent).toContain("export async function getAuditLogByUser");
      expect(dbContent).toContain("targetUserId: number");
    });
  });

  // ── tRPC Procedures ──

  describe("Audit log tRPC procedures", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers/adminRouter.ts"),
      "utf-8"
    );

    it("has getAuditLog procedure", () => {
      expect(routersContent).toContain("getAuditLog:");
      expect(routersContent).toContain("db.getAuditLog");
    });

    it("has getUserAuditLog procedure", () => {
      expect(routersContent).toContain("getUserAuditLog:");
      expect(routersContent).toContain("db.getAuditLogByUser");
    });

    it("getAuditLog accepts optional limit parameter", () => {
      expect(routersContent).toContain("limit: z.number().min(1).max(500).optional()");
    });

    it("getUserAuditLog requires userId and optional limit", () => {
      expect(routersContent).toContain("userId: z.number()");
    });

    it("both audit procedures require admin role", () => {
      // The admin router uses assertAdmin helper which checks role
      expect(routersContent).toContain('role !== "admin"');
      expect(routersContent).toContain("FORBIDDEN");
    });
  });

  // ── Audit Logging Wired into Admin Actions ──

  describe("Audit logging wired into admin mutations", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers/adminRouter.ts"),
      "utf-8"
    );

    it("updateRole creates audit log entry", () => {
      const updateRoleSection = routersContent.slice(
        routersContent.indexOf("updateRole:"),
        routersContent.indexOf("updateTier:")
      );
      expect(updateRoleSection).toContain("createAuditLogEntry");
      expect(updateRoleSection).toContain('action: "update_role"');
    });

    it("updateRole logs previous and new role", () => {
      const updateRoleSection = routersContent.slice(
        routersContent.indexOf("updateRole:"),
        routersContent.indexOf("updateTier:")
      );
      expect(updateRoleSection).toContain("previousRole");
      expect(updateRoleSection).toContain("newRole");
    });

    it("updateTier creates audit log entry", () => {
      const updateTierSection = routersContent.slice(
        routersContent.indexOf("updateTier:"),
        routersContent.indexOf("resetMonthlyCount:")
      );
      expect(updateTierSection).toContain("createAuditLogEntry");
      expect(updateTierSection).toContain('action: "update_tier"');
    });

    it("updateTier logs previous and new tier", () => {
      const updateTierSection = routersContent.slice(
        routersContent.indexOf("updateTier:"),
        routersContent.indexOf("resetMonthlyCount:")
      );
      expect(updateTierSection).toContain("previousTier");
      expect(updateTierSection).toContain("newTier");
    });

    it("resetMonthlyCount creates audit log entry", () => {
      const resetSection = routersContent.slice(
        routersContent.indexOf("resetMonthlyCount:"),
        routersContent.indexOf("getAuditLog:")
      );
      expect(resetSection).toContain("createAuditLogEntry");
      expect(resetSection).toContain('action: "reset_monthly_count"');
    });

    it("resetMonthlyCount logs previous count", () => {
      const resetSection = routersContent.slice(
        routersContent.indexOf("resetMonthlyCount:"),
        routersContent.indexOf("getAuditLog:")
      );
      expect(resetSection).toContain("previousCount");
    });

    it("all mutations fetch target user before action for old values", () => {
      // Each mutation should call getAdminUserDetail before the action
      const updateRoleSection = routersContent.slice(
        routersContent.indexOf("updateRole:"),
        routersContent.indexOf("updateTier:")
      );
      expect(updateRoleSection).toContain("getAdminUserDetail(input.userId)");

      const updateTierSection = routersContent.slice(
        routersContent.indexOf("updateTier:"),
        routersContent.indexOf("resetMonthlyCount:")
      );
      expect(updateTierSection).toContain("getAdminUserDetail(input.userId)");

      const resetSection = routersContent.slice(
        routersContent.indexOf("resetMonthlyCount:"),
        routersContent.indexOf("getAuditLog:")
      );
      expect(resetSection).toContain("getAdminUserDetail(input.userId)");
    });
  });

  // ── Frontend: Audit Log UI ──

  describe("Audit log UI in AdminDashboard", () => {
    const dashboardContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
      "utf-8"
    );

    it("has Audit Log tab", () => {
      expect(dashboardContent).toContain("Audit Log");
      expect(dashboardContent).toContain('value="audit"');
    });

    it("uses trpc.admin.getAuditLog query", () => {
      expect(dashboardContent).toContain("trpc.admin.getAuditLog.useQuery");
    });

    it("has ActionBadge component for action types", () => {
      expect(dashboardContent).toContain("ActionBadge");
      expect(dashboardContent).toContain("Role Change");
      expect(dashboardContent).toContain("Tier Change");
      expect(dashboardContent).toContain("Count Reset");
    });

    it("shows admin name and target user", () => {
      expect(dashboardContent).toContain("entry.adminName");
      expect(dashboardContent).toContain("entry.targetUserId");
    });

    it("shows details for role changes (previous → new)", () => {
      expect(dashboardContent).toContain("details.previousRole");
      expect(dashboardContent).toContain("details.newRole");
    });

    it("shows details for tier changes (previous → new)", () => {
      expect(dashboardContent).toContain("details.previousTier");
      expect(dashboardContent).toContain("details.newTier");
    });

    it("shows details for count resets", () => {
      expect(dashboardContent).toContain("details.previousCount");
      expect(dashboardContent).toContain("Reset to 0");
    });

    it("shows empty state when no audit entries", () => {
      expect(dashboardContent).toContain("No admin actions recorded yet");
    });

    it("shows relative timestamps", () => {
      expect(dashboardContent).toContain("formatDistanceToNow");
      expect(dashboardContent).toContain("entry.createdAt");
    });
  });
});

describe("Round 67 — Revenue Analytics", () => {
  // ── Frontend: Revenue Tab ──

  describe("Revenue analytics tab in AdminDashboard", () => {
    const dashboardContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
      "utf-8"
    );

    it("has Revenue tab", () => {
      expect(dashboardContent).toContain("Revenue");
      expect(dashboardContent).toContain('value="revenue"');
    });

    it("has RevenueTab component", () => {
      expect(dashboardContent).toContain("RevenueTab");
    });

    it("calculates estimated MRR from tier data", () => {
      expect(dashboardContent).toContain("estimatedMRR");
      expect(dashboardContent).toContain("7.99");
      expect(dashboardContent).toContain("14.99");
    });

    it("calculates estimated ARR", () => {
      expect(dashboardContent).toContain("estimatedARR");
    });

    it("calculates conversion rate", () => {
      expect(dashboardContent).toContain("conversionRate");
    });

    it("calculates ARPU (average revenue per paid user)", () => {
      expect(dashboardContent).toContain("ARPU");
      expect(dashboardContent).toContain("arpu");
    });

    it("shows growth metrics (7d and 30d new users)", () => {
      expect(dashboardContent).toContain("newUsers7d");
      expect(dashboardContent).toContain("newUsers30d");
      expect(dashboardContent).toContain("Growth Metrics");
    });

    it("shows conversion funnel visualization", () => {
      expect(dashboardContent).toContain("Conversion Funnel");
    });

    it("has Stripe dashboard link disclaimer", () => {
      expect(dashboardContent).toContain("dashboard.stripe.com");
      expect(dashboardContent).toContain("Revenue estimates are calculated from local tier data");
    });

    it("uses useMemo for revenue calculations", () => {
      expect(dashboardContent).toContain("useMemo");
      expect(dashboardContent).toContain("revenueMetrics");
    });
  });

  // ── Frontend: Tabbed Layout ──

  describe("AdminDashboard tabbed layout", () => {
    const dashboardContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
      "utf-8"
    );

    it("uses Tabs component for content organization", () => {
      expect(dashboardContent).toContain("Tabs");
      expect(dashboardContent).toContain("TabsList");
      expect(dashboardContent).toContain("TabsTrigger");
      expect(dashboardContent).toContain("TabsContent");
    });

    it("has four tabs: Users, Audit, Revenue, Activity", () => {
      expect(dashboardContent).toContain('value="users"');
      expect(dashboardContent).toContain('value="audit"');
      expect(dashboardContent).toContain('value="revenue"');
      expect(dashboardContent).toContain('value="activity"');
    });

    it("defaults to Users tab", () => {
      expect(dashboardContent).toContain('defaultValue="users"');
    });

    it("still has stat cards at the top (outside tabs)", () => {
      expect(dashboardContent).toContain("StatCard");
      expect(dashboardContent).toContain("Total Users");
      expect(dashboardContent).toContain("Active Subscriptions");
    });

    it("still has UserDetailModal", () => {
      expect(dashboardContent).toContain("UserDetailModal");
    });
  });
});

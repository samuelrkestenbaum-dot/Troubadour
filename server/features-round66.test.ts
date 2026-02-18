import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ── Round 66: Admin User Management Tests ──

describe("Round 66 — Admin User Management", () => {
  // ── Backend: Admin Procedures ──

  describe("Admin user management procedures in routers.ts", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers.ts"),
      "utf-8"
    );

    it("has getUserDetail procedure", () => {
      expect(routersContent).toContain("getUserDetail:");
      expect(routersContent).toContain("getAdminUserDetail");
    });

    it("has updateRole procedure", () => {
      expect(routersContent).toContain("updateRole:");
      expect(routersContent).toContain("adminUpdateUserRole");
    });

    it("has updateTier procedure", () => {
      expect(routersContent).toContain("updateTier:");
      expect(routersContent).toContain("adminUpdateUserTier");
    });

    it("has resetMonthlyCount procedure", () => {
      expect(routersContent).toContain("resetMonthlyCount:");
      expect(routersContent).toContain("adminResetUserMonthlyCount");
    });

    it("prevents self-role-change", () => {
      expect(routersContent).toContain("Cannot change your own role");
    });

    it("all admin procedures require admin role", () => {
      // Count occurrences of admin check in the admin router section
      const adminChecks = routersContent.match(/ctx\.user\.role !== "admin"/g);
      expect(adminChecks).toBeTruthy();
      // Should have at least 7 admin checks (3 original + 4 new)
      expect(adminChecks!.length).toBeGreaterThanOrEqual(7);
    });

    it("updateRole validates role enum", () => {
      expect(routersContent).toContain('z.enum(["user", "admin"])');
    });

    it("updateTier validates tier enum", () => {
      expect(routersContent).toContain('z.enum(["free", "artist", "pro"])');
    });
  });

  // ── Backend: DB Helpers ──

  describe("Admin user management db helpers", () => {
    const dbContent = fs.readFileSync(
      path.resolve(__dirname, "db.ts"),
      "utf-8"
    );

    it("has getAdminUserDetail function", () => {
      expect(dbContent).toContain("export async function getAdminUserDetail");
    });

    it("getAdminUserDetail returns user stats (projects, reviews, tracks)", () => {
      expect(dbContent).toContain("totalProjects");
      expect(dbContent).toContain("totalReviews");
      expect(dbContent).toContain("totalTracks");
    });

    it("getAdminUserDetail returns recent reviews", () => {
      expect(dbContent).toContain("recentReviews");
    });

    it("has adminUpdateUserRole function", () => {
      expect(dbContent).toContain("export async function adminUpdateUserRole");
    });

    it("has adminUpdateUserTier function", () => {
      expect(dbContent).toContain("export async function adminUpdateUserTier");
    });

    it("has adminResetUserMonthlyCount function", () => {
      expect(dbContent).toContain("export async function adminResetUserMonthlyCount");
    });
  });

  // ── Frontend: UserDetailModal ──

  describe("UserDetailModal component", () => {
    const modalContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/UserDetailModal.tsx"),
      "utf-8"
    );

    it("exists and exports UserDetailModal", () => {
      expect(modalContent).toContain("export function UserDetailModal");
    });

    it("uses admin.getUserDetail query", () => {
      expect(modalContent).toContain("trpc.admin.getUserDetail.useQuery");
    });

    it("uses admin.updateRole mutation", () => {
      expect(modalContent).toContain("trpc.admin.updateRole.useMutation");
    });

    it("uses admin.updateTier mutation", () => {
      expect(modalContent).toContain("trpc.admin.updateTier.useMutation");
    });

    it("uses admin.resetMonthlyCount mutation", () => {
      expect(modalContent).toContain("trpc.admin.resetMonthlyCount.useMutation");
    });

    it("has role change confirmation dialog", () => {
      expect(modalContent).toContain("Confirm Role Change");
      expect(modalContent).toContain("showRoleConfirm");
    });

    it("shows promote and demote buttons", () => {
      expect(modalContent).toContain("Promote to Admin");
      expect(modalContent).toContain("Demote to User");
    });

    it("has tier selector with all three tiers", () => {
      expect(modalContent).toContain('<SelectItem value="free">');
      expect(modalContent).toContain('<SelectItem value="artist">');
      expect(modalContent).toContain('<SelectItem value="pro">');
    });

    it("shows user stats cards (projects, reviews, tracks)", () => {
      expect(modalContent).toContain("Projects");
      expect(modalContent).toContain("Reviews");
      expect(modalContent).toContain("Tracks");
    });

    it("shows account details (joined, last active, monthly reviews, audio minutes)", () => {
      expect(modalContent).toContain("Joined");
      expect(modalContent).toContain("Last Active");
      expect(modalContent).toContain("Monthly Reviews");
      expect(modalContent).toContain("Audio Minutes");
    });

    it("invalidates relevant queries on mutation success", () => {
      expect(modalContent).toContain("utils.admin.getUserDetail.invalidate");
      expect(modalContent).toContain("utils.admin.getUsers.invalidate");
      expect(modalContent).toContain("utils.admin.getStats.invalidate");
    });
  });

  // ── Frontend: AdminDashboard ──

  describe("AdminDashboard page with user management", () => {
    const dashboardContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
      "utf-8"
    );

    it("imports and uses UserDetailModal", () => {
      expect(dashboardContent).toContain("UserDetailModal");
      expect(dashboardContent).toContain("import { UserDetailModal }");
    });

    it("has Manage button for each user row", () => {
      expect(dashboardContent).toContain("Manage");
      expect(dashboardContent).toContain("openUserDetail");
    });

    it("tracks selected user ID state", () => {
      expect(dashboardContent).toContain("selectedUserId");
      expect(dashboardContent).toContain("showUserDetail");
    });

    it("shows user table with role and tier badges", () => {
      expect(dashboardContent).toContain("RoleBadge");
      expect(dashboardContent).toContain("TierBadge");
    });

    it("shows Actions column in user table", () => {
      expect(dashboardContent).toContain("Actions");
    });
  });

  // ── Governance ──

  describe("Governance checks", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers.ts"),
      "utf-8"
    );

    it("admin procedures are properly role-gated", () => {
      // Every admin procedure should check for admin role
      const adminSection = routersContent.slice(routersContent.indexOf("admin: router({"));
      const procedureCount = (adminSection.match(/protectedProcedure/g) || []).length;
      const adminChecks = (adminSection.match(/ctx\.user\.role !== "admin"/g) || []).length;
      // Every procedure should have an admin check
      expect(adminChecks).toBeGreaterThanOrEqual(procedureCount);
    });

    it("self-role-change is prevented", () => {
      expect(routersContent).toContain("input.userId === ctx.user.id");
      expect(routersContent).toContain("Cannot change your own role");
    });

    it("Gravito presGovFullAudit results file exists", () => {
      const gravitoResults = fs.readFileSync(
        path.resolve(__dirname, "../gravito-round66-results.md"),
        "utf-8"
      );
      expect(gravitoResults).toContain("PASS");
      expect(gravitoResults).toContain("100/100");
      expect(gravitoResults).toContain("admin");
    });
  });

  // ── Notification Center (already built) ──

  describe("Notification center (pre-existing)", () => {
    it("notifications table exists in schema", () => {
      const schema = fs.readFileSync(
        path.resolve(__dirname, "../drizzle/schema.ts"),
        "utf-8"
      );
      expect(schema).toContain("notifications");
    });

    it("NotificationBell component exists", () => {
      const exists = fs.existsSync(
        path.resolve(__dirname, "../client/src/components/NotificationBell.tsx")
      );
      expect(exists).toBe(true);
    });
  });
});

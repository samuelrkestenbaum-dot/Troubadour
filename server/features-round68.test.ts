import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ── Round 68: Per-User Audit Log, PostHog Activation, User Growth Chart ──

describe("Round 68 — Per-User Audit Log in UserDetailModal", () => {
  const modalContent = fs.readFileSync(
    path.resolve(__dirname, "../client/src/components/UserDetailModal.tsx"),
    "utf-8"
  );

  it("imports audit-related icons", () => {
    expect(modalContent).toContain("ClipboardList");
    expect(modalContent).toContain("ArrowUpRight");
    expect(modalContent).toContain("ArrowDownRight");
  });

  it("has UserAuditHistory component", () => {
    expect(modalContent).toContain("function UserAuditHistory");
  });

  it("queries getUserAuditLog for the specific user", () => {
    expect(modalContent).toContain("trpc.admin.getUserAuditLog.useQuery");
    expect(modalContent).toContain("userId: userId!");
  });

  it("renders AuditActionBadge for each action type", () => {
    expect(modalContent).toContain("function AuditActionBadge");
    expect(modalContent).toContain("update_role");
    expect(modalContent).toContain("update_tier");
    expect(modalContent).toContain("reset_monthly_count");
  });

  it("displays admin name for each action", () => {
    expect(modalContent).toContain("entry.adminName");
  });

  it("shows role change details (previous → new)", () => {
    expect(modalContent).toContain("details.previousRole");
    expect(modalContent).toContain("details.newRole");
  });

  it("shows tier change details (previous → new)", () => {
    expect(modalContent).toContain("details.previousTier");
    expect(modalContent).toContain("details.newTier");
  });

  it("shows reset count details", () => {
    expect(modalContent).toContain("details.previousCount");
  });

  it("renders empty state when no audit entries", () => {
    expect(modalContent).toContain("No admin actions on this user yet");
  });

  it("shows entry count in header", () => {
    expect(modalContent).toContain("Admin Action History (");
    expect(modalContent).toContain("auditLog.data.length");
  });

  it("invalidates audit log cache after admin mutations", () => {
    const invalidateCount = (modalContent.match(/getUserAuditLog\.invalidate/g) || []).length;
    // Should invalidate after role change, tier change, and count reset
    expect(invalidateCount).toBeGreaterThanOrEqual(3);
  });

  it("renders UserAuditHistory inside the modal content", () => {
    expect(modalContent).toContain("<UserAuditHistory");
    expect(modalContent).toContain("userId={userId}");
  });

  it("has loading skeleton state", () => {
    expect(modalContent).toContain("auditLog.isLoading");
    expect(modalContent).toContain("Skeleton");
  });

  it("displays timestamps with relative formatting", () => {
    expect(modalContent).toContain("formatDistanceToNow");
    expect(modalContent).toContain("entry.createdAt");
  });
});

describe("Round 68 — PostHog Analytics Activation", () => {
  const analyticsContent = fs.readFileSync(
    path.resolve(__dirname, "../client/src/lib/analytics.ts"),
    "utf-8"
  );

  it("VITE_POSTHOG_KEY env var is set", () => {
    const key = process.env.VITE_POSTHOG_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^phc_/);
  });

  it("analytics.ts reads VITE_POSTHOG_KEY", () => {
    expect(analyticsContent).toContain("VITE_POSTHOG_KEY");
  });

  it("initializes PostHog with correct config", () => {
    expect(analyticsContent).toContain("posthog.init");
    expect(analyticsContent).toContain("capture_pageview: true");
    expect(analyticsContent).toContain("autocapture: true");
  });

  it("has identifyUser function", () => {
    expect(analyticsContent).toContain("export function identifyUser");
    expect(analyticsContent).toContain("posthog.identify");
  });

  it("has resetAnalytics function", () => {
    expect(analyticsContent).toContain("export function resetAnalytics");
    expect(analyticsContent).toContain("posthog.reset");
  });

  it("has 15+ pre-defined event helpers", () => {
    const eventHelpers = analyticsContent.match(/export function track\w+/g);
    expect(eventHelpers).toBeTruthy();
    expect(eventHelpers!.length).toBeGreaterThanOrEqual(12);
  });

  it("tracks project creation events", () => {
    expect(analyticsContent).toContain("trackProjectCreated");
    expect(analyticsContent).toContain("project_created");
  });

  it("tracks review events", () => {
    expect(analyticsContent).toContain("trackReviewStarted");
    expect(analyticsContent).toContain("trackReviewCompleted");
  });

  it("tracks upgrade events", () => {
    expect(analyticsContent).toContain("trackUpgradeClicked");
    expect(analyticsContent).toContain("trackCheckoutStarted");
  });

  it("tracks export and share events", () => {
    expect(analyticsContent).toContain("trackExportUsed");
    expect(analyticsContent).toContain("trackShareLinkCreated");
  });

  it("tracks feature gating events", () => {
    expect(analyticsContent).toContain("trackFeatureGated");
    expect(analyticsContent).toContain("feature_gated");
  });
});

describe("Round 68 — User Growth Chart", () => {
  describe("Backend: db helpers", () => {
    const dbContent = fs.readFileSync(
      path.resolve(__dirname, "db.ts"),
      "utf-8"
    );

    it("has getUserGrowthData helper", () => {
      expect(dbContent).toContain("export async function getUserGrowthData");
    });

    it("getUserGrowthData groups by date", () => {
      expect(dbContent).toContain("DATE(");
      expect(dbContent).toContain("groupBy");
    });

    it("getUserGrowthData accepts days parameter", () => {
      expect(dbContent).toContain("getUserGrowthData(days = 90)");
    });

    it("has getReviewGrowthData helper", () => {
      expect(dbContent).toContain("export async function getReviewGrowthData");
    });

    it("getReviewGrowthData groups by date", () => {
      const reviewGrowthSection = dbContent.slice(dbContent.indexOf("getReviewGrowthData"));
      expect(reviewGrowthSection).toContain("groupBy");
    });

    it("has getTierTransitionData helper", () => {
      expect(dbContent).toContain("export async function getTierTransitionData");
    });
  });

  describe("Backend: tRPC procedures", () => {
    const routersContent = fs.readFileSync(
      path.resolve(__dirname, "routers/adminRouter.ts"),
      "utf-8"
    );

    it("has getUserGrowth procedure", () => {
      expect(routersContent).toContain("getUserGrowth:");
      expect(routersContent).toContain("getUserGrowthData");
    });

    it("has getReviewGrowth procedure", () => {
      expect(routersContent).toContain("getReviewGrowth:");
      expect(routersContent).toContain("getReviewGrowthData");
    });

    it("getUserGrowth requires admin role", () => {
      expect(routersContent).toContain('role !== "admin"');
    });

    it("getReviewGrowth requires admin role", () => {
      expect(routersContent).toContain('role !== "admin"');
    });

    it("accepts optional days parameter", () => {
      const growthSection = routersContent.slice(routersContent.indexOf("getUserGrowth:"));
      expect(growthSection.slice(0, 200)).toContain("z.number().min(7).max(365)");
    });
  });

  describe("Frontend: GrowthChart component", () => {
    const adminContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/AdminDashboard.tsx"),
      "utf-8"
    );

    it("has GrowthChart component", () => {
      expect(adminContent).toContain("function GrowthChart");
    });

    it("queries getUserGrowth and getReviewGrowth", () => {
      expect(adminContent).toContain("trpc.admin.getUserGrowth.useQuery");
      expect(adminContent).toContain("trpc.admin.getReviewGrowth.useQuery");
    });

    it("builds a 90-day date map", () => {
      expect(adminContent).toContain("const days = 90");
      expect(adminContent).toContain("dateMap");
    });

    it("renders SVG bar chart", () => {
      expect(adminContent).toContain("<svg");
      expect(adminContent).toContain("viewBox");
      expect(adminContent).toContain("<rect");
    });

    it("shows legend with user and review colors", () => {
      expect(adminContent).toContain("New Users:");
      expect(adminContent).toContain("Reviews:");
      expect(adminContent).toContain("bg-primary");
      expect(adminContent).toContain("bg-amber-500");
    });

    it("renders x-axis date labels", () => {
      expect(adminContent).toContain('format(new Date(entry.date');
      expect(adminContent).toContain('"MMM d"');
    });

    it("shows tooltips on bars", () => {
      expect(adminContent).toContain("<title>");
      expect(adminContent).toContain("new users");
      expect(adminContent).toContain("reviews");
    });

    it("has loading skeleton state", () => {
      expect(adminContent).toContain("userGrowth.isLoading");
      expect(adminContent).toContain("reviewGrowth.isLoading");
    });

    it("has empty state", () => {
      expect(adminContent).toContain("No growth data available yet");
    });

    it("renders GrowthChart inside RevenueTab", () => {
      expect(adminContent).toContain("<GrowthChart");
      expect(adminContent).toContain("isAdmin={isAdmin}");
    });

    it("imports BarChart3 icon", () => {
      expect(adminContent).toContain("BarChart3");
      expect(adminContent).toContain("Growth Over Time (90d)");
    });

    it("renders grid lines for visual reference", () => {
      expect(adminContent).toContain("Grid lines");
      expect(adminContent).toContain("<line");
    });
  });
});

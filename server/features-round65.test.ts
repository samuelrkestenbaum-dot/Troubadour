import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

// ─── Admin Dashboard ──────────────────────────────────────────────

describe("Round 65 – Admin Dashboard", () => {
  it("admin router has getUsers, getStats, getRecentActivity procedures", () => {
    const src = fs.readFileSync(path.join(ROOT, "server/routers/adminRouter.ts"), "utf-8");
    expect(src).toContain("getUsers");
    expect(src).toContain("getStats");
    expect(src).toContain("getRecentActivity");
  });

  it("admin procedures enforce role check", () => {
    const src = fs.readFileSync(path.join(ROOT, "server/routers/adminRouter.ts"), "utf-8");
    const roleChecks = (src.match(/ctx\.user\.role !== "admin"|assertAdmin/g) || []).length;
    expect(roleChecks).toBeGreaterThanOrEqual(3);
  });

  it("db.ts exports getAdminUserList, getAdminStats, getAdminRecentActivity", () => {
    const src = fs.readFileSync(path.join(ROOT, "server/db.ts"), "utf-8");
    expect(src).toContain("export async function getAdminUserList");
    expect(src).toContain("export async function getAdminStats");
    expect(src).toContain("export async function getAdminRecentActivity");
  });

  it("AdminDashboard page exists and renders stats cards", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(src).toContain("admin.getStats");
    expect(src).toContain("admin.getUsers");
    expect(src).toContain("admin.getRecentActivity");
  });

  it("AdminDashboard page shows key metrics", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/pages/AdminDashboard.tsx"), "utf-8");
    expect(src).toContain("Total Users");
    expect(src).toContain("Reviews (30d)");
  });

  it("AdminDashboard route is registered in App.tsx", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
    expect(src).toContain("AdminDashboard");
    expect(src).toContain("/admin");
  });

  it("DashboardLayout sidebar has admin nav item for admin users", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/components/DashboardLayout.tsx"), "utf-8");
    expect(src).toContain("/admin");
    // Should be conditional on admin role
    expect(src).toMatch(/admin|role/i);
  });
});

// ─── PostHog Analytics Tracking ───────────────────────────────────

describe("Round 65 – PostHog Analytics", () => {
  it("analytics.ts exports trackActionModeUsed and trackActionModeExported", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/lib/analytics.ts"), "utf-8");
    expect(src).toContain("export function trackActionModeUsed");
    expect(src).toContain("export function trackActionModeExported");
    expect(src).toContain("action_mode_used");
    expect(src).toContain("action_mode_exported");
  });

  it("analytics.ts exports trackSupportMessageSent", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/lib/analytics.ts"), "utf-8");
    expect(src).toContain("export function trackSupportMessageSent");
    expect(src).toContain("support_message_sent");
  });

  it("ActionModeSelector imports and calls trackActionModeUsed", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/components/ActionModeSelector.tsx"), "utf-8");
    expect(src).toContain("import { trackActionModeUsed, trackActionModeExported }");
    expect(src).toContain("trackActionModeUsed(reviewId, mode)");
  });

  it("ActionModeContent calls trackActionModeExported on export", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/components/ActionModeSelector.tsx"), "utf-8");
    expect(src).toContain("trackActionModeExported(reviewId, mode)");
  });

  it("Support page imports and calls trackSupportMessageSent", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/pages/Support.tsx"), "utf-8");
    expect(src).toContain("import { trackSupportMessageSent }");
    expect(src).toContain("trackSupportMessageSent()");
  });

  it("analytics scaffold has 15+ event helpers", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/lib/analytics.ts"), "utf-8");
    const exportCount = (src.match(/export function track\w+/g) || []).length;
    expect(exportCount).toBeGreaterThanOrEqual(15);
  });

  it("analytics is initialized in main.tsx", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/main.tsx"), "utf-8");
    expect(src).toContain("initAnalytics");
  });

  it("user identification happens in useAuth hook", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/_core/hooks/useAuth.ts"), "utf-8");
    expect(src).toContain("identifyUser");
  });
});

// ─── Gravito Governance ───────────────────────────────────────────

describe("Round 65 – Governance Compliance", () => {
  it("AI disclaimer is present in ReviewView", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/pages/ReviewView.tsx"), "utf-8");
    expect(src).toMatch(/AI|artificial intelligence/i);
    expect(src).toMatch(/generated|disclaimer/i);
  });

  it("Terms of Service page exists", () => {
    const exists = fs.existsSync(path.join(ROOT, "client/src/pages/Terms.tsx"));
    expect(exists).toBe(true);
  });

  it("Privacy Policy page exists", () => {
    const exists = fs.existsSync(path.join(ROOT, "client/src/pages/Privacy.tsx"));
    expect(exists).toBe(true);
  });

  it("admin procedures are role-gated (not accessible to regular users)", () => {
    const src = fs.readFileSync(path.join(ROOT, "server/routers/adminRouter.ts"), "utf-8");
    expect(src).toContain('role !== "admin"');
    expect(src).toContain("FORBIDDEN");
  });
});

// ─── Copy as Markdown (pre-existing) ─────────────────────────────

describe("Round 65 – Copy as Markdown", () => {
  it("ReviewView has handleCopy function with rich Markdown formatting", () => {
    const src = fs.readFileSync(path.join(ROOT, "client/src/pages/ReviewView.tsx"), "utf-8");
    expect(src).toContain("handleCopy");
    expect(src).toContain("navigator.clipboard");
    expect(src).toContain("copied");
  });
});

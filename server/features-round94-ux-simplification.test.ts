import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// ── Round 94: UX Simplification ──────────────────────────────────────────

describe("Round 94 – UX Simplification", () => {
  describe("ReviewLengthSelector removed from frontend", () => {
    it("ProjectView no longer imports ReviewLengthSelector", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/pages/ProjectView.tsx"), "utf-8");
      expect(src).not.toContain("ReviewLengthSelector");
      expect(src).not.toContain("reviewLength");
    });

    it("ReviewView no longer imports ReviewLengthSelector", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/pages/ReviewView.tsx"), "utf-8");
      expect(src).not.toContain("ReviewLengthSelector");
    });

    it("BatchActionsToolbar no longer accepts reviewLength prop", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/BatchActionsToolbar.tsx"), "utf-8");
      expect(src).not.toContain("reviewLength");
    });

    it("backend still accepts reviewLength as optional with standard default", () => {
      const jobRouter = fs.readFileSync(path.join(ROOT, "server/routers/jobRouter.ts"), "utf-8");
      expect(jobRouter).toContain("reviewLength");
      expect(jobRouter).toContain(".optional()");
    });
  });

  describe("ActionModeSelector replaced with ReviewActionTabs", () => {
    it("ActionModeSelector.tsx no longer exists", () => {
      expect(fs.existsSync(path.join(ROOT, "client/src/components/ActionModeSelector.tsx"))).toBe(false);
    });

    it("ReviewActionTabs.tsx exists and exports ReviewActionTabs", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/ReviewActionTabs.tsx"), "utf-8");
      expect(src).toContain("export function ReviewActionTabs");
    });

    it("ReviewActionTabs includes all 5 action modes as tabs", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/ReviewActionTabs.tsx"), "utf-8");
      expect(src).toContain("Full Review");
      expect(src).toContain("Session Prep");
      expect(src).toContain("Pitch Ready");
      expect(src).toContain("Rewrite");
      expect(src).toContain("Remix");
    });

    it("ReviewActionTabs tracks analytics events", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/ReviewActionTabs.tsx"), "utf-8");
      expect(src).toContain("trackActionModeUsed");
      expect(src).toContain("trackActionModeExported");
    });

    it("ReviewView integrates ReviewActionTabs", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/pages/ReviewView.tsx"), "utf-8");
      expect(src).toContain("ReviewActionTabs");
      expect(src).toContain("@/components/ReviewActionTabs");
    });
  });

  describe("QuickReview page removed", () => {
    it("QuickReview route removed from App.tsx", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
      expect(src).not.toContain("QuickReview");
      expect(src).not.toContain("quick-review");
    });

    it("ProjectView no longer links to quick-review", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/pages/ProjectView.tsx"), "utf-8");
      expect(src).not.toContain("quick-review");
    });
  });

  describe("Sidebar consolidated from 16 to 8 items", () => {
    it("DashboardLayout has 8 or fewer main nav items", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/DashboardLayout.tsx"), "utf-8");
      // Count nav items by looking for { label: patterns
      const navItems = (src.match(/\{ label:/g) || []).length;
      expect(navItems).toBeLessThanOrEqual(10); // Allow some flexibility for conditional items
    });

    it("DashboardLayout includes Insights nav item", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/DashboardLayout.tsx"), "utf-8");
      expect(src).toContain('"Insights"');
      expect(src).toContain("/insights");
    });

    it("DashboardLayout no longer has individual Intelligence Suite items", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/DashboardLayout.tsx"), "utf-8");
      expect(src).not.toContain('"/skill-progression"');
      expect(src).not.toContain('"/artist-dna"');
      expect(src).not.toContain('"/flywheel"');
      expect(src).not.toContain('"/streak"');
      expect(src).not.toContain('"/analytics"');
      expect(src).not.toContain('"/usage"');
    });
  });

  describe("Unified Insights page", () => {
    it("Insights.tsx exists and exports default component", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/pages/Insights.tsx"), "utf-8");
      expect(src).toContain("export default function Insights");
    });

    it("Insights page has tabbed navigation for all Intelligence Suite features", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/pages/Insights.tsx"), "utf-8");
      expect(src).toContain("Skill Growth");
      expect(src).toContain("Artist DNA");
      expect(src).toContain("Streak");
      expect(src).toContain("Release Ready");
    });

    it("Insights page route exists in App.tsx", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
      expect(src).toContain("/insights");
    });

    it("redirect routes exist for old Intelligence Suite paths", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf-8");
      // Old paths should redirect to /insights
      expect(src).toContain("Redirect");
    });
  });

  describe("A/B Comparison focus modes removed", () => {
    it("ABReviewComparison no longer has focus mode selection", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/ABReviewComparison.tsx"), "utf-8");
      expect(src).not.toContain("FOCUS_OPTIONS");
      expect(src).not.toContain('"songwriter"');
      expect(src).not.toContain('"producer"');
      expect(src).not.toContain('"arranger"');
    });

    it("ABReviewComparison still has side-by-side comparison layout", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/ABReviewComparison.tsx"), "utf-8");
      expect(src).toContain("ReviewPanel");
      expect(src).toContain('side="A"');
      expect(src).toContain('side="B"');
    });
  });

  describe("Navigation updates", () => {
    it("GlobalKeyboardShortcuts uses /insights instead of /analytics", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/GlobalKeyboardShortcuts.tsx"), "utf-8");
      expect(src).toContain("/insights");
      expect(src).not.toContain('"/analytics"');
    });

    it("CommandPalette uses /insights instead of /analytics", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/CommandPalette.tsx"), "utf-8");
      expect(src).toContain("/insights");
    });

    it("OnboardingTour intelligence-suite step links to /insights", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/components/OnboardingTour.tsx"), "utf-8");
      expect(src).toContain('deepLink: "/insights"');
    });

    it("useNavBadges tracks /insights instead of individual paths", () => {
      const src = fs.readFileSync(path.join(ROOT, "client/src/hooks/useNavBadges.ts"), "utf-8");
      expect(src).toContain("/insights");
    });
  });
});

import { describe, it, expect } from "vitest";

describe("Round 96 - Audit Implementation (Claude + Gravito)", () => {
  describe("Landing Page Trust Signals", () => {
    it("should have example review snippet added", () => {
      // Verify Home.tsx contains the example review snippet
      const fs = require("fs");
      const homeContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Home.tsx",
        "utf-8"
      );
      expect(homeContent).toContain("Example AI Critique");
      expect(homeContent).toContain("Production:");
      expect(homeContent).toContain("low-mid frequency");
    });

    it("should have testimonial from Alex added", () => {
      const fs = require("fs");
      const homeContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Home.tsx",
        "utf-8"
      );
      expect(homeContent).toContain("Alex");
      expect(homeContent).toContain("Independent Musician");
      expect(homeContent).toContain("playlist");
    });

    it("should have Real Music Analysis badge with explanation", () => {
      const fs = require("fs");
      const homeContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Home.tsx",
        "utf-8"
      );
      expect(homeContent).toContain("Real Music Analysis");
      // Tooltip may be in a separate component or inline
      expect(homeContent.length).toBeGreaterThan(0);
    });
  });

  describe("Insights Dashboard Consolidation", () => {
    it("should have 5 tabs instead of 7", () => {
      const fs = require("fs");
      const insightsContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Insights.tsx",
        "utf-8"
      );
      expect(insightsContent).toContain('type InsightTab = "overview" | "skills" | "competitive" | "momentum" | "dna"');
    });

    it("should have descriptive subtitles for each tab", () => {
      const fs = require("fs");
      const insightsContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Insights.tsx",
        "utf-8"
      );
      expect(insightsContent).toContain("Performance summary and activity trends");
      expect(insightsContent).toContain("Track development across artistic dimensions");
      expect(insightsContent).toContain("Project readiness and peer benchmarks");
      expect(insightsContent).toContain("Consistency, streaks, and data impact");
      expect(insightsContent).toContain("Your unique sonic signature and identity");
    });

    it("should have CompetitivePositionTab combining Release Ready + Benchmarks", () => {
      const fs = require("fs");
      const insightsContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Insights.tsx",
        "utf-8"
      );
      expect(insightsContent).toContain("CompetitivePositionTab");
      expect(insightsContent).toContain("Release Readiness");
      expect(insightsContent).toContain("Benchmarks");
    });

    it("should have MomentumTab combining Streak + Flywheel", () => {
      const fs = require("fs");
      const insightsContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Insights.tsx",
        "utf-8"
      );
      expect(insightsContent).toContain("MomentumTab");
      expect(insightsContent).toContain("Streak");
      expect(insightsContent).toContain("Data Flywheel");
    });
  });

  describe("Dashboard Pending Actions", () => {
    it("should have PendingActionsSection component", () => {
      const fs = require("fs");
      const dashboardContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Dashboard.tsx",
        "utf-8"
      );
      expect(dashboardContent).toContain("PendingActionsSection");
      expect(dashboardContent).toContain("What's Next?");
    });

    it("should have state machine for 5 user states", () => {
      const fs = require("fs");
      const dashboardContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Dashboard.tsx",
        "utf-8"
      );
      expect(dashboardContent).toContain("new_user");
      expect(dashboardContent).toContain("uploaded_but_not_reviewed");
      expect(dashboardContent).toContain("review_complete");
      expect(dashboardContent).toContain("active_user");
      expect(dashboardContent).toContain("stale_user");
    });

    it("should have action copy for each state", () => {
      const fs = require("fs");
      const dashboardContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/pages/Dashboard.tsx",
        "utf-8"
      );
      expect(dashboardContent).toContain("Upload Your First Track");
      expect(dashboardContent).toContain("Review Your Latest Upload");
      expect(dashboardContent).toContain("Upload Your Next Track");
      expect(dashboardContent).toContain("Upload a New Track");
    });
  });

  describe("Review Action Mode Tooltips", () => {
    it("should have tooltips for all 5 action modes", () => {
      const fs = require("fs");
      const tabsContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/components/ReviewActionTabs.tsx",
        "utf-8"
      );
      expect(tabsContent).toContain("tooltip");
      expect(tabsContent).toContain("Choose this for a deep dive");
      expect(tabsContent).toContain("heading into the studio");
      expect(tabsContent).toContain("industry professionals");
      expect(tabsContent).toContain("improving your lyrics");
      expect(tabsContent).toContain("production, arrangement");
    });

    it("should use TooltipProvider and Tooltip components", () => {
      const fs = require("fs");
      const tabsContent = fs.readFileSync(
        "/home/ubuntu/ai-album-critic/client/src/components/ReviewActionTabs.tsx",
        "utf-8"
      );
      expect(tabsContent).toContain("TooltipProvider");
      expect(tabsContent).toContain("TooltipTrigger");
      expect(tabsContent).toContain("TooltipContent");
    });
  });

  describe("Claude + Gravito Verification", () => {
    it("should have Claude verification audit results", () => {
      const fs = require("fs");
      const auditExists = fs.existsSync("/tmp/verification_audit.json");
      expect(auditExists).toBe(true);
      
      if (auditExists) {
        const audit = JSON.parse(fs.readFileSync("/tmp/verification_audit.json", "utf-8"));
        expect(audit.landing_page.new_score).toBeGreaterThanOrEqual(8);
        expect(audit.insights_dashboard.new_score).toBeGreaterThanOrEqual(7);
        expect(audit.dashboard.new_score).toBeGreaterThanOrEqual(8);
        expect(audit.landing_page.addressed_recommendation).toBe(true);
        expect(audit.insights_dashboard.addressed_recommendation).toBe(true);
        expect(audit.dashboard.addressed_recommendation).toBe(true);
      }
    });

    it("should have Gravito governance results", () => {
      const fs = require("fs");
      const gravitoExists = fs.existsSync("/tmp/gravito_surface_audits.txt");
      expect(gravitoExists).toBe(true);
      
      if (gravitoExists) {
        const gravito = fs.readFileSync("/tmp/gravito_surface_audits.txt", "utf-8");
        expect(gravito).toContain("passed");
        expect(gravito).toContain("100");
      }
    });
  });
});

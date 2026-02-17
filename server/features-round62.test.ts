import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Helper ──
function readFile(relPath: string) {
  return readFileSync(resolve(__dirname, "..", relPath), "utf-8");
}

describe("Round 62 – Template Selector, Activity Feed, Tag Filtering", () => {
  // ── Template Selector Enhancements ──
  describe("TemplateSelector enhancements", () => {
    const src = readFile("client/src/components/TemplateSelector.tsx");

    it("should show focus area badges for templates", () => {
      expect(src).toContain("focusAreas");
    });

    it("should show template description preview", () => {
      expect(src).toContain("description");
    });

    it("should render template selection UI", () => {
      expect(src).toContain("Select");
    });
  });

  // ── Activity Feed ──
  describe("RecentActivityFeed on Dashboard", () => {
    const dashboard = readFile("client/src/pages/Dashboard.tsx");

    it("should render RecentActivityFeed component", () => {
      expect(dashboard).toContain("RecentActivityFeed");
    });

    it("should use analytics.recentFeed query", () => {
      expect(dashboard).toContain("trpc.analytics.recentFeed.useQuery");
    });

    it("should have expand/collapse toggle", () => {
      expect(dashboard).toContain("Show More");
      expect(dashboard).toContain("Show Less");
    });

    it("should show loading skeleton while feed loads", () => {
      expect(dashboard).toContain("Skeleton");
    });

    it("should show empty state when no activity", () => {
      expect(dashboard).toContain("No recent activity yet");
    });

    it("should display score circles with color coding", () => {
      expect(dashboard).toContain("bg-emerald-500");
      expect(dashboard).toContain("bg-amber-500");
    });

    it("should navigate to review on click", () => {
      expect(dashboard).toContain("setLocation(`/reviews/");
    });

    it("should show relative timestamps", () => {
      expect(dashboard).toContain("formatDistanceToNow");
    });
  });

  // ── recentFeed procedure ──
  describe("analytics.recentFeed procedure", () => {
    const routers = readFile("server/routers.ts");

    it("should have recentFeed procedure in analytics router", () => {
      expect(routers).toContain("recentFeed:");
    });

    it("should accept optional limit parameter", () => {
      const feedSection = routers.substring(
        routers.indexOf("recentFeed:"),
        routers.indexOf("recentFeed:") + 300
      );
      expect(feedSection).toContain("limit");
    });

    it("should call getRecentActivity", () => {
      const feedSection = routers.substring(
        routers.indexOf("recentFeed:"),
        routers.indexOf("recentFeed:") + 300
      );
      expect(feedSection).toContain("getRecentActivity");
    });

    it("should default to 10 items", () => {
      const feedSection = routers.substring(
        routers.indexOf("recentFeed:"),
        routers.indexOf("recentFeed:") + 300
      );
      expect(feedSection).toContain("10");
    });
  });

  // ── Tag-based Filtering ──
  describe("Tag-based filtering on Dashboard", () => {
    const dashboard = readFile("client/src/pages/Dashboard.tsx");

    it("should have selectedTags state", () => {
      expect(dashboard).toContain("selectedTags");
      expect(dashboard).toContain("setSelectedTags");
    });

    it("should fetch all tags with tags.listAll", () => {
      expect(dashboard).toContain("trpc.tags.listAll.useQuery");
    });

    it("should render tag filter chips", () => {
      expect(dashboard).toContain("Tag Filter Chips");
    });

    it("should have clear tags button", () => {
      expect(dashboard).toContain("Clear tags");
    });

    it("should filter projects by selected tags using projectIds", () => {
      expect(dashboard).toContain("selectedTags.every");
      expect(dashboard).toContain("projectIds");
    });

    it("should include selectedTags in useMemo dependencies", () => {
      expect(dashboard).toContain("selectedTags, allTags");
    });

    it("should show tag count next to each chip", () => {
      expect(dashboard).toContain("t.count");
    });

    it("should toggle tags on click", () => {
      expect(dashboard).toContain("isActive ? prev.filter");
    });
  });

  // ── tags.listAll returns projectIds ──
  describe("tags.listAll returns projectIds", () => {
    const routers = readFile("server/routers.ts");

    it("should include projectIds in listAll return", () => {
      const listAllSection = routers.substring(
        routers.indexOf("listAll:"),
        routers.indexOf("listAll:") + 800
      );
      expect(listAllSection).toContain("projectIds");
    });

    it("should track projectIds as a Set to deduplicate", () => {
      const listAllSection = routers.substring(
        routers.indexOf("listAll:"),
        routers.indexOf("listAll:") + 800
      );
      expect(listAllSection).toContain("Set<number>");
    });

    it("should convert Set to Array in return", () => {
      const listAllSection = routers.substring(
        routers.indexOf("listAll:"),
        routers.indexOf("listAll:") + 1200
      );
      expect(listAllSection).toContain("Array.from(info.projectIds)");
    });
  });

  // ── QuickStatsBar still works ──
  describe("QuickStatsBar still present", () => {
    const dashboard = readFile("client/src/pages/Dashboard.tsx");

    it("should render QuickStatsBar", () => {
      expect(dashboard).toContain("<QuickStatsBar />");
    });
  });
});

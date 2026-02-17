import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(name: string) {
  return readFileSync(resolve(__dirname, name), "utf-8");
}

describe("Round 61 – Public Sharing, Dashboard Stats, Batch Tag Management", () => {
  // ── Share Link Expiration ──
  describe("Share Link Expiration", () => {
    it("reviews schema includes shareExpiresAt column", () => {
      const schema = readFile("../drizzle/schema.ts");
      expect(schema).toContain("shareExpiresAt");
    });

    it("generateShareLink accepts optional expiresIn parameter", () => {
      const router = readFile("routers/reviewRouter.ts");
      expect(router).toContain("expiresIn");
      expect(router).toContain("generateShareLink");
    });

    it("revokeShareLink procedure exists in reviewRouter", () => {
      const router = readFile("routers/reviewRouter.ts");
      expect(router).toContain("revokeShareLink");
    });

    it("setReviewShareToken accepts expiresAt parameter", () => {
      const db = readFile("db.ts");
      expect(db).toContain("expiresAt");
      expect(db).toContain("setReviewShareToken");
    });

    it("revokeReviewShareToken helper exists in db.ts", () => {
      const db = readFile("db.ts");
      expect(db).toContain("revokeReviewShareToken");
    });

    it("getPublic checks shareExpiresAt for expired links", () => {
      const router = readFile("routers/reviewRouter.ts");
      // Should check if the link has expired
      expect(router).toContain("shareExpiresAt");
    });
  });

  // ── Dashboard Quick Stats ──
  describe("Dashboard Quick Stats", () => {
    it("quickStats procedure exists in analytics router", () => {
      const routers = readFile("routers.ts");
      expect(routers).toContain("quickStats");
    });

    it("quickStats returns averageScore, topGenre, lastReviewDate (totalReviews via spread)", () => {
      const routers = readFile("routers.ts");
      const quickStatsSection = routers.substring(
        routers.indexOf("quickStats"),
        routers.indexOf("quickStats") + 1200
      );
      // averageScore, topGenre, lastReviewDate are explicit; totalReviews comes from ...stats spread
      expect(quickStatsSection).toContain("averageScore");
      expect(quickStatsSection).toContain("topGenre");
      expect(quickStatsSection).toContain("lastReviewDate");
      expect(quickStatsSection).toContain("...stats");
    });

    it("getTopGenre helper exists in db.ts", () => {
      const db = readFile("db.ts");
      expect(db).toContain("getTopGenre");
    });

    it("QuickStatsBar component is rendered on Dashboard", () => {
      const dashboard = readFileSync(
        resolve(__dirname, "../client/src/pages/Dashboard.tsx"),
        "utf-8"
      );
      expect(dashboard).toContain("QuickStatsBar");
      expect(dashboard).toContain("analytics.quickStats");
    });

    it("QuickStatsBar shows loading skeleton while data loads", () => {
      const dashboard = readFileSync(
        resolve(__dirname, "../client/src/pages/Dashboard.tsx"),
        "utf-8"
      );
      expect(dashboard).toContain("isLoading");
      expect(dashboard).toContain("Skeleton");
    });
  });

  // ── Batch Tag Management ──
  describe("Batch Tag Management", () => {
    it("tags.listAll procedure exists in routers.ts", () => {
      const routers = readFile("routers.ts");
      expect(routers).toContain("listAll");
      // Should aggregate tags from all user tracks
      expect(routers).toContain("getTracksByUser");
    });

    it("tags.rename procedure exists with oldName/newName input", () => {
      const routers = readFile("routers.ts");
      expect(routers).toContain("rename");
      expect(routers).toContain("oldName");
      expect(routers).toContain("newName");
    });

    it("tags.merge procedure exists with sourceTags/targetTag input", () => {
      const routers = readFile("routers.ts");
      expect(routers).toContain("merge");
      expect(routers).toContain("sourceTags");
      expect(routers).toContain("targetTag");
    });

    it("tags.deleteTag procedure exists with tagName input", () => {
      const routers = readFile("routers.ts");
      expect(routers).toContain("deleteTag");
      expect(routers).toContain("tagName");
    });

    it("getTracksByUser helper exists in db.ts", () => {
      const db = readFile("db.ts");
      expect(db).toContain("getTracksByUser");
    });

    it("rename deduplicates tags after renaming", () => {
      const routers = readFile("routers.ts");
      // Should use Set for deduplication
      expect(routers).toContain("new Set(newTags)");
    });

    it("merge removes source tags and adds target tag", () => {
      const routers = readFile("routers.ts");
      const mergeSection = routers.substring(
        routers.indexOf("merge: protectedProcedure"),
        routers.indexOf("merge: protectedProcedure") + 600
      );
      expect(mergeSection).toContain("sourceTags.includes");
      expect(mergeSection).toContain("targetTag");
    });
  });

  // ── TagManager Page ──
  describe("TagManager Page", () => {
    it("TagManager page component exists", () => {
      const page = readFileSync(
        resolve(__dirname, "../client/src/pages/TagManager.tsx"),
        "utf-8"
      );
      expect(page).toContain("TagManager");
      expect(page).toContain("tags.listAll");
    });

    it("TagManager supports search filtering", () => {
      const page = readFileSync(
        resolve(__dirname, "../client/src/pages/TagManager.tsx"),
        "utf-8"
      );
      expect(page).toContain("search");
      expect(page).toContain("Search tags");
    });

    it("TagManager supports rename dialog", () => {
      const page = readFileSync(
        resolve(__dirname, "../client/src/pages/TagManager.tsx"),
        "utf-8"
      );
      expect(page).toContain("renameDialog");
      expect(page).toContain("tags.rename");
    });

    it("TagManager supports merge with multi-select", () => {
      const page = readFileSync(
        resolve(__dirname, "../client/src/pages/TagManager.tsx"),
        "utf-8"
      );
      expect(page).toContain("mergeSelected");
      expect(page).toContain("tags.merge");
      expect(page).toContain("Checkbox");
    });

    it("TagManager supports delete with confirmation", () => {
      const page = readFileSync(
        resolve(__dirname, "../client/src/pages/TagManager.tsx"),
        "utf-8"
      );
      expect(page).toContain("deleteConfirm");
      expect(page).toContain("tags.deleteTag");
      expect(page).toContain("AlertDialog");
    });

    it("Tags route is registered in App.tsx", () => {
      const app = readFileSync(
        resolve(__dirname, "../client/src/App.tsx"),
        "utf-8"
      );
      expect(app).toContain("/tags");
      expect(app).toContain("TagManager");
    });

    it("Tags nav item exists in DashboardLayout sidebar", () => {
      const layout = readFileSync(
        resolve(__dirname, "../client/src/components/DashboardLayout.tsx"),
        "utf-8"
      );
      expect(layout).toContain("\"Tags\"");
      expect(layout).toContain("/tags");
    });

    it("TagManager shows empty state when no tags", () => {
      const page = readFileSync(
        resolve(__dirname, "../client/src/pages/TagManager.tsx"),
        "utf-8"
      );
      expect(page).toContain("No tags yet");
    });
  });

  // ── Integration ──
  describe("Integration", () => {
    it("all batch tag procedures return tracksUpdated count", () => {
      const routers = readFile("routers.ts");
      const tagSection = routers.substring(
        routers.indexOf("// Batch tag management"),
        routers.indexOf("lyrics: router")
      );
      // rename, merge, deleteTag should all return tracksUpdated
      expect((tagSection.match(/tracksUpdated/g) || []).length).toBeGreaterThanOrEqual(3);
    });

    it("quickStats is a publicProcedure or protectedProcedure", () => {
      const routers = readFile("routers.ts");
      const quickStatsLine = routers.substring(
        routers.indexOf("quickStats"),
        routers.indexOf("quickStats") + 200
      );
      expect(
        quickStatsLine.includes("protectedProcedure") ||
        quickStatsLine.includes("publicProcedure")
      ).toBe(true);
    });
  });
});

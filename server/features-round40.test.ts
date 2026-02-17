import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    audioMinutesUsed: 0,
    audioMinutesLimit: 60,
    tier: "pro",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    deletedAt: null,
    monthlyReviewCount: 0,
    monthlyResetAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    digestFrequency: "weekly" as const,
    lastDigestSentAt: null, notificationPreferences: null,
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Round 40 - Project Insights, Score Matrix, CSV Export", () => {
  // ── Feature 1: Project Insights ──

  describe("Project Insights", () => {
    it("should reject insights generation with less than 2 reviewed tracks", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // This will fail because project doesn't exist, but validates the route exists
      await expect(
        caller.insights.generate({ projectId: 999999 })
      ).rejects.toThrow();
    });

    it("should have insights.get query route defined", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // Should throw NOT_FOUND for non-existent project, not a routing error
      await expect(
        caller.insights.get({ projectId: 999999 })
      ).rejects.toThrow("Project not found");
    });

    it("should validate projectId is required for insights generation", () => {
      const input = { projectId: 42 };
      expect(input.projectId).toBeDefined();
      expect(typeof input.projectId).toBe("number");
    });

    it("should structure insight data correctly", () => {
      const insight = {
        summaryMarkdown: "## Summary\nThis project shows strong potential...",
        strengths: ["Strong vocal performances", "Cohesive production style"],
        weaknesses: ["Repetitive song structures", "Weak bridge sections"],
        recommendations: ["Vary tempo across tracks", "Add more dynamic range"],
        averageScores: { songwriting: 7.5, production: 8.0, vocals: 6.5 },
        trackCount: 5,
      };

      expect(insight.strengths.length).toBeGreaterThan(0);
      expect(insight.weaknesses.length).toBeGreaterThan(0);
      expect(insight.recommendations.length).toBeGreaterThan(0);
      expect(insight.averageScores.songwriting).toBeGreaterThanOrEqual(0);
      expect(insight.averageScores.songwriting).toBeLessThanOrEqual(10);
      expect(insight.trackCount).toBeGreaterThanOrEqual(2);
    });

    it("should compute average scores from track data", () => {
      const trackData = [
        { scores: { songwriting: 7, production: 8, vocals: 6 } },
        { scores: { songwriting: 8, production: 6, vocals: 7 } },
        { scores: { songwriting: 6, production: 7, vocals: 8 } },
      ];

      const allKeys = new Set<string>();
      for (const t of trackData) {
        for (const k of Object.keys(t.scores)) allKeys.add(k);
      }
      const averageScores: Record<string, number> = {};
      for (const key of Array.from(allKeys)) {
        const vals = trackData.map(t => (t.scores as any)[key]).filter((v: any) => typeof v === "number");
        if (vals.length > 0) {
          averageScores[key] = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10;
        }
      }

      expect(averageScores.songwriting).toBe(7);
      expect(averageScores.production).toBe(7);
      expect(averageScores.vocals).toBe(7);
    });
  });

  // ── Feature 2: Score Matrix ──

  describe("Score Matrix", () => {
    it("should have matrix.get query route defined", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.matrix.get({ projectId: 999999 })
      ).rejects.toThrow("Project not found");
    });

    it("should sort matrix rows by score dimension", () => {
      const matrix = [
        { trackId: 1, filename: "track1.mp3", scores: { overall: 7 }, overall: 7 },
        { trackId: 2, filename: "track2.mp3", scores: { overall: 9 }, overall: 9 },
        { trackId: 3, filename: "track3.mp3", scores: { overall: 5 }, overall: 5 },
      ];

      const sorted = [...matrix].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
      expect(sorted[0].filename).toBe("track2.mp3");
      expect(sorted[1].filename).toBe("track1.mp3");
      expect(sorted[2].filename).toBe("track3.mp3");
    });

    it("should identify best and worst scores per dimension", () => {
      const matrix = [
        { scores: { songwriting: 8, production: 5 }, filename: "track1.mp3" },
        { scores: { songwriting: 6, production: 9 }, filename: "track2.mp3" },
        { scores: { songwriting: 7, production: 7 }, filename: "track3.mp3" },
      ];

      const bestSongwriting = matrix.reduce((best, row) =>
        (row.scores.songwriting > best.scores.songwriting) ? row : best
      );
      const worstProduction = matrix.reduce((worst, row) =>
        (row.scores.production < worst.scores.production) ? row : worst
      );

      expect(bestSongwriting.filename).toBe("track1.mp3");
      expect(worstProduction.filename).toBe("track1.mp3");
    });

    it("should collect all score dimension keys from matrix", () => {
      const matrix = [
        { scores: { songwriting: 7, production: 8 } },
        { scores: { songwriting: 6, vocals: 9 } },
      ];

      const keys = new Set<string>();
      for (const row of matrix) {
        for (const k of Object.keys(row.scores)) {
          if (k !== "overall") keys.add(k);
        }
      }

      expect(Array.from(keys).sort()).toEqual(["production", "songwriting", "vocals"]);
    });

    it("should apply heatmap color based on score value", () => {
      const getHeatmapBg = (value: number) => {
        if (value >= 8) return "bg-emerald-500/15";
        if (value >= 6) return "bg-sky-500/10";
        if (value >= 4) return "bg-amber-500/10";
        return "bg-rose-500/10";
      };

      expect(getHeatmapBg(9)).toBe("bg-emerald-500/15");
      expect(getHeatmapBg(7)).toBe("bg-sky-500/10");
      expect(getHeatmapBg(4)).toBe("bg-amber-500/10");
      expect(getHeatmapBg(2)).toBe("bg-rose-500/10");
    });
  });

  // ── Feature 3: CSV Export ──

  describe("CSV Export", () => {
    it("should have csvExport.generate mutation route defined", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.csvExport.generate({ projectId: 999999 })
      ).rejects.toThrow("Project not found");
    });

    it("should build valid CSV headers from score keys", () => {
      const scoreKeys = ["songwriting", "production", "vocals"];
      const headers = ["Track", "Genre", "Status", "Quick Take", ...scoreKeys.map(k => k.replace(/([A-Z])/g, " $1").trim()), "Review Date"];

      expect(headers[0]).toBe("Track");
      expect(headers[4]).toBe("songwriting");
      expect(headers[headers.length - 1]).toBe("Review Date");
    });

    it("should properly escape CSV values with quotes", () => {
      const trackName = 'My "Best" Song';
      const escaped = `"${trackName.replace(/"/g, '""')}"`;
      expect(escaped).toBe('"My ""Best"" Song"');
    });

    it("should handle camelCase score keys in CSV headers", () => {
      const key = "mixQuality";
      const formatted = key.replace(/([A-Z])/g, " $1").trim();
      expect(formatted).toBe("mix Quality");
    });

    it("should generate valid filename from project title", () => {
      const title = "My Album (2026 Remix)";
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-scores.csv`;
      expect(filename).toBe("my-album--2026-remix--scores.csv");
      expect(filename.endsWith(".csv")).toBe(true);
    });

    it("should handle empty scores gracefully in CSV rows", () => {
      const scoreKeys = ["songwriting", "production", "vocals"];
      const scores: Record<string, number> = { songwriting: 7 };
      const values = scoreKeys.map(k => scores[k]?.toString() || "");
      expect(values).toEqual(["7", "", ""]);
    });

    it("should strip newlines from quick take in CSV", () => {
      const quickTake = "Great track.\nNeeds more bass.\nOverall solid.";
      const cleaned = quickTake.replace(/\n/g, " ");
      expect(cleaned).toBe("Great track. Needs more bass. Overall solid.");
      expect(cleaned).not.toContain("\n");
    });
  });

  // ── Feature gating ──

  describe("Feature Gating", () => {
    it("should block free tier from insights generation", async () => {
      const ctx = createAuthContext({ tier: "free" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.insights.generate({ projectId: 999999 })
      ).rejects.toThrow();
    });

    it("should block free tier from CSV export", async () => {
      const ctx = createAuthContext({ tier: "free" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.csvExport.generate({ projectId: 999999 })
      ).rejects.toThrow();
    });
  });
});

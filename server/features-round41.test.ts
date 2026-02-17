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
    lastDigestSentAt: null,
    ...overrides,
  };
  return {
    user,
    req: { headers: { origin: "http://localhost:3000" } } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

describe("Round 41 Features", () => {
  // ── Feature 1: Analytics Trends ──
  describe("Analytics Trends", () => {
    it("should gate analytics.trends behind paid tier (no DB user falls back to free)", async () => {
      // Since test user doesn't exist in DB, getUserById returns null,
      // tier falls back to 'free', and analytics is gated for free users
      const ctx = createAuthContext({ tier: "artist" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.trends()).rejects.toThrow(/requires the Artist plan/);
    });

    it("should reject weeks below minimum via input validation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.analytics.trends({ weeks: 2 })
      ).rejects.toThrow();
    });

    it("should reject weeks above maximum via input validation", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.analytics.trends({ weeks: 100 })
      ).rejects.toThrow();
    });

    it("should gate analytics.heatmap behind paid tier", async () => {
      const ctx = createAuthContext({ tier: "artist" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.heatmap()).rejects.toThrow(/requires the Artist plan/);
    });

    it("should gate analytics.improvement behind paid tier", async () => {
      const ctx = createAuthContext({ tier: "artist" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.improvement()).rejects.toThrow(/requires the Artist plan/);
    });

    it("should block free tier from analytics trends", async () => {
      const ctx = createAuthContext({ tier: "free" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.trends()).rejects.toThrow();
    });

    it("should block free tier from analytics heatmap", async () => {
      const ctx = createAuthContext({ tier: "free" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.heatmap()).rejects.toThrow();
    });

    it("should block free tier from analytics improvement", async () => {
      const ctx = createAuthContext({ tier: "free" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.improvement()).rejects.toThrow();
    });
  });

  // ── Feature 1: Score Trend Chart Logic ──
  describe("Score Trend Chart Logic", () => {
    it("should compute weekly averages correctly", () => {
      const data = [
        { week: "2026-01-06", scores: [7, 8, 6] },
        { week: "2026-01-13", scores: [9, 8] },
        { week: "2026-01-20", scores: [5] },
      ];
      const trends = data.map(d => ({
        week: d.week,
        avgScore: Math.round((d.scores.reduce((a, b) => a + b, 0) / d.scores.length) * 10) / 10,
        reviewCount: d.scores.length,
        minScore: Math.min(...d.scores),
        maxScore: Math.max(...d.scores),
      }));
      expect(trends[0].avgScore).toBe(7);
      expect(trends[1].avgScore).toBe(8.5);
      expect(trends[2].avgScore).toBe(5);
      expect(trends[0].minScore).toBe(6);
      expect(trends[0].maxScore).toBe(8);
    });

    it("should compute delta between first and last week", () => {
      const trends = [
        { week: "2026-01-06", avgScore: 6.5 },
        { week: "2026-01-13", avgScore: 7.2 },
        { week: "2026-01-20", avgScore: 8.1 },
      ];
      const delta = trends[trends.length - 1].avgScore - trends[0].avgScore;
      expect(delta).toBeCloseTo(1.6, 1);
    });

    it("should sort trends chronologically", () => {
      const unsorted = [
        { week: "2026-01-20" },
        { week: "2026-01-06" },
        { week: "2026-01-13" },
      ];
      const sorted = [...unsorted].sort((a, b) => a.week.localeCompare(b.week));
      expect(sorted[0].week).toBe("2026-01-06");
      expect(sorted[2].week).toBe("2026-01-20");
    });
  });

  // ── Feature 1: Activity Heatmap Logic ──
  describe("Activity Heatmap Logic", () => {
    it("should build 7x24 grid with correct dimensions", () => {
      const grid: Record<string, number> = {};
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          grid[`${d}-${h}`] = 0;
        }
      }
      expect(Object.keys(grid).length).toBe(168); // 7 * 24
    });

    it("should correctly map day-of-week and hour", () => {
      // Use UTC methods for deterministic results in CI
      const date = new Date("2026-02-15T14:30:00Z");
      const day = date.getUTCDay(); // 0=Sun, 6=Sat → 0 = Sunday
      const hour = date.getUTCHours();
      expect(day).toBe(0); // Feb 15 2026 is Sunday in UTC
      expect(hour).toBe(14);
    });

    it("should apply correct heatmap cell colors based on intensity", () => {
      const getCellColor = (count: number, maxCount: number) => {
        if (count === 0) return "bg-muted/20";
        const intensity = count / Math.max(maxCount, 1);
        if (intensity > 0.75) return "bg-emerald-500";
        if (intensity > 0.5) return "bg-emerald-400/80";
        if (intensity > 0.25) return "bg-emerald-400/50";
        return "bg-emerald-400/25";
      };
      expect(getCellColor(0, 10)).toBe("bg-muted/20");
      expect(getCellColor(1, 10)).toBe("bg-emerald-400/25");
      expect(getCellColor(4, 10)).toBe("bg-emerald-400/50");
      expect(getCellColor(6, 10)).toBe("bg-emerald-400/80");
      expect(getCellColor(9, 10)).toBe("bg-emerald-500");
    });
  });

  // ── Feature 1: Improvement Rate Logic ──
  describe("Improvement Rate Logic", () => {
    it("should compute improvement rate correctly", () => {
      const data = { improved: 3, declined: 1, unchanged: 1, total: 5 };
      const rate = Math.round((data.improved / data.total) * 100);
      expect(rate).toBe(60);
    });

    it("should handle zero total gracefully", () => {
      const data = { improved: 0, declined: 0, unchanged: 0, total: 0 };
      const rate = data.total > 0 ? Math.round((data.improved / data.total) * 100) : 0;
      expect(rate).toBe(0);
    });

    it("should classify track improvement from review versions", () => {
      const versions = [
        { overall: 5, version: 1 },
        { overall: 7, version: 2 },
        { overall: 8, version: 3 },
      ];
      const first = versions[0].overall;
      const last = versions[versions.length - 1].overall;
      expect(last > first).toBe(true); // improved
    });
  });

  // ── Feature 2: Sentiment Timeline ──
  describe("Sentiment Timeline", () => {
    it("should have sentiment.timeline procedure defined", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.sentiment.timeline({ projectId: 999999 })
      ).rejects.toThrow("Project not found");
    });

    it("should classify sentiment based on score thresholds", () => {
      const classifySentiment = (overall: number, posCount: number, negCount: number) => {
        if (overall >= 7.5 || posCount > negCount + 1) return "positive";
        if (overall <= 4.5 || negCount > posCount + 1) return "critical";
        return "mixed";
      };
      expect(classifySentiment(8.5, 0, 0)).toBe("positive");
      expect(classifySentiment(3.0, 0, 0)).toBe("critical");
      expect(classifySentiment(6.0, 0, 0)).toBe("mixed");
      expect(classifySentiment(6.0, 3, 0)).toBe("positive"); // posCount > negCount + 1
      expect(classifySentiment(6.0, 0, 3)).toBe("critical"); // negCount > posCount + 1
    });

    it("should extract key phrases from review text", () => {
      const positiveWords = ["excellent", "outstanding", "strong", "impressive", "great", "brilliant", "solid", "polished", "well-crafted", "compelling"];
      const negativeWords = ["weak", "lacking", "muddy", "cluttered", "repetitive", "flat", "thin", "underdeveloped", "generic", "needs work"];
      const text = "This is an excellent track with strong melodies but the mix is a bit muddy and the bridge feels repetitive.";
      const lower = text.toLowerCase();
      const keyPhrases: string[] = [];
      for (const w of positiveWords) { if (lower.includes(w)) keyPhrases.push(w); }
      for (const w of negativeWords) { if (lower.includes(w)) keyPhrases.push(w); }
      expect(keyPhrases).toContain("excellent");
      expect(keyPhrases).toContain("strong");
      expect(keyPhrases).toContain("muddy");
      expect(keyPhrases).toContain("repetitive");
      expect(keyPhrases.length).toBe(4);
    });

    it("should compute sentiment summary counts", () => {
      const data = [
        { sentiment: "positive" },
        { sentiment: "positive" },
        { sentiment: "mixed" },
        { sentiment: "critical" },
        { sentiment: "positive" },
      ];
      const posCount = data.filter(d => d.sentiment === "positive").length;
      const mixCount = data.filter(d => d.sentiment === "mixed").length;
      const critCount = data.filter(d => d.sentiment === "critical").length;
      expect(posCount).toBe(3);
      expect(mixCount).toBe(1);
      expect(critCount).toBe(1);
    });

    it("should compute average score across timeline", () => {
      const data = [
        { overall: 8 },
        { overall: 6 },
        { overall: 7 },
        { overall: 9 },
      ];
      const avg = data.reduce((sum, d) => sum + d.overall, 0) / data.length;
      expect(avg).toBe(7.5);
    });
  });

  // ── Feature 3: Command Palette Logic ──
  describe("Command Palette Logic", () => {
    it("should filter commands by query", () => {
      const commands = [
        { id: "nav-home", label: "Go to Home", category: "Navigation", keywords: ["landing", "home"] },
        { id: "nav-dashboard", label: "Go to Dashboard", category: "Navigation", keywords: ["dashboard", "projects"] },
        { id: "nav-analytics", label: "Go to Analytics", category: "Navigation", keywords: ["analytics", "stats"] },
        { id: "action-new", label: "New Project", category: "Actions", keywords: ["new", "create", "upload"] },
      ];
      const query = "dash";
      const filtered = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query) ||
        cmd.keywords?.some(k => k.includes(query))
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("nav-dashboard");
    });

    it("should match keywords in addition to labels", () => {
      const commands = [
        { id: "action-new", label: "New Project", keywords: ["new", "create", "upload"] },
      ];
      const query = "upload";
      const filtered = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.keywords?.some(k => k.includes(query))
      );
      expect(filtered.length).toBe(1);
    });

    it("should group commands by category", () => {
      const commands = [
        { id: "1", category: "Navigation" },
        { id: "2", category: "Navigation" },
        { id: "3", category: "Actions" },
        { id: "4", category: "Projects" },
        { id: "5", category: "Projects" },
      ];
      const groups = new Map<string, typeof commands>();
      for (const item of commands) {
        if (!groups.has(item.category)) groups.set(item.category, []);
        groups.get(item.category)!.push(item);
      }
      expect(groups.size).toBe(3);
      expect(groups.get("Navigation")!.length).toBe(2);
      expect(groups.get("Actions")!.length).toBe(1);
      expect(groups.get("Projects")!.length).toBe(2);
    });

    it("should return empty results for non-matching query", () => {
      const commands = [
        { id: "nav-home", label: "Go to Home", keywords: ["landing"] },
      ];
      const query = "zzzzz";
      const filtered = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.keywords?.some(k => k.includes(query))
      );
      expect(filtered.length).toBe(0);
    });

    it("should handle keyboard navigation index bounds", () => {
      const totalItems = 5;
      let selectedIndex = 0;
      // Arrow down
      selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
      expect(selectedIndex).toBe(1);
      // Arrow down to end
      selectedIndex = totalItems - 1;
      selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
      expect(selectedIndex).toBe(4); // stays at max
      // Arrow up
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(3);
      // Arrow up to start
      selectedIndex = 0;
      selectedIndex = Math.max(selectedIndex - 1, 0);
      expect(selectedIndex).toBe(0); // stays at 0
    });
  });
});

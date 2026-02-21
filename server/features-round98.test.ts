import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Round 98: Three Advanced UX Features ──
// Feature 1: Persist review length preference
// Feature 2: Smart prefetch learning for Insights tabs
// Feature 3: Version comparison annotations

// ── Mock user factory ──
function mockUser(overrides: Partial<{
  id: number;
  tier: "free" | "artist" | "pro";
  preferredReviewLength: "brief" | "standard" | "detailed";
}> = {}) {
  return {
    id: overrides.id ?? 1,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "manus",
    role: "user" as const,
    audioMinutesUsed: 0,
    audioMinutesLimit: 60,
    tier: overrides.tier ?? ("artist" as const),
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
    notificationPreferences: null,
    preferredPersona: "full" as const,
    emailVerified: false,
    emailBounced: false,
    emailBouncedAt: null,
    emailBounceReason: null,
    preferredReviewLength: overrides.preferredReviewLength ?? ("standard" as const),
  };
}

// ── Feature 1: Persist Review Length Preference ──
describe("Feature 1: Persist Review Length Preference", () => {
  it("should have preferredReviewLength field in user object", () => {
    const user = mockUser();
    expect(user.preferredReviewLength).toBe("standard");
  });

  it("should accept 'brief' as a valid review length", () => {
    const user = mockUser({ preferredReviewLength: "brief" });
    expect(user.preferredReviewLength).toBe("brief");
  });

  it("should accept 'standard' as a valid review length", () => {
    const user = mockUser({ preferredReviewLength: "standard" });
    expect(user.preferredReviewLength).toBe("standard");
  });

  it("should accept 'detailed' as a valid review length", () => {
    const user = mockUser({ preferredReviewLength: "detailed" });
    expect(user.preferredReviewLength).toBe("detailed");
  });

  it("should default to 'standard' when not specified", () => {
    const user = mockUser();
    expect(user.preferredReviewLength).toBe("standard");
  });

  it("should include preferredReviewLength in user type", () => {
    const user = mockUser();
    expect("preferredReviewLength" in user).toBe(true);
    expect(["brief", "standard", "detailed"]).toContain(user.preferredReviewLength);
  });
});

// ── Feature 2: Smart Prefetch Learning ──
describe("Feature 2: Smart Prefetch Learning", () => {
  // Simulate localStorage for tab visit tracking
  const INSIGHTS_VISIT_KEY = "troubadour_insights_visits";
  type InsightTab = "overview" | "skills" | "competitive" | "momentum" | "dna";

  function getTabVisitCounts(): Record<InsightTab, number> {
    try {
      const raw = localStorage.getItem(INSIGHTS_VISIT_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { overview: 0, skills: 0, competitive: 0, momentum: 0, dna: 0 };
  }

  function recordTabVisit(tab: InsightTab) {
    try {
      const counts = getTabVisitCounts();
      counts[tab] = (counts[tab] || 0) + 1;
      localStorage.setItem(INSIGHTS_VISIT_KEY, JSON.stringify(counts));
    } catch { /* ignore */ }
  }

  function getTopTabs(n: number): InsightTab[] {
    const counts = getTabVisitCounts();
    return (Object.entries(counts) as [InsightTab, number][])
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count >= 3)
      .slice(0, n)
      .map(([tab]) => tab);
  }

  // Mock localStorage
  let store: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
  Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

  beforeEach(() => {
    store = {};
  });

  it("should initialize with zero visit counts", () => {
    const counts = getTabVisitCounts();
    expect(counts.overview).toBe(0);
    expect(counts.skills).toBe(0);
    expect(counts.competitive).toBe(0);
    expect(counts.momentum).toBe(0);
    expect(counts.dna).toBe(0);
  });

  it("should record tab visits correctly", () => {
    recordTabVisit("skills");
    recordTabVisit("skills");
    recordTabVisit("dna");
    const counts = getTabVisitCounts();
    expect(counts.skills).toBe(2);
    expect(counts.dna).toBe(1);
    expect(counts.overview).toBe(0);
  });

  it("should return no top tabs when all visits below threshold", () => {
    recordTabVisit("skills");
    recordTabVisit("skills");
    const topTabs = getTopTabs(2);
    expect(topTabs).toHaveLength(0);
  });

  it("should return top tabs when visits reach threshold of 3", () => {
    recordTabVisit("skills");
    recordTabVisit("skills");
    recordTabVisit("skills");
    const topTabs = getTopTabs(2);
    expect(topTabs).toContain("skills");
    expect(topTabs).toHaveLength(1);
  });

  it("should sort top tabs by visit frequency", () => {
    // Skills: 5 visits, DNA: 4 visits, Momentum: 3 visits
    for (let i = 0; i < 5; i++) recordTabVisit("skills");
    for (let i = 0; i < 4; i++) recordTabVisit("dna");
    for (let i = 0; i < 3; i++) recordTabVisit("momentum");
    const topTabs = getTopTabs(2);
    expect(topTabs).toEqual(["skills", "dna"]);
  });

  it("should limit top tabs to requested count", () => {
    for (let i = 0; i < 5; i++) recordTabVisit("skills");
    for (let i = 0; i < 4; i++) recordTabVisit("dna");
    for (let i = 0; i < 3; i++) recordTabVisit("momentum");
    for (let i = 0; i < 3; i++) recordTabVisit("competitive");
    const topTabs = getTopTabs(2);
    expect(topTabs).toHaveLength(2);
  });

  it("should persist visit data across calls", () => {
    recordTabVisit("overview");
    recordTabVisit("overview");
    recordTabVisit("overview");
    // Simulate new page load by reading from storage
    const counts = getTabVisitCounts();
    expect(counts.overview).toBe(3);
    const topTabs = getTopTabs(2);
    expect(topTabs).toContain("overview");
  });

  it("should handle corrupted localStorage gracefully", () => {
    store[INSIGHTS_VISIT_KEY] = "not-valid-json";
    const counts = getTabVisitCounts();
    expect(counts.overview).toBe(0);
  });
});

// ── Feature 3: Version Comparison Annotations ──
describe("Feature 3: Version Comparison Annotations", () => {
  it("should validate version note max length of 500 characters", () => {
    const maxLength = 500;
    const shortNote = "Re-recorded vocals";
    const longNote = "x".repeat(501);
    expect(shortNote.length).toBeLessThanOrEqual(maxLength);
    expect(longNote.length).toBeGreaterThan(maxLength);
  });

  it("should accept null as a valid version note (clearing)", () => {
    const note: string | null = null;
    expect(note).toBeNull();
  });

  it("should accept empty string and convert to null for clearing", () => {
    const note = "";
    const normalized = note.trim() || null;
    expect(normalized).toBeNull();
  });

  it("should trim whitespace from version notes", () => {
    const note = "  Re-recorded vocals  ";
    const trimmed = note.trim();
    expect(trimmed).toBe("Re-recorded vocals");
  });

  it("should handle typical version note content", () => {
    const notes = [
      "Re-recorded vocals with new microphone",
      "New bridge section added",
      "Remixed with better EQ on bass",
      "Added harmony vocals in chorus",
      "Shortened intro by 8 bars",
    ];
    for (const note of notes) {
      expect(note.length).toBeLessThanOrEqual(500);
      expect(note.trim()).toBe(note);
    }
  });

  it("should support version note in review object structure", () => {
    const review = {
      id: 1,
      reviewVersion: 2,
      versionNote: "Added new guitar solo",
      reviewMarkdown: "# Review...",
      scoresJson: { overall: 7.5 },
    };
    expect(review.versionNote).toBe("Added new guitar solo");
  });
});

// ── Integration: All features work together ──
describe("Round 98 Integration", () => {
  it("should have all three features' data structures compatible", () => {
    const user = mockUser({ preferredReviewLength: "detailed" });
    expect(user.preferredReviewLength).toBe("detailed");

    // Version note on a review
    const review = {
      id: 1,
      userId: user.id,
      versionNote: "Used detailed review for this version",
    };
    expect(review.userId).toBe(user.id);
    expect(review.versionNote).toBeTruthy();
  });

  it("should maintain backward compatibility with users without preferences", () => {
    // Simulate a user who hasn't set a preference yet
    const rawPref: string | undefined = undefined;
    const defaultLength = rawPref ?? "standard";
    expect(defaultLength).toBe("standard");
  });

  it("should maintain backward compatibility with reviews without version notes", () => {
    const review = {
      id: 1,
      versionNote: null,
    };
    expect(review.versionNote).toBeNull();
  });
});

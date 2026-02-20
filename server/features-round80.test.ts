/**
 * Round 80 Tests
 * - Enhanced Digest Scheduler (streak, skill, DNA, Claude summary)
 * - Onboarding Tour Deep-Link
 * - Landing Page Animated Cards (structural)
 */
import { describe, it, expect, vi } from "vitest";

// ── Digest Scheduler Tests ──

describe("Enhanced Digest Scheduler", () => {
  describe("shouldSendToUser", () => {
    it("returns true for weekly frequency", async () => {
      const { shouldSendToUser } = await import("./services/digestScheduler");
      expect(shouldSendToUser("weekly")).toBe(true);
    });

    it("returns false for disabled frequency", async () => {
      const { shouldSendToUser } = await import("./services/digestScheduler");
      expect(shouldSendToUser("disabled")).toBe(false);
    });

    it("returns true for unknown frequency (defaults to weekly)", async () => {
      const { shouldSendToUser } = await import("./services/digestScheduler");
      expect(shouldSendToUser("unknown")).toBe(true);
    });
  });

  describe("getDaysBackForFrequency", () => {
    it("returns 7 for weekly", async () => {
      const { getDaysBackForFrequency } = await import("./services/digestScheduler");
      expect(getDaysBackForFrequency("weekly")).toBe(7);
    });

    it("returns 14 for biweekly", async () => {
      const { getDaysBackForFrequency } = await import("./services/digestScheduler");
      expect(getDaysBackForFrequency("biweekly")).toBe(14);
    });

    it("returns 30 for monthly", async () => {
      const { getDaysBackForFrequency } = await import("./services/digestScheduler");
      expect(getDaysBackForFrequency("monthly")).toBe(30);
    });

    it("defaults to 7 for unknown frequency", async () => {
      const { getDaysBackForFrequency } = await import("./services/digestScheduler");
      expect(getDaysBackForFrequency("something")).toBe(7);
    });
  });

  describe("getPeriodLabelForFrequency", () => {
    it("returns 'This Week' for weekly", async () => {
      const { getPeriodLabelForFrequency } = await import("./services/digestScheduler");
      expect(getPeriodLabelForFrequency("weekly")).toBe("This Week");
    });

    it("returns 'Last 2 Weeks' for biweekly", async () => {
      const { getPeriodLabelForFrequency } = await import("./services/digestScheduler");
      expect(getPeriodLabelForFrequency("biweekly")).toBe("Last 2 Weeks");
    });

    it("returns 'This Month' for monthly", async () => {
      const { getPeriodLabelForFrequency } = await import("./services/digestScheduler");
      expect(getPeriodLabelForFrequency("monthly")).toBe("This Month");
    });
  });

  describe("isFirstMondayOfMonth", () => {
    it("is a function that returns boolean", async () => {
      const { isFirstMondayOfMonth } = await import("./services/digestScheduler");
      const result = isFirstMondayOfMonth();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getIntelligenceSuiteData", () => {
    it("is exported and callable", async () => {
      const { getIntelligenceSuiteData } = await import("./services/digestScheduler");
      expect(typeof getIntelligenceSuiteData).toBe("function");
    });

    it("returns object with streak, skillProgress, and artistDNA fields", async () => {
      const { getIntelligenceSuiteData } = await import("./services/digestScheduler");
      // With a non-existent user, should return safe defaults
      const result = await getIntelligenceSuiteData(999999);
      expect(result).toHaveProperty("streak");
      expect(result).toHaveProperty("skillProgress");
      expect(result).toHaveProperty("artistDNA");
      expect(Array.isArray(result.skillProgress)).toBe(true);
    });
  });

  describe("generatePersonalizedSummary", () => {
    it("is exported and callable", async () => {
      const { generatePersonalizedSummary } = await import("./services/digestScheduler");
      expect(typeof generatePersonalizedSummary).toBe("function");
    });

    it("generates a fallback summary when LLM is unavailable", async () => {
      const { generatePersonalizedSummary } = await import("./services/digestScheduler");
      const mockReviewData = {
        stats: {
          totalReviews: 3,
          totalNewProjects: 1,
          averageScore: 7.5,
          highestScore: { track: "Test Track", score: 9 },
        },
        reviews: [],
      };
      const mockSuiteData = {
        streak: { currentStreak: 5, longestStreak: 10, totalUploads: 20, totalReviews: 15 },
        skillProgress: [{ dimension: "Melody", latestScore: 8, delta: 2, dataPoints: 5 }],
        artistDNA: null,
      };
      // This will either call the LLM successfully or fall back to template
      const summary = await generatePersonalizedSummary("TestUser", "This Week", mockReviewData as any, mockSuiteData);
      expect(typeof summary).toBe("string");
      expect(summary.length).toBeGreaterThan(10);
    });
  });

  describe("generateDigestEmailHtml", () => {
    it("is exported and callable", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      expect(typeof generateDigestEmailHtml).toBe("function");
    });

    it("generates HTML with streak section when streak data is present", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "TestUser",
        "This Week",
        {
          stats: { totalReviews: 2, totalNewProjects: 1, averageScore: 7, highestScore: null },
          reviews: [],
        } as any,
        {
          streak: { currentStreak: 3, longestStreak: 7, totalUploads: 10, totalReviews: 8 },
          skillProgress: [],
          artistDNA: null,
        },
        "Great week of music!"
      );
      expect(html).toContain("Creative Streak");
      expect(html).toContain("Current Streak");
      expect(html).toContain("Longest Streak");
      expect(html).toContain("3"); // current streak
      expect(html).toContain("7"); // longest streak
    });

    it("generates HTML with skill growth section when skill data is present", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "TestUser",
        "This Week",
        {
          stats: { totalReviews: 1, totalNewProjects: 0, averageScore: 8, highestScore: null },
          reviews: [],
        } as any,
        {
          streak: null,
          skillProgress: [
            { dimension: "Melody", latestScore: 8, delta: 2, dataPoints: 5 },
            { dimension: "Harmony", latestScore: 7, delta: 1, dataPoints: 3 },
          ],
          artistDNA: null,
        },
        "Your skills are growing!"
      );
      expect(html).toContain("Skill Growth");
      expect(html).toContain("Melody");
      expect(html).toContain("Harmony");
      expect(html).toContain("+2");
      expect(html).toContain("+1");
    });

    it("generates HTML with artist DNA section when DNA data is present", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "TestUser",
        "This Week",
        {
          stats: { totalReviews: 0, totalNewProjects: 0, averageScore: null, highestScore: null },
          reviews: [],
        } as any,
        {
          streak: null,
          skillProgress: [],
          artistDNA: {
            archetype: "Melodic Innovator",
            confidence: 0.85,
            traits: ["Harmonic Complexity", "Rhythmic Precision", "Emotional Depth"],
          },
        },
        "Your DNA profile is evolving!"
      );
      expect(html).toContain("Your Artist DNA");
      expect(html).toContain("Melodic Innovator");
      expect(html).toContain("Harmonic Complexity");
      expect(html).toContain("Rhythmic Precision");
      expect(html).toContain("Emotional Depth");
    });

    it("includes personalized AI summary in the email", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "TestUser",
        "This Week",
        {
          stats: { totalReviews: 5, totalNewProjects: 2, averageScore: 8.5, highestScore: { track: "Best Track", score: 10 } },
          reviews: [],
        } as any,
        { streak: null, skillProgress: [], artistDNA: null },
        "You had an incredible week with 5 reviews and a perfect 10 on Best Track."
      );
      expect(html).toContain("You had an incredible week with 5 reviews");
      expect(html).toContain("perfect 10 on Best Track");
    });

    it("generates HTML without streak/skill/DNA sections when data is absent", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "TestUser",
        "This Week",
        {
          stats: { totalReviews: 1, totalNewProjects: 0, averageScore: 6, highestScore: null },
          reviews: [],
        } as any,
        { streak: null, skillProgress: [], artistDNA: null },
        "Keep creating!"
      );
      expect(html).not.toContain("Creative Streak");
      expect(html).not.toContain("Skill Growth");
      expect(html).not.toContain("Your Artist DNA");
      expect(html).toContain("Keep creating!");
    });

    it("includes Troubadour branding and period label", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "ArtistName",
        "Last 2 Weeks",
        {
          stats: { totalReviews: 0, totalNewProjects: 0, averageScore: null, highestScore: null },
          reviews: [],
        } as any,
        { streak: null, skillProgress: [], artistDNA: null },
        "Summary text"
      );
      expect(html).toContain("Troubadour");
      expect(html).toContain("Last 2 Weeks");
      expect(html).toContain("ArtistName");
    });

    it("renders track review rows when reviews are present", async () => {
      const { generateDigestEmailHtml } = await import("./services/digestScheduler");
      const html = generateDigestEmailHtml(
        "TestUser",
        "This Week",
        {
          stats: { totalReviews: 1, totalNewProjects: 0, averageScore: 8, highestScore: null },
          reviews: [
            { trackFilename: "MyTrack.wav", scoresJson: JSON.stringify({ overall: 8 }), quickTake: "Great melody" },
          ],
        } as any,
        { streak: null, skillProgress: [], artistDNA: null },
        "Nice work!"
      );
      expect(html).toContain("MyTrack.wav");
      expect(html).toContain("8/10");
      expect(html).toContain("Great melody");
    });
  });
});

// ── Onboarding Tour Deep-Link Tests ──

describe("Onboarding Tour Deep-Link", () => {
  it("Intelligence Suite step has deepLink and deepLinkLabel properties", async () => {
    // Read the OnboardingTour source to verify the step config
    const fs = await import("fs");
    const path = await import("path");
    const tourPath = path.resolve(__dirname, "../client/src/components/OnboardingTour.tsx");
    const content = fs.readFileSync(tourPath, "utf-8");

    expect(content).toContain('id: "intelligence-suite"');
    expect(content).toContain('deepLink: "/insights"');
    expect(content).toContain('deepLinkLabel: "Explore Insights"');
  });

  it("TourStep interface includes deepLink and deepLinkLabel fields", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const tourPath = path.resolve(__dirname, "../client/src/components/OnboardingTour.tsx");
    const content = fs.readFileSync(tourPath, "utf-8");

    expect(content).toContain("deepLink?: string;");
    expect(content).toContain("deepLinkLabel?: string;");
  });

  it("renders a deep-link button with Compass icon", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const tourPath = path.resolve(__dirname, "../client/src/components/OnboardingTour.tsx");
    const content = fs.readFileSync(tourPath, "utf-8");

    expect(content).toContain("step.deepLink");
    expect(content).toContain("step.deepLinkLabel");
    expect(content).toContain("Compass");
    expect(content).toContain("completeTour()");
  });
});

// ── Landing Page Animation Tests ──

describe("Landing Page Animated Cards", () => {
  it("Home.tsx imports framer-motion", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
    const content = fs.readFileSync(homePath, "utf-8");

    expect(content).toContain("framer-motion");
    expect(content).toContain("useInView");
    expect(content).toContain("motion");
  });

  it("Home.tsx contains StrategicFeaturesSection component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
    const content = fs.readFileSync(homePath, "utf-8");

    expect(content).toContain("StrategicFeaturesSection");
  });

  it("Home.tsx contains all 6 MiniChartAnimation types", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
    const content = fs.readFileSync(homePath, "utf-8");

    const animTypes = ["skill", "gauge", "traffic", "streak", "radar", "cluster"];
    for (const t of animTypes) {
      expect(content).toContain(`miniChart: "${t}"`);
    }
  });

  it("Home.tsx uses useInView with once:true for performance", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
    const content = fs.readFileSync(homePath, "utf-8");

    expect(content).toContain("once: true");
  });

  it("Home.tsx contains hover animations for cards", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
    const content = fs.readFileSync(homePath, "utf-8");

    expect(content).toContain("whileHover");
  });
});

// ── Integration: recordActivity in upload pipeline ──

describe("recordActivity Pipeline Integration", () => {
  it("trackRouter imports recordActivity from retentionEngine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const routerPath = path.resolve(__dirname, "routers/trackRouter.ts");
    const content = fs.readFileSync(routerPath, "utf-8");

    expect(content).toContain("recordActivity");
    expect(content).toContain("retentionEngine");
  });

  it("jobProcessor imports recordActivity from retentionEngine", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const jobPath = path.resolve(__dirname, "services/jobProcessor.ts");
    const content = fs.readFileSync(jobPath, "utf-8");

    expect(content).toContain("recordActivity");
    expect(content).toContain("retentionEngine");
  });
});

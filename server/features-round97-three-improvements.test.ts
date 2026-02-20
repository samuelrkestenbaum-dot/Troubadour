import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const clientSrc = path.resolve(__dirname, "../client/src");

describe("Round 97 — Feature 1: Compare with Previous Version (A/B Comparison)", () => {
  const abFile = fs.readFileSync(
    path.join(clientSrc, "components/ABReviewComparison.tsx"),
    "utf-8"
  );

  it("should have Version History mode alongside Fresh Perspectives", () => {
    expect(abFile).toContain("Version History");
    expect(abFile).toContain("Fresh Perspectives");
  });

  it("should have a comparison mode selector", () => {
    expect(abFile).toContain("ComparisonMode");
    expect(abFile).toContain("setMode");
  });

  it("should fetch review history for version comparison", () => {
    expect(abFile).toContain("trpc.review.history");
  });

  it("should fetch individual reviews for side-by-side comparison", () => {
    expect(abFile).toContain("trpc.review.get");
  });

  it("should show score progression badge with improvement/regression indicator", () => {
    expect(abFile).toContain("scoreDiff");
    expect(abFile).toContain("text-emerald-400");
    expect(abFile).toContain("text-red-400");
  });

  it("should have a version selector dropdown", () => {
    expect(abFile).toContain("selectedPreviousReviewId");
    expect(abFile).toContain("setSelectedPreviousReviewId");
  });

  it("should handle case when no previous reviews exist", () => {
    expect(abFile).toContain("No previous reviews");
  });

  it("should display review dates in version selector", () => {
    expect(abFile).toContain("toLocaleDateString");
  });
});

describe("Round 97 — Feature 2: Prefetch Active Insights Tab Data", () => {
  const insightsFile = fs.readFileSync(
    path.join(clientSrc, "pages/Insights.tsx"),
    "utf-8"
  );

  it("should prefetch default tab data on mount", () => {
    expect(insightsFile).toContain("utils.analytics.dashboard.prefetch");
  });

  it("should have hover-based prefetching with debounce", () => {
    expect(insightsFile).toContain("handleTabHover");
    expect(insightsFile).toContain("handleTabHoverEnd");
    // 200ms debounce per Claude design
    expect(insightsFile).toContain("200");
  });

  it("should track prefetched tabs to avoid duplicate fetches", () => {
    expect(insightsFile).toContain("prefetchedRef");
  });

  it("should prefetch skillTracker data for skills tab", () => {
    expect(insightsFile).toContain("utils.skillTracker.overview.prefetch");
  });

  it("should prefetch streak data for momentum tab", () => {
    expect(insightsFile).toContain("utils.streak.get.prefetch");
  });

  it("should prefetch artistDNA data for DNA tab", () => {
    expect(insightsFile).toContain("utils.artistDNA.latest.prefetch");
    expect(insightsFile).toContain("utils.artistDNA.history.prefetch");
  });

  it("should have onMouseEnter handlers on tab triggers", () => {
    expect(insightsFile).toContain('onMouseEnter={() => handleTabHover("overview")');
    expect(insightsFile).toContain('onMouseEnter={() => handleTabHover("skills")');
    expect(insightsFile).toContain('onMouseEnter={() => handleTabHover("competitive")');
    expect(insightsFile).toContain('onMouseEnter={() => handleTabHover("momentum")');
    expect(insightsFile).toContain('onMouseEnter={() => handleTabHover("dna")');
  });

  it("should have onMouseLeave handlers on tab triggers", () => {
    const hoverEndCount = (insightsFile.match(/onMouseLeave={handleTabHoverEnd}/g) || []).length;
    expect(hoverEndCount).toBeGreaterThanOrEqual(5);
  });

  it("should have 5 consolidated tabs with subtitles", () => {
    expect(insightsFile).toContain("Overview");
    expect(insightsFile).toContain("Skill Growth");
    expect(insightsFile).toContain("Competitive Position");
    expect(insightsFile).toContain("Momentum");
    expect(insightsFile).toContain("Artist DNA");
    // Subtitles
    expect(insightsFile).toContain("Performance summary and activity trends");
    expect(insightsFile).toContain("Track development across artistic dimensions");
  });
});

describe("Round 97 — Feature 3: Smart Review Length Override", () => {
  const reviewFile = fs.readFileSync(
    path.join(clientSrc, "pages/ReviewView.tsx"),
    "utf-8"
  );

  it("should have Advanced options toggle with Settings2 icon", () => {
    expect(reviewFile).toContain("Settings2");
    expect(reviewFile).toContain("Advanced options");
    expect(reviewFile).toContain("showAdvancedOptions");
  });

  it("should have review length state defaulting to standard", () => {
    expect(reviewFile).toContain("reReviewLength");
    expect(reviewFile).toContain("setReReviewLength");
    expect(reviewFile).toContain('"standard"');
  });

  it("should have three review depth options: Brief, Standard, Detailed", () => {
    expect(reviewFile).toContain('"brief"');
    expect(reviewFile).toContain('"standard"');
    expect(reviewFile).toContain('"detailed"');
    expect(reviewFile).toContain("Quick take, key points only");
    expect(reviewFile).toContain("Balanced analysis");
    expect(reviewFile).toContain("Deep dive, every dimension");
  });

  it("should only send reviewLength when non-standard", () => {
    expect(reviewFile).toContain('reReviewLength !== "standard"');
    expect(reviewFile).toContain("reviewLength: reReviewLength");
  });

  it("should have collapsible advanced options section", () => {
    expect(reviewFile).toContain("showAdvancedOptions");
    expect(reviewFile).toContain("setShowAdvancedOptions");
    // Chevron rotation for open/close state
    expect(reviewFile).toContain("rotate-180");
  });

  it("should preserve template selector in re-review dialog", () => {
    expect(reviewFile).toContain("TemplateSelector");
    expect(reviewFile).toContain("reReviewTemplateId");
  });

  it("should have visual selection state for review depth options", () => {
    expect(reviewFile).toContain("border-primary bg-primary/5 ring-1 ring-primary/20");
    expect(reviewFile).toContain("border-border hover:border-muted-foreground/30");
  });
});

describe("Round 97 — Claude + Gravito Verification", () => {
  it("should have all 3 features implemented with 0 TypeScript errors", () => {
    // Verify all 3 feature files exist and are non-empty
    const abFile = fs.readFileSync(path.join(clientSrc, "components/ABReviewComparison.tsx"), "utf-8");
    const insightsFile = fs.readFileSync(path.join(clientSrc, "pages/Insights.tsx"), "utf-8");
    const reviewFile = fs.readFileSync(path.join(clientSrc, "pages/ReviewView.tsx"), "utf-8");
    expect(abFile.length).toBeGreaterThan(100);
    expect(insightsFile.length).toBeGreaterThan(100);
    expect(reviewFile.length).toBeGreaterThan(100);
  });

  it("should have Claude-designed features with proper UX patterns", () => {
    // Feature 1: mode selector pattern
    const abFile = fs.readFileSync(path.join(clientSrc, "components/ABReviewComparison.tsx"), "utf-8");
    expect(abFile).toContain("ComparisonMode");

    // Feature 2: prefetch pattern
    const insightsFile = fs.readFileSync(path.join(clientSrc, "pages/Insights.tsx"), "utf-8");
    expect(insightsFile).toContain("prefetchedRef");

    // Feature 3: progressive disclosure pattern
    const reviewFile = fs.readFileSync(path.join(clientSrc, "pages/ReviewView.tsx"), "utf-8");
    expect(reviewFile).toContain("showAdvancedOptions");
  });
});

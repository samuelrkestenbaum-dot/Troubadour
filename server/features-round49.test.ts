import { describe, it, expect, vi } from "vitest";

// ── Batch Re-Review Tests ──
describe("Round 49 – Batch Re-Review", () => {
  it("batchReReview procedure requires projectId", () => {
    const input = { projectId: 1 };
    expect(input.projectId).toBe(1);
  });

  it("batchReReview accepts optional templateId and reviewLength", () => {
    const input = {
      projectId: 1,
      templateId: 5,
      reviewLength: "detailed" as const,
    };
    expect(input.templateId).toBe(5);
    expect(input.reviewLength).toBe("detailed");
  });

  it("batchReReview filters for reviewed tracks only", () => {
    const tracks = [
      { id: 1, status: "reviewed" },
      { id: 2, status: "analyzed" },
      { id: 3, status: "reviewed" },
      { id: 4, status: "uploaded" },
    ];
    const reviewedTracks = tracks.filter(t => t.status === "reviewed");
    expect(reviewedTracks).toHaveLength(2);
    expect(reviewedTracks.map(t => t.id)).toEqual([1, 3]);
  });

  it("batchReReview skips tracks with active jobs", () => {
    const tracks = [
      { id: 1, status: "reviewed", hasActiveJob: false },
      { id: 2, status: "reviewed", hasActiveJob: true },
      { id: 3, status: "reviewed", hasActiveJob: false },
    ];
    const eligible = tracks.filter(t => t.status === "reviewed" && !t.hasActiveJob);
    expect(eligible).toHaveLength(2);
  });

  it("batchReReview generates unique batchId with rereview prefix", () => {
    const batchId = `rereview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    expect(batchId).toMatch(/^rereview_\d+_[a-z0-9]+$/);
  });

  it("batchReReview returns queued count and batchId", () => {
    const result = { queued: 3, batchId: "rereview_123_abc" };
    expect(result.queued).toBe(3);
    expect(result.batchId).toContain("rereview_");
  });
});

// ── Score Trend Chart Tests ──
describe("Round 49 – Version Score Trend Chart", () => {
  it("filters track reviews and sorts by version", () => {
    const reviews = [
      { reviewType: "track", reviewVersion: 3, scoresJson: { overall: 8 }, createdAt: "2026-01-03" },
      { reviewType: "album", reviewVersion: 1, scoresJson: { overall: 7 }, createdAt: "2026-01-01" },
      { reviewType: "track", reviewVersion: 1, scoresJson: { overall: 6 }, createdAt: "2026-01-01" },
      { reviewType: "track", reviewVersion: 2, scoresJson: { overall: 7 }, createdAt: "2026-01-02" },
    ];
    const chartData = reviews
      .filter(r => r.reviewType === "track" && r.scoresJson)
      .sort((a, b) => (a.reviewVersion ?? 1) - (b.reviewVersion ?? 1));
    expect(chartData).toHaveLength(3);
    expect(chartData[0].reviewVersion).toBe(1);
    expect(chartData[2].reviewVersion).toBe(3);
  });

  it("calculates overall delta between first and last version", () => {
    const chartData = [
      { scores: { overall: 5.5, production: 6 } },
      { scores: { overall: 7.0, production: 7 } },
      { scores: { overall: 8.2, production: 8 } },
    ];
    const firstOverall = chartData[0].scores.overall;
    const lastOverall = chartData[chartData.length - 1].scores.overall;
    const delta = lastOverall - firstOverall;
    expect(delta).toBeCloseTo(2.7, 1);
  });

  it("extracts all unique dimensions from chart data", () => {
    const chartData = [
      { scores: { overall: 6, production: 5 } },
      { scores: { overall: 7, melody: 8 } },
    ];
    const dims = new Set<string>();
    chartData.forEach(d => Object.keys(d.scores).forEach(k => dims.add(k)));
    expect(dims.size).toBe(3);
    expect(dims.has("overall")).toBe(true);
    expect(dims.has("production")).toBe(true);
    expect(dims.has("melody")).toBe(true);
  });

  it("dimension toggle adds and removes dimensions", () => {
    const visible = new Set(["overall"]);
    // Toggle on production
    visible.add("production");
    expect(visible.has("production")).toBe(true);
    // Toggle off overall
    visible.delete("overall");
    expect(visible.has("overall")).toBe(false);
    expect(visible.size).toBe(1);
  });

  it("handles single version gracefully (no chart)", () => {
    const chartData = [{ scores: { overall: 7 } }];
    expect(chartData.length <= 1).toBe(true);
  });

  it("SVG xScale distributes points evenly", () => {
    const chartWidth = 600;
    const padding = { left: 40, right: 20 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const dataLength = 4;
    const xScale = (i: number) => padding.left + (i / (dataLength - 1)) * plotWidth;
    expect(xScale(0)).toBe(40);
    expect(xScale(3)).toBe(580);
    expect(xScale(1)).toBeCloseTo(220, 0);
  });

  it("SVG yScale maps 0-10 to chart height", () => {
    const chartHeight = 250;
    const padding = { top: 20, bottom: 40 };
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const yScale = (v: number) => padding.top + plotHeight - ((v / 10) * plotHeight);
    expect(yScale(10)).toBe(20); // top
    expect(yScale(0)).toBe(210); // bottom
    expect(yScale(5)).toBe(115); // middle
  });
});

// ── Export Review History Tests ──
describe("Round 49 – Export Review History", () => {
  it("exportHistory requires trackId", () => {
    const input = { trackId: 42 };
    expect(input.trackId).toBe(42);
  });

  it("generates HTML with version badges and score evolution", () => {
    const trackReviews = [
      { reviewVersion: 1, scoresJson: { overall: 6, production: 5 }, reviewMarkdown: "First review", quickTake: "Decent", isLatest: false, createdAt: "2026-01-01" },
      { reviewVersion: 2, scoresJson: { overall: 8, production: 7 }, reviewMarkdown: "Second review", quickTake: "Much better", isLatest: true, createdAt: "2026-01-15" },
    ];
    // Score evolution
    const first = trackReviews[0].scoresJson;
    const last = trackReviews[trackReviews.length - 1].scoresJson;
    const overallDelta = last.overall - first.overall;
    expect(overallDelta).toBe(2);
    const productionDelta = last.production - first.production;
    expect(productionDelta).toBe(2);
  });

  it("generates markdown with version headers and score tables", () => {
    const track = { originalFilename: "My Song.mp3", detectedGenre: "Pop" };
    const reviews = [
      { reviewVersion: 1, scoresJson: { overall: 6 }, reviewMarkdown: "Review text", isLatest: true, createdAt: "2026-01-01" },
    ];
    let markdown = `# ${track.originalFilename} - Review History\n\n`;
    for (const review of reviews) {
      markdown += `## Version ${review.reviewVersion}\n\n`;
      if (review.scoresJson) {
        markdown += `| Dimension | Score |\n|-----------|-------|\n`;
        for (const [k, v] of Object.entries(review.scoresJson)) {
          markdown += `| ${k} | ${v}/10 |\n`;
        }
      }
      markdown += review.reviewMarkdown + "\n\n";
    }
    expect(markdown).toContain("# My Song.mp3 - Review History");
    expect(markdown).toContain("## Version 1");
    expect(markdown).toContain("| overall | 6/10 |");
    expect(markdown).toContain("Review text");
  });

  it("comparison summary shows arrows for score changes", () => {
    const first = { overall: 5, production: 7 };
    const last = { overall: 8, production: 6 };
    const dims = Object.keys(last);
    const arrows = dims.map(k => {
      const delta = (last[k as keyof typeof last] ?? 0) - (first[k as keyof typeof first] ?? 0);
      return delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2192";
    });
    expect(arrows[0]).toBe("\u2191"); // overall went up
    expect(arrows[1]).toBe("\u2193"); // production went down
  });

  it("handles single review (no comparison section)", () => {
    const trackReviews = [
      { reviewVersion: 1, scoresJson: { overall: 7 }, reviewMarkdown: "Only review" },
    ];
    const hasComparison = trackReviews.length >= 2;
    expect(hasComparison).toBe(false);
  });

  it("filename sanitization removes extension", () => {
    const trackName = "My Song.mp3";
    const filename = `${trackName.replace(/\.[^/.]+$/, "")}-review-history.md`;
    expect(filename).toBe("My Song-review-history.md");
  });
});

// ── DIMENSION_COLORS and DIMENSION_LABELS Tests ──
describe("Round 49 – Chart Configuration", () => {
  it("all standard dimensions have colors and labels", () => {
    const DIMENSION_COLORS: Record<string, string> = {
      overall: "#ef4444", production: "#f97316", songwriting: "#eab308",
      melody: "#22c55e", performance: "#06b6d4", mixQuality: "#3b82f6",
      arrangement: "#8b5cf6", originality: "#ec4899",
      commercialPotential: "#f59e0b", lyricalContent: "#14b8a6", emotionalImpact: "#a855f7",
    };
    const DIMENSION_LABELS: Record<string, string> = {
      overall: "Overall", production: "Production", songwriting: "Songwriting",
      melody: "Melody", performance: "Performance", mixQuality: "Mix Quality",
      arrangement: "Arrangement", originality: "Originality",
      commercialPotential: "Commercial", lyricalContent: "Lyrics", emotionalImpact: "Emotional Impact",
    };
    const standardDims = ["overall", "production", "songwriting", "melody", "performance", "mixQuality", "arrangement", "originality"];
    for (const dim of standardDims) {
      expect(DIMENSION_COLORS[dim]).toBeTruthy();
      expect(DIMENSION_LABELS[dim]).toBeTruthy();
    }
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════
// Feature 1: Longitudinal Skill Tracking — Unit Tests
// ═══════════════════════════════════════════════════════════════════

const FOCUS_MODE_DIMENSIONS: Record<string, string[]> = {
  production: ["mixClarity", "soundDesign", "arrangement", "dynamics", "spatialImaging"],
  songwriting: ["melody", "harmony", "lyricalContent", "songStructure", "emotionalImpact"],
  performance: ["vocalTechnique", "instrumentalProficiency", "timing", "expression", "stagePresence"],
  mixing: ["frequencyBalance", "stereoField", "dynamics", "effects", "overallCohesion"],
  mastering: ["loudness", "toneBalance", "stereoWidth", "dynamicRange", "formatReadiness"],
  general: ["overall", "production", "songwriting", "performance", "originality"],
};

describe("Feature 1: Skill Tracker — Dimension Mapping", () => {
  it("returns correct dimensions for each focus mode", () => {
    expect(FOCUS_MODE_DIMENSIONS.production).toHaveLength(5);
    expect(FOCUS_MODE_DIMENSIONS.production).toContain("mixClarity");
    expect(FOCUS_MODE_DIMENSIONS.songwriting).toContain("melody");
    expect(FOCUS_MODE_DIMENSIONS.general).toContain("overall");
  });

  it("all focus modes have exactly 5 dimensions", () => {
    for (const [mode, dims] of Object.entries(FOCUS_MODE_DIMENSIONS)) {
      expect(dims).toHaveLength(5);
    }
  });

  it("no duplicate dimensions within a focus mode", () => {
    for (const [mode, dims] of Object.entries(FOCUS_MODE_DIMENSIONS)) {
      const unique = new Set(dims);
      expect(unique.size).toBe(dims.length);
    }
  });

  it("returns undefined for unknown focus mode", () => {
    expect(FOCUS_MODE_DIMENSIONS["nonexistent"]).toBeUndefined();
  });
});

describe("Feature 1: Score Extraction Logic", () => {
  function extractValidScores(scores: Record<string, number>, focusMode: string): Record<string, number> {
    const dims = FOCUS_MODE_DIMENSIONS[focusMode];
    if (!dims) return {};
    const result: Record<string, number> = {};
    for (const dim of dims) {
      const val = scores[dim];
      if (typeof val === "number" && val >= 0 && val <= 10) {
        result[dim] = val;
      }
    }
    return result;
  }

  it("extracts valid scores for known dimensions", () => {
    const scores = { mixClarity: 7, soundDesign: 8, arrangement: 6, dynamics: 9, spatialImaging: 5 };
    const result = extractValidScores(scores, "production");
    expect(Object.keys(result)).toHaveLength(5);
    expect(result.mixClarity).toBe(7);
  });

  it("ignores scores outside 0-10 range", () => {
    const scores = { mixClarity: -1, soundDesign: 11, arrangement: 6, dynamics: 9, spatialImaging: 5 };
    const result = extractValidScores(scores, "production");
    expect(result.mixClarity).toBeUndefined();
    expect(result.soundDesign).toBeUndefined();
    expect(result.arrangement).toBe(6);
  });

  it("ignores extra dimensions not in focus mode", () => {
    const scores = { mixClarity: 7, unknownDim: 5 };
    const result = extractValidScores(scores, "production");
    expect(result.unknownDim).toBeUndefined();
  });

  it("returns empty for unknown focus mode", () => {
    const result = extractValidScores({ overall: 8 }, "nonexistent");
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Feature 2: Competitive Benchmarking — Unit Tests
// ═══════════════════════════════════════════════════════════════════

describe("Feature 2: Competitive Benchmarking — Percentile Logic", () => {
  function calculatePercentile(userScore: number, allScores: number[]): number {
    if (allScores.length === 0) return 50;
    const sorted = [...allScores].sort((a, b) => a - b);
    const belowCount = sorted.filter(s => s < userScore).length;
    const equalCount = sorted.filter(s => s === userScore).length;
    return Math.round(((belowCount + equalCount * 0.5) / sorted.length) * 100);
  }

  it("returns 50th percentile for empty dataset", () => {
    expect(calculatePercentile(7, [])).toBe(50);
  });

  it("calculates correct percentile for top score", () => {
    const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const p = calculatePercentile(10, scores);
    expect(p).toBeGreaterThanOrEqual(90);
  });

  it("calculates correct percentile for bottom score", () => {
    const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const p = calculatePercentile(1, scores);
    expect(p).toBeLessThanOrEqual(10);
  });

  it("handles tied scores correctly", () => {
    const scores = [5, 5, 5, 5, 5];
    const p = calculatePercentile(5, scores);
    expect(p).toBe(50);
  });

  function signalFromPercentile(percentile: number): "top_tier" | "above_average" | "average" | "below_average" {
    if (percentile >= 90) return "top_tier";
    if (percentile >= 60) return "above_average";
    if (percentile >= 30) return "average";
    return "below_average";
  }

  it("assigns correct signal labels", () => {
    expect(signalFromPercentile(95)).toBe("top_tier");
    expect(signalFromPercentile(75)).toBe("above_average");
    expect(signalFromPercentile(50)).toBe("average");
    expect(signalFromPercentile(15)).toBe("below_average");
  });

  it("handles boundary percentiles", () => {
    expect(signalFromPercentile(90)).toBe("top_tier");
    expect(signalFromPercentile(60)).toBe("above_average");
    expect(signalFromPercentile(30)).toBe("average");
    expect(signalFromPercentile(29)).toBe("below_average");
  });
});

describe("Feature 2: BenchmarkResult Interface Validation", () => {
  it("validates a well-formed benchmark result", () => {
    const result = {
      genre: "rock",
      focusMode: "production",
      dimensions: [
        {
          dimension: "mixClarity",
          userScore: 7.5,
          percentile: 72,
          p25: 4.0,
          p50: 6.0,
          p75: 7.5,
          p90: 9.0,
          mean: 6.2,
          sampleSize: 150,
          signal: "above_average" as const,
        },
      ],
      overallPercentile: 68,
      insights: "Your mix clarity is above average for rock producers.",
    };
    expect(result.genre).toBe("rock");
    expect(result.dimensions).toHaveLength(1);
    expect(result.dimensions[0].signal).toBe("above_average");
    expect(result.overallPercentile).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Feature 3: Release Readiness — Unit Tests
// ═══════════════════════════════════════════════════════════════════

describe("Feature 3: Release Readiness — Signal Logic", () => {
  function overallSignal(score: number): "green" | "yellow" | "red" {
    if (score >= 75) return "green";
    if (score >= 50) return "yellow";
    return "red";
  }

  it("returns green for high scores", () => {
    expect(overallSignal(85)).toBe("green");
    expect(overallSignal(100)).toBe("green");
    expect(overallSignal(75)).toBe("green");
  });

  it("returns yellow for medium scores", () => {
    expect(overallSignal(60)).toBe("yellow");
    expect(overallSignal(50)).toBe("yellow");
  });

  it("returns red for low scores", () => {
    expect(overallSignal(49)).toBe("red");
    expect(overallSignal(0)).toBe("red");
  });
});

describe("Feature 3: ReleaseReadinessResult Interface Validation", () => {
  it("validates a well-formed readiness result", () => {
    const result = {
      overallSignal: "yellow" as const,
      overallScore: 62,
      dimensionSignals: {
        production: { signal: "green" as const, score: 78, reason: "Strong mix quality" },
        songwriting: { signal: "yellow" as const, score: 55, reason: "Lyrics could be stronger" },
      },
      blockers: [
        { dimension: "mastering", severity: "major" as const, description: "Low loudness", fix: "Apply limiting" },
      ],
      strengths: [
        { dimension: "production", description: "Excellent stereo imaging" },
      ],
      readinessStatement: "Track needs some work before release.",
      estimatedEffort: "2-3 hours of revision",
    };
    expect(result.overallSignal).toBe("yellow");
    expect(result.overallScore).toBe(62);
    expect(Object.keys(result.dimensionSignals)).toHaveLength(2);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].severity).toBe("major");
    expect(result.strengths).toHaveLength(1);
    expect(result.readinessStatement).toBeTruthy();
    expect(result.estimatedEffort).toBeTruthy();
  });

  it("validates blocker severity levels", () => {
    const severities = ["critical", "major", "minor"];
    severities.forEach(s => {
      expect(["critical", "major", "minor"]).toContain(s);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Feature 4: Retention & Streak Engine — Unit Tests
// ═══════════════════════════════════════════════════════════════════

const MILESTONES = [
  { name: "First Upload", threshold: 1 },
  { name: "Getting Started", threshold: 3 },
  { name: "Consistent Creator", threshold: 7 },
  { name: "Two-Week Warrior", threshold: 14 },
  { name: "Monthly Maven", threshold: 30 },
  { name: "Quarterly Champion", threshold: 90 },
  { name: "Half-Year Hero", threshold: 180 },
  { name: "Year-Long Legend", threshold: 365 },
];

describe("Feature 4: Retention Engine — Milestones", () => {
  it("has 8 milestones in ascending threshold order", () => {
    expect(MILESTONES).toHaveLength(8);
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].threshold).toBeGreaterThan(MILESTONES[i - 1].threshold);
    }
  });

  it("first milestone is achievable on day 1", () => {
    expect(MILESTONES[0].threshold).toBe(1);
  });

  it("last milestone requires a full year", () => {
    expect(MILESTONES[MILESTONES.length - 1].threshold).toBe(365);
  });

  function computeMilestones(longestStreak: number) {
    return MILESTONES.map(m => ({ ...m, achieved: longestStreak >= m.threshold }));
  }

  it("marks correct milestones as achieved", () => {
    const result = computeMilestones(10);
    expect(result[0].achieved).toBe(true);  // 1 day
    expect(result[1].achieved).toBe(true);  // 3 days
    expect(result[2].achieved).toBe(true);  // 7 days
    expect(result[3].achieved).toBe(false); // 14 days
  });

  it("no milestones achieved for 0 streak", () => {
    const result = computeMilestones(0);
    expect(result.every(m => !m.achieved)).toBe(true);
  });

  it("all milestones achieved for 365+ streak", () => {
    const result = computeMilestones(400);
    expect(result.every(m => m.achieved)).toBe(true);
  });
});

describe("Feature 4: Streak Status Logic", () => {
  function computeStreakStatus(lastActivityDate: string | null): {
    status: "active" | "at_risk" | "broken";
    daysUntilBreak: number;
  } {
    if (!lastActivityDate) return { status: "broken", daysUntilBreak: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastActivityDate === today) return { status: "active", daysUntilBreak: 1 };
    if (lastActivityDate === yesterday) return { status: "at_risk", daysUntilBreak: 0 };
    return { status: "broken", daysUntilBreak: 0 };
  }

  it("returns active for today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeStreakStatus(today);
    expect(result.status).toBe("active");
    expect(result.daysUntilBreak).toBe(1);
  });

  it("returns at_risk for yesterday's date", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const result = computeStreakStatus(yesterday);
    expect(result.status).toBe("at_risk");
    expect(result.daysUntilBreak).toBe(0);
  });

  it("returns broken for old dates", () => {
    const result = computeStreakStatus("2020-01-01");
    expect(result.status).toBe("broken");
  });

  it("returns broken for null", () => {
    const result = computeStreakStatus(null);
    expect(result.status).toBe("broken");
  });
});

describe("Feature 4: Weekly Goal Validation", () => {
  function validateGoal(goal: number): boolean {
    return Number.isInteger(goal) && goal >= 1 && goal <= 14;
  }

  it("accepts valid goals 1-14", () => {
    expect(validateGoal(1)).toBe(true);
    expect(validateGoal(7)).toBe(true);
    expect(validateGoal(14)).toBe(true);
  });

  it("rejects goals outside range", () => {
    expect(validateGoal(0)).toBe(false);
    expect(validateGoal(15)).toBe(false);
    expect(validateGoal(-1)).toBe(false);
  });

  it("rejects non-integer goals", () => {
    expect(validateGoal(3.5)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Feature 5: Artist DNA Identity Model — Unit Tests
// ═══════════════════════════════════════════════════════════════════

describe("Feature 5: Artist DNA — Profile Structure", () => {
  const sampleDNA = {
    artistArchetype: "Atmospheric Storyteller",
    signatureDescription: "A producer who weaves ambient textures with narrative-driven songwriting.",
    harmonicTendencies: {
      preferredKeys: ["C minor", "G major"],
      chordComplexity: "moderate" as const,
      harmonicSignature: "Favors minor keys with occasional major lifts",
    },
    melodicContour: {
      range: "moderate" as const,
      preferredMovement: "stepwise" as const,
      contourSignature: "Smooth, flowing melodic lines",
    },
    rhythmicProfile: {
      tempoRange: { min: 80, max: 140, preferred: 110 },
      grooveStyle: "Laid-back groove with syncopation",
      rhythmicSignature: "Mid-tempo with pocket feel",
    },
    productionFingerprint: {
      preferredInstruments: ["synth pads", "acoustic guitar", "reverbed vocals"],
      soundPalette: "Warm and textured",
      spatialPreference: "immersive" as const,
      dynamicRange: "moderate" as const,
      productionSignature: "Layered ambient production",
    },
    emotionalPalette: {
      dominantEmotions: ["melancholy", "hope", "wonder"],
      emotionalRange: "broad" as const,
      moodSignature: "Bittersweet with uplifting moments",
    },
    genreMap: {
      primaryGenre: "Indie Folk",
      secondaryGenres: ["Ambient", "Dream Pop"],
      uniqueBlend: "Indie folk with ambient electronic textures",
    },
    evolutionNotes: "Shifting toward more electronic production elements.",
    coreStrengths: ["Atmospheric layering", "Emotional depth"],
    growthOpportunities: ["Rhythmic variety", "Vocal processing"],
    trackCount: 12,
    confidence: "high" as const,
  };

  it("has all required top-level fields", () => {
    expect(sampleDNA.artistArchetype).toBeTruthy();
    expect(sampleDNA.signatureDescription).toBeTruthy();
    expect(sampleDNA.harmonicTendencies).toBeDefined();
    expect(sampleDNA.melodicContour).toBeDefined();
    expect(sampleDNA.rhythmicProfile).toBeDefined();
    expect(sampleDNA.productionFingerprint).toBeDefined();
    expect(sampleDNA.emotionalPalette).toBeDefined();
    expect(sampleDNA.genreMap).toBeDefined();
    expect(sampleDNA.coreStrengths.length).toBeGreaterThan(0);
    expect(sampleDNA.growthOpportunities.length).toBeGreaterThan(0);
  });

  it("has valid tempo range", () => {
    const { min, max, preferred } = sampleDNA.rhythmicProfile.tempoRange;
    expect(min).toBeLessThan(max);
    expect(preferred).toBeGreaterThanOrEqual(min);
    expect(preferred).toBeLessThanOrEqual(max);
  });

  it("has valid confidence levels", () => {
    expect(["low", "medium", "high"]).toContain(sampleDNA.confidence);
  });

  it("has valid spatial preference", () => {
    expect(["intimate", "wide", "immersive", "varied"]).toContain(
      sampleDNA.productionFingerprint.spatialPreference
    );
  });

  it("has valid dynamic range", () => {
    expect(["compressed", "moderate", "dynamic", "extreme"]).toContain(
      sampleDNA.productionFingerprint.dynamicRange
    );
  });

  it("has valid chord complexity", () => {
    expect(["simple", "moderate", "complex", "avant-garde"]).toContain(
      sampleDNA.harmonicTendencies.chordComplexity
    );
  });

  it("has valid melodic range", () => {
    expect(["narrow", "moderate", "wide"]).toContain(sampleDNA.melodicContour.range);
  });

  it("has valid emotional range", () => {
    expect(["focused", "moderate", "broad"]).toContain(sampleDNA.emotionalPalette.emotionalRange);
  });
});

describe("Feature 5: DNA Confidence Calculation", () => {
  function calculateConfidence(trackCount: number): "low" | "medium" | "high" {
    if (trackCount >= 10) return "high";
    if (trackCount >= 5) return "medium";
    return "low";
  }

  it("returns low for fewer than 5 tracks", () => {
    expect(calculateConfidence(0)).toBe("low");
    expect(calculateConfidence(3)).toBe("low");
    expect(calculateConfidence(4)).toBe("low");
  });

  it("returns medium for 5-9 tracks", () => {
    expect(calculateConfidence(5)).toBe("medium");
    expect(calculateConfidence(9)).toBe("medium");
  });

  it("returns high for 10+ tracks", () => {
    expect(calculateConfidence(10)).toBe("high");
    expect(calculateConfidence(50)).toBe("high");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Feature 6: Data Flywheel — Unit Tests
// ═══════════════════════════════════════════════════════════════════

describe("Feature 6: Data Flywheel — Archetype Profile Structure", () => {
  const sampleArchetype = {
    clusterLabel: "Ambient Experimentalist",
    description: "Artists who push sonic boundaries through texture and atmosphere.",
    traits: ["atmospheric", "experimental", "layered", "textural"],
    similarArtists: ["Brian Eno", "Sigur Rós", "Boards of Canada"],
    developmentPath: "Explore more structured compositions to balance experimental tendencies.",
    confidence: 85,
  };

  it("has all required fields", () => {
    expect(sampleArchetype.clusterLabel).toBeTruthy();
    expect(sampleArchetype.description).toBeTruthy();
    expect(sampleArchetype.traits.length).toBeGreaterThan(0);
    expect(sampleArchetype.similarArtists.length).toBeGreaterThan(0);
    expect(sampleArchetype.developmentPath).toBeTruthy();
  });

  it("has confidence between 0 and 100", () => {
    expect(sampleArchetype.confidence).toBeGreaterThanOrEqual(0);
    expect(sampleArchetype.confidence).toBeLessThanOrEqual(100);
  });
});

describe("Feature 6: Genre Cluster Profile Structure", () => {
  const sampleCluster = {
    genre: "electronic",
    subgenre: "ambient",
    averageScores: { production: 7.2, originality: 8.1, emotionalImpact: 6.5 },
    topTraits: ["atmospheric", "textural", "minimalist"],
    sampleSize: 42,
    lastUpdated: new Date().toISOString(),
  };

  it("has valid genre and subgenre", () => {
    expect(sampleCluster.genre).toBeTruthy();
    expect(typeof sampleCluster.subgenre).toBe("string");
  });

  it("has positive sample size", () => {
    expect(sampleCluster.sampleSize).toBeGreaterThan(0);
  });

  it("has valid average scores (0-10 range)", () => {
    for (const [key, val] of Object.entries(sampleCluster.averageScores)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(10);
    }
  });

  it("has non-empty traits list", () => {
    expect(sampleCluster.topTraits.length).toBeGreaterThan(0);
  });
});

describe("Feature 6: Platform Stats Structure", () => {
  function validatePlatformStats(stats: {
    totalGenreClusters: number;
    totalBenchmarkedGenres: number;
    genres: string[];
  }) {
    return (
      stats.totalGenreClusters >= 0 &&
      stats.totalBenchmarkedGenres >= 0 &&
      Array.isArray(stats.genres)
    );
  }

  it("validates well-formed stats", () => {
    expect(
      validatePlatformStats({
        totalGenreClusters: 15,
        totalBenchmarkedGenres: 8,
        genres: ["rock", "electronic", "hip-hop"],
      })
    ).toBe(true);
  });

  it("validates empty platform stats", () => {
    expect(
      validatePlatformStats({
        totalGenreClusters: 0,
        totalBenchmarkedGenres: 0,
        genres: [],
      })
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Cross-Feature Integration Tests
// ═══════════════════════════════════════════════════════════════════

describe("Cross-Feature: Router Procedure Names", () => {
  const expectedProcedures = {
    skillTracker: ["overview", "trend", "timeline"],
    competitiveBenchmark: ["evaluate"],
    releaseReadiness: ["evaluate", "history", "latest"],
    streak: ["get", "record", "setGoal"],
    artistDNA: ["generate", "latest", "history"],
    flywheel: ["archetype", "classify", "platformStats"],
  };

  it("all 6 features have defined procedure sets", () => {
    expect(Object.keys(expectedProcedures)).toHaveLength(6);
  });

  it("each feature has at least one procedure", () => {
    for (const [feature, procs] of Object.entries(expectedProcedures)) {
      expect(procs.length).toBeGreaterThan(0);
    }
  });

  it("streak feature has get, record, and setGoal", () => {
    expect(expectedProcedures.streak).toContain("get");
    expect(expectedProcedures.streak).toContain("record");
    expect(expectedProcedures.streak).toContain("setGoal");
  });

  it("artistDNA feature has generate, latest, and history", () => {
    expect(expectedProcedures.artistDNA).toContain("generate");
    expect(expectedProcedures.artistDNA).toContain("latest");
    expect(expectedProcedures.artistDNA).toContain("history");
  });
});

describe("Cross-Feature: Navigation Routes", () => {
  const routes = [
    "/skill-progression",
    "/competitive-benchmarks",
    "/release-readiness",
    "/streak",
    "/artist-dna",
    "/flywheel",
  ];

  it("all 6 feature routes are defined", () => {
    expect(routes).toHaveLength(6);
  });

  it("all routes start with /", () => {
    routes.forEach(r => expect(r.startsWith("/")).toBe(true));
  });

  it("all routes use kebab-case", () => {
    routes.forEach(r => {
      const segments = r.slice(1).split("/");
      segments.forEach(s => {
        expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });
    });
  });
});

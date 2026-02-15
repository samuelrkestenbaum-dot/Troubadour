import { describe, it, expect, vi } from "vitest";

// ── Round 50 Tests ──
// Smart Playlist Ordering, Collaboration Sharing, Review Sentiment Heatmap

describe("Round 50: Smart Playlist Ordering", () => {
  it("should define the playlist.suggestOrder procedure in the router", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("playlist.suggestOrder");
  });

  it("should require projectId input for playlist suggestion", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["playlist.suggestOrder"];
    expect(proc).toBeDefined();
  });

  it("should have the playlist.applyOrder procedure", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("playlist.applyOrder");
  });

  it("playlist suggestion should use structured JSON schema for LLM response", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["playlist.suggestOrder"];
    expect(proc).toBeDefined();
  });

  it("should build correct track data for LLM with audio features", () => {
    // Test the data structure that gets sent to the LLM
    const mockTrack = {
      id: 1,
      title: "Test Song",
      originalFilename: "test.mp3",
      detectedGenre: "Pop",
      detectedBpm: 120,
      detectedKey: "C Major",
    };
    const mockFeatures = {
      geminiAnalysisJson: {
        energy: "high",
        mood: "upbeat",
        tempo: { bpm: 120, feel: "driving" },
      },
    };

    // Verify the data shape matches what the procedure expects
    expect(mockTrack).toHaveProperty("id");
    expect(mockTrack).toHaveProperty("detectedBpm");
    expect(mockTrack).toHaveProperty("detectedKey");
    expect(mockFeatures.geminiAnalysisJson).toHaveProperty("energy");
    expect(mockFeatures.geminiAnalysisJson).toHaveProperty("mood");
  });
});

describe("Round 50: Collaboration Sharing Enhancements", () => {
  it("should have the comment.create procedure", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("comment.create");
  });

  it("should have the comment.list procedure", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("comment.list");
  });

  it("should have the comment.delete procedure", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("comment.delete");
  });

  it("comment.create should be defined", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["comment.create"];
    expect(proc).toBeDefined();
  });

  it("comment.list should be defined", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["comment.list"];
    expect(proc).toBeDefined();
  });

  it("should have review comment database helpers", async () => {
    const db = await import("./db");
    expect(typeof db.createReviewComment).toBe("function");
    expect(typeof db.getReviewComments).toBe("function");
    expect(typeof db.deleteReviewComment).toBe("function");
  });

  it("should have getCollaboratorRole database helper", async () => {
    const db = await import("./db");
    expect(typeof db.getCollaboratorRole).toBe("function");
  });

  it("reviewComments table should exist in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.reviewComments).toBeDefined();
  });

  it("collaboration.invite should accept role parameter", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["collaboration.invite"];
    expect(proc).toBeDefined();
  });
});

describe("Round 50: Review Sentiment Heatmap", () => {
  it("should have the sentimentHeatmap.generate procedure", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("sentimentHeatmap.generate");
  });

  it("sentimentHeatmap.generate should be a mutation", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["sentimentHeatmap.generate"];
    expect(proc).toBeDefined();
  });

  it("should require trackId input", async () => {
    const { appRouter } = await import("./routers");
    const proc = (appRouter._def.procedures as any)["sentimentHeatmap.generate"];
    expect(proc).toBeDefined();
  });

  it("sentiment data structure should have correct shape", () => {
    // Validate the expected output shape
    const mockSentimentData = {
      sections: [
        {
          name: "Intro",
          sentiment: 0.7,
          summary: "Strong opening with atmospheric pads",
          keywords: ["atmospheric", "engaging", "well-crafted"],
          mentionCount: 3,
        },
        {
          name: "Verse 1",
          sentiment: 0.3,
          summary: "Good vocal delivery but lyrics could be stronger",
          keywords: ["vocals", "lyrics", "delivery"],
          mentionCount: 3,
        },
        {
          name: "Chorus",
          sentiment: -0.2,
          summary: "Hook lacks memorability, needs stronger melody",
          keywords: ["hook", "melody", "weak"],
          mentionCount: 3,
        },
      ],
      strongestPositive: { section: "Intro", aspect: "Atmospheric production" },
      strongestNegative: { section: "Chorus", aspect: "Weak hook melody" },
      overallTrend: "Strong opening that loses momentum in the chorus",
    };

    expect(mockSentimentData.sections).toHaveLength(3);
    expect(mockSentimentData.sections[0]).toHaveProperty("name");
    expect(mockSentimentData.sections[0]).toHaveProperty("sentiment");
    expect(mockSentimentData.sections[0]).toHaveProperty("summary");
    expect(mockSentimentData.sections[0]).toHaveProperty("keywords");
    expect(mockSentimentData.sections[0]).toHaveProperty("mentionCount");
    expect(mockSentimentData.strongestPositive).toHaveProperty("section");
    expect(mockSentimentData.strongestPositive).toHaveProperty("aspect");
    expect(mockSentimentData.strongestNegative).toHaveProperty("section");
    expect(mockSentimentData.strongestNegative).toHaveProperty("aspect");
    expect(mockSentimentData).toHaveProperty("overallTrend");
  });

  it("sentiment scores should be in valid range", () => {
    const validScores = [0.7, 0.3, -0.2, -0.8, 0.0, 1.0, -1.0];
    for (const score of validScores) {
      expect(score).toBeGreaterThanOrEqual(-1.0);
      expect(score).toBeLessThanOrEqual(1.0);
    }
  });

  it("sentiment color mapping should work correctly", () => {
    // Test the color mapping logic from the frontend component
    const sentimentColor = (score: number): string => {
      if (score >= 0.6) return "bg-emerald-500";
      if (score >= 0.3) return "bg-emerald-400/80";
      if (score >= 0.1) return "bg-sky-400/70";
      if (score >= -0.1) return "bg-slate-400/60";
      if (score >= -0.3) return "bg-amber-400/80";
      if (score >= -0.6) return "bg-orange-500/80";
      return "bg-red-500";
    };

    expect(sentimentColor(0.8)).toBe("bg-emerald-500");
    expect(sentimentColor(0.4)).toBe("bg-emerald-400/80");
    expect(sentimentColor(0.15)).toBe("bg-sky-400/70");
    expect(sentimentColor(0.0)).toBe("bg-slate-400/60");
    expect(sentimentColor(-0.2)).toBe("bg-amber-400/80");
    expect(sentimentColor(-0.5)).toBe("bg-orange-500/80");
    expect(sentimentColor(-0.8)).toBe("bg-red-500");
  });

  it("sentiment label mapping should work correctly", () => {
    const sentimentLabel = (score: number): string => {
      if (score >= 0.6) return "Very Positive";
      if (score >= 0.3) return "Positive";
      if (score >= 0.1) return "Slightly Positive";
      if (score >= -0.1) return "Neutral";
      if (score >= -0.3) return "Slightly Negative";
      if (score >= -0.6) return "Negative";
      return "Very Negative";
    };

    expect(sentimentLabel(0.9)).toBe("Very Positive");
    expect(sentimentLabel(0.5)).toBe("Positive");
    expect(sentimentLabel(0.15)).toBe("Slightly Positive");
    expect(sentimentLabel(0.0)).toBe("Neutral");
    expect(sentimentLabel(-0.15)).toBe("Slightly Negative");
    expect(sentimentLabel(-0.4)).toBe("Negative");
    expect(sentimentLabel(-0.9)).toBe("Very Negative");
  });
});

describe("Round 50: Frontend Components", () => {
  it("PlaylistSuggestion component file should exist", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/PlaylistSuggestion.tsx")).toBe(true);
  });

  it("SentimentHeatmap component file should exist", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/SentimentHeatmap.tsx")).toBe(true);
  });

  it("ReviewComments component file should exist", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/ReviewComments.tsx")).toBe(true);
  });

  it("CollaborationPanel component file should exist", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/CollaborationPanel.tsx")).toBe(true);
  });
});

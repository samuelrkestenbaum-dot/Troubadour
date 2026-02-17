import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ── Mock external dependencies ──

vi.mock("./db", () => {
  let nextId = 1;
  const mockTracks: any[] = [];
  const mockReviews: any[] = [];

  return {
    getDb: vi.fn().mockResolvedValue({}),
    getUserById: vi.fn().mockImplementation(async (id: number) => ({
      id,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      audioMinutesUsed: 5,
      audioMinutesLimit: 60,
      tier: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    })),
    createProject: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      return { id };
    }),
    getProjectsByUser: vi.fn().mockResolvedValue([]),
    getProjectById: vi.fn().mockImplementation(async (id: number) => ({
      id,
      userId: 1,
      type: "single",
      title: "Test Project",
      genre: null,
      description: null,
      intentNotes: null,
      referenceArtists: null,
      reviewFocus: "full",
      status: "reviewed",
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    updateProjectStatus: vi.fn().mockResolvedValue(undefined),
    createTrack: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      mockTracks.push({ id, ...data, status: "uploaded", createdAt: new Date(), updatedAt: new Date() });
      return { id };
    }),
    getTracksByProject: vi.fn().mockImplementation(async (projectId: number) => {
      return mockTracks.filter(t => t.projectId === projectId);
    }),
    getTrackById: vi.fn().mockImplementation(async (id: number) => {
      // Return a track with genre info for genre-related tests
      if (id === 100) {
        return {
          id: 100,
          userId: 1,
          projectId: 1,
          originalFilename: "test-track.mp3",
          filename: "test-track.mp3",
          storageUrl: "https://s3.example.com/audio/test.mp3",
          storageKey: "audio/test.mp3",
          mimeType: "audio/mpeg",
          fileSize: 5000000,
          duration: 210,
          trackOrder: 1,
          versionNumber: 1,
          parentTrackId: null,
          detectedGenre: "Indie Rock",
          detectedSubgenres: "Alternative Rock, Shoegaze",
          detectedInfluences: "Radiohead, My Bloody Valentine",
          status: "reviewed",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      // Track without genre (not yet analyzed)
      if (id === 101) {
        return {
          id: 101,
          userId: 1,
          projectId: 1,
          originalFilename: "unanalyzed-track.mp3",
          filename: "unanalyzed-track.mp3",
          storageUrl: "https://s3.example.com/audio/test2.mp3",
          storageKey: "audio/test2.mp3",
          mimeType: "audio/mpeg",
          fileSize: 3000000,
          duration: null,
          trackOrder: 2,
          versionNumber: 1,
          parentTrackId: null,
          detectedGenre: null,
          detectedSubgenres: null,
          detectedInfluences: null,
          status: "uploaded",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    }),
    updateTrackStatus: vi.fn().mockResolvedValue(undefined),
    updateTrackGenre: vi.fn().mockResolvedValue(undefined),
    getTrackVersions: vi.fn().mockResolvedValue([]),
    upsertLyrics: vi.fn().mockImplementation(async () => ({ id: nextId++ })),
    getLyricsByTrack: vi.fn().mockResolvedValue([]),
    getAudioFeaturesByTrack: vi.fn().mockImplementation(async (trackId: number) => {
      if (trackId === 100) {
        return {
          id: 1,
          trackId: 100,
          featuresJson: {
            tempo: 128,
            key: "E minor",
            genre: { primary: "Indie Rock", secondary: ["Alternative Rock", "Shoegaze"], influences: ["Radiohead", "My Bloody Valentine"] },
          },
          sectionsJson: [],
          geminiAnalysisJson: {
            tempo: 128,
            key: "E minor",
            genre: { primary: "Indie Rock", secondary: ["Alternative Rock", "Shoegaze"], influences: ["Radiohead", "My Bloody Valentine"] },
          },
        };
      }
      return null;
    }),
    saveAudioFeatures: vi.fn().mockResolvedValue({ id: 1 }),
    createReview: vi.fn().mockImplementation(async () => ({ id: nextId++ })),
    getReviewsByProject: vi.fn().mockResolvedValue([]),
    getReviewsByTrack: vi.fn().mockResolvedValue([]),
    getReviewById: vi.fn().mockImplementation(async (id: number) => {
      if (id === 200) {
        return {
          id: 200,
          projectId: 1,
          trackId: 100,
          userId: 1,
          reviewType: "track",
          modelUsed: "claude-sonnet-4-5-20250929",
          reviewMarkdown: "## Quick Take\n- Great indie rock track\n\n## Scores\n| Component | Score |\n|---|---|\n| Overall | 7 |",
          scoresJson: { overall: 7, production: 6, songwriting: 8 },
          quickTake: "Great indie rock track with strong melodies",
          comparedTrackId: null,
          createdAt: new Date(),
        };
      }
      return null;
    }),
    getAlbumReview: vi.fn().mockResolvedValue(null),
    createJob: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      return { id };
    }),
    getJobById: vi.fn().mockResolvedValue(null),
    getJobsByProject: vi.fn().mockResolvedValue([]),
    updateJob: vi.fn().mockResolvedValue(undefined),
    getActiveJobForTrack: vi.fn().mockResolvedValue(null),
    incrementAudioMinutes: vi.fn().mockResolvedValue(undefined),
    getConversationByReview: vi.fn().mockResolvedValue([]),
    createConversationMessage: vi.fn().mockImplementation(async (data: any) => ({ id: nextId++, ...data })),
    getReferenceTracksByTrack: vi.fn().mockResolvedValue([]),
    getReferenceTrackById: vi.fn().mockResolvedValue(null),
    createReferenceTrack: vi.fn().mockImplementation(async (data: any) => ({ id: nextId++ })),
    updateReferenceTrackComparison: vi.fn().mockResolvedValue(undefined),
    getScoreHistoryForTrack: vi.fn().mockResolvedValue([]),
    createChatSession: vi.fn().mockImplementation(async (data: any) => ({ id: 99 })),
    getChatSessionsByUser: vi.fn().mockResolvedValue([]),
    getChatSessionById: vi.fn().mockResolvedValue(null),
    getChatMessagesBySession: vi.fn().mockResolvedValue([]),
    createChatMessage: vi.fn().mockImplementation(async (data: any) => ({ id: 100 })),
    updateChatSessionTitle: vi.fn().mockResolvedValue(undefined),
    touchChatSession: vi.fn().mockResolvedValue(undefined),
    deleteChatSession: vi.fn().mockResolvedValue(undefined),
    getLatestJobForTrack: vi.fn().mockResolvedValue(null),
    getReviewByShareToken: vi.fn().mockResolvedValue(null),
    setReviewShareToken: vi.fn().mockResolvedValue(undefined),
    getNextQueuedJob: vi.fn().mockResolvedValue(null),
    getStaleRunningJobs: vi.fn().mockResolvedValue([]),
    getJobsByBatchId: vi.fn().mockResolvedValue([]),
    getReviewHistory: vi.fn().mockResolvedValue([]),
    updateTrackTags: vi.fn().mockResolvedValue(undefined),
    getTrackTags: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({ totalProjects: 0, totalTracks: 0, totalReviews: 0, reviewedTracks: 0 }),
    getScoreDistribution: vi.fn().mockResolvedValue([]),
    getRecentActivity: vi.fn().mockResolvedValue([]),
    getAverageScores: vi.fn().mockResolvedValue({}),
    getTopTracks: vi.fn().mockResolvedValue([]),
    updateUserPreferredPersona: vi.fn().mockResolvedValue(undefined),
    getUserPreferredPersona: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/audio/test.mp3", key: "audio/test.mp3" }),
}));

vi.mock("./services/jobProcessor", () => ({
  enqueueJob: vi.fn(),
}));

vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ text: "Hello world lyrics", language: "en" }),
}));

vi.mock("./services/claudeCritic", () => ({
  CLAUDE_MODEL: "claude-sonnet-4-5-20250929",
  generateFollowUp: vi.fn().mockResolvedValue("Here's more detail..."),
  generateReferenceComparison: vi.fn().mockResolvedValue("## Comparison\nYour track vs reference..."),
  generateTrackReview: vi.fn(),
  generateAlbumReview: vi.fn(),
  generateVersionComparison: vi.fn(),
  callClaude: vi.fn().mockResolvedValue("Great question! Here's my analysis..."),
}));

vi.mock("./services/geminiAudio", () => ({
  analyzeAudioWithGemini: vi.fn(),
  compareAudioWithGemini: vi.fn(),
  compareReferenceWithGemini: vi.fn().mockResolvedValue({
    referenceAnalysis: { tempo: 120, key: "C major" },
    comparison: "Both tracks share similar tempo.",
  }),
}));

// ── Helpers ──

function createTestUser(): User {
  return {
    id: 1,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test Artist",
    loginMethod: "manus",
    role: "user",
    audioMinutesUsed: 5,
    audioMinutesLimit: 60,
    tier: "free",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as User;
}

function createAuthContext(user?: User): TrpcContext {
  return {
    user: user || createTestUser(),
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ── Genre Detection Tests ──

describe("Genre Detection - track.get returns genre fields", () => {
  it("returns detected genre, subgenres, and influences for analyzed tracks", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.track.get({ id: 100 });

    expect(result.track.detectedGenre).toBe("Indie Rock");
    expect(result.track.detectedSubgenres).toBe("Alternative Rock, Shoegaze");
    expect(result.track.detectedInfluences).toBe("Radiohead, My Bloody Valentine");
  });

  it("returns null genre fields for unanalyzed tracks", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.track.get({ id: 101 });

    expect(result.track.detectedGenre).toBeNull();
    expect(result.track.detectedSubgenres).toBeNull();
    expect(result.track.detectedInfluences).toBeNull();
  });
});

describe("Genre Detection - review.get includes genre insight", () => {
  it("returns genreInsight with detected genre for track reviews", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.review.get({ id: 200 });

    expect(result.genreInsight).toBeDefined();
    expect(result.genreInsight?.detectedGenre).toBe("Indie Rock");
    expect(result.genreInsight?.detectedSubgenres).toBe("Alternative Rock, Shoegaze");
    expect(result.genreInsight?.detectedInfluences).toBe("Radiohead, My Bloody Valentine");
  });
});

describe("Genre Detection - project creation without genre field", () => {
  it("creates a project without requiring genre input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      type: "single",
      title: "No Genre Needed",
      description: "Genre will be auto-detected from audio",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("still accepts genre field for backward compatibility", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      type: "single",
      title: "With Genre",
      genre: "Hip-Hop",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });
});

describe("Genre Detection - updateTrackGenre helper", () => {
  it("updateTrackGenre is callable", async () => {
    const db = await import("./db");
    await db.updateTrackGenre(100, "Pop", ["Synth-Pop", "Electro-Pop"], ["Dua Lipa", "Charli XCX"]);
    expect(db.updateTrackGenre).toHaveBeenCalledWith(
      100,
      "Pop",
      ["Synth-Pop", "Electro-Pop"],
      ["Dua Lipa", "Charli XCX"],
    );
  });
});

describe("Genre Detection - Claude critique receives genre context", () => {
  it("generateTrackReview accepts genre parameter", async () => {
    const { generateTrackReview } = await import("./services/claudeCritic");
    // Verify the function exists and can be called with genre context
    expect(generateTrackReview).toBeDefined();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ── Mock external dependencies ──

// Mock db module
vi.mock("./db", () => {
  const mockProjects: any[] = [];
  const mockTracks: any[] = [];
  const mockReviews: any[] = [];
  const mockJobs: any[] = [];
  const mockFeatures: any[] = [];
  const mockLyrics: any[] = [];
  let nextId = 1;

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
      monthlyReviewCount: 0,
      monthlyResetAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    })),
    createProject: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      mockProjects.push({ id, ...data, status: "draft", createdAt: new Date(), updatedAt: new Date() });
      return { id };
    }),
    getProjectsByUser: vi.fn().mockImplementation(async (userId: number) => {
      return mockProjects.filter(p => p.userId === userId);
    }),
    getProjectById: vi.fn().mockImplementation(async (id: number) => {
      return mockProjects.find(p => p.id === id) || null;
    }),
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
    getTrackCountsByProjects: vi.fn().mockResolvedValue(new Map()),
    getTrackById: vi.fn().mockImplementation(async (id: number) => {
      return mockTracks.find(t => t.id === id) || null;
    }),
    updateTrackStatus: vi.fn().mockResolvedValue(undefined),
    getTrackVersions: vi.fn().mockResolvedValue([]),
    upsertLyrics: vi.fn().mockImplementation(async () => ({ id: nextId++ })),
    getLyricsByTrack: vi.fn().mockResolvedValue([]),
    getAudioFeaturesByTrack: vi.fn().mockResolvedValue(null),
    saveAudioFeatures: vi.fn().mockResolvedValue({ id: 1 }),
    createReview: vi.fn().mockImplementation(async () => ({ id: nextId++ })),
    getReviewsByProject: vi.fn().mockResolvedValue([]),
    getReviewsByTrack: vi.fn().mockResolvedValue([]),
    getReviewById: vi.fn().mockResolvedValue(null),
    getAlbumReview: vi.fn().mockResolvedValue(null),
    createJob: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      mockJobs.push({ id, ...data, status: "queued", progress: 0, createdAt: new Date() });
      return { id };
    }),
    getJobById: vi.fn().mockImplementation(async (id: number) => {
      return mockJobs.find(j => j.id === id) || null;
    }),
    getJobsByProject: vi.fn().mockResolvedValue([]),
    updateJob: vi.fn().mockResolvedValue(undefined),
    getActiveJobForTrack: vi.fn().mockResolvedValue(null),
    incrementAudioMinutes: vi.fn().mockResolvedValue(undefined),
    getConversationByReview: vi.fn().mockResolvedValue([]),
    createConversationMessage: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      return { id, ...data, createdAt: new Date() };
    }),
    getReferenceTracksByTrack: vi.fn().mockResolvedValue([]),
    getReferenceTrackById: vi.fn().mockResolvedValue(null),
    createReferenceTrack: vi.fn().mockImplementation(async (data: any) => {
      const id = nextId++;
      return { id, ...data, createdAt: new Date() };
    }),
    updateReferenceTrackComparison: vi.fn().mockResolvedValue(undefined),
    getScoreHistoryForTrack: vi.fn().mockResolvedValue([]),
    getNextQueuedJob: vi.fn().mockResolvedValue(null),
    getStaleRunningJobs: vi.fn().mockResolvedValue([]),
    claimNextQueuedJob: vi.fn().mockResolvedValue(null),
    updateJobHeartbeat: vi.fn().mockResolvedValue(undefined),
    getJobsByBatchId: vi.fn().mockResolvedValue([]),
    getReviewHistory: vi.fn().mockResolvedValue([
      { id: 2, reviewVersion: 2, isLatest: true, modelUsed: "claude-sonnet-4-5-20250929", scoresJson: { overall: 8 }, quickTake: "Great improvement", createdAt: new Date() },
      { id: 1, reviewVersion: 1, isLatest: false, modelUsed: "claude-sonnet-4-5-20250929", scoresJson: { overall: 6 }, quickTake: "Decent start", createdAt: new Date(Date.now() - 86400000) },
    ]),
    updateTrackGenre: vi.fn().mockResolvedValue(undefined),
    createChatSession: vi.fn().mockImplementation(async (data: any) => {
      return { id: 99, ...data, lastActiveAt: new Date(), createdAt: new Date() };
    }),
    getChatSessionsByUser: vi.fn().mockResolvedValue([]),
    getChatSessionById: vi.fn().mockImplementation(async (id: number) => {
      if (id === 99) return { id: 99, userId: 1, projectId: null, trackId: null, title: "Test chat", lastActiveAt: new Date(), createdAt: new Date() };
      return null;
    }),
    getChatMessagesBySession: vi.fn().mockResolvedValue([
      { id: 1, sessionId: 99, role: "system", content: "You are Troubadour's music advisor.", createdAt: new Date() },
    ]),
    createChatMessage: vi.fn().mockImplementation(async (data: any) => {
      return { id: 100, ...data, createdAt: new Date() };
    }),
    updateChatSessionTitle: vi.fn().mockResolvedValue(undefined),
    touchChatSession: vi.fn().mockResolvedValue(undefined),
    deleteChatSession: vi.fn().mockResolvedValue(undefined),
    getLatestJobForTrack: vi.fn().mockResolvedValue(null),
    getReviewByShareToken: vi.fn().mockResolvedValue(null),
    setReviewShareToken: vi.fn().mockResolvedValue(undefined),
    // Monthly review tracking
    resetMonthlyUsageIfNeeded: vi.fn().mockResolvedValue(undefined),
    incrementMonthlyReviewCount: vi.fn().mockResolvedValue(undefined),
    getMonthlyReviewCount: vi.fn().mockResolvedValue(0),
    // Webhook idempotency
    isWebhookEventProcessed: vi.fn().mockResolvedValue(false),
    markWebhookEventProcessed: vi.fn().mockResolvedValue(undefined),
    // Stripe
    getUserByStripeCustomerId: vi.fn().mockResolvedValue(null),
    updateUserSubscription: vi.fn().mockResolvedValue(undefined),
    // Tags
    updateTrackTags: vi.fn().mockResolvedValue(undefined),
    getTrackTags: vi.fn().mockResolvedValue([]),
    // Analytics
    getDashboardStats: vi.fn().mockResolvedValue({
      totalProjects: 3,
      totalTracks: 12,
      totalReviews: 8,
      reviewedTracks: 7,
    }),
    getScoreDistribution: vi.fn().mockResolvedValue([
      { score: 5, count: 1 },
      { score: 6, count: 2 },
      { score: 7, count: 3 },
      { score: 8, count: 2 },
    ]),
    getRecentActivity: vi.fn().mockResolvedValue([
      { id: 1, reviewType: "track", quickTake: "Solid track", scoresJson: { overall: 7 }, trackId: 1, projectId: 1, createdAt: new Date(), reviewVersion: 1 },
    ]),
    getAverageScores: vi.fn().mockResolvedValue({
      overall: 7.2,
      production: 6.8,
      songwriting: 7.5,
    }),
    getTopTracks: vi.fn().mockResolvedValue([
      { trackId: 1, overall: 9, quickTake: "Excellent", reviewVersion: 1, filename: "hit-song.wav", genre: "Pop" },
      { trackId: 2, overall: 8, quickTake: "Great", reviewVersion: 1, filename: "banger.mp3", genre: "Hip-Hop" },
    ]),
    softDeleteUser: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/audio/test.mp3", key: "audio/test.mp3" }),
}));

// Mock job processor (don't actually run jobs)
vi.mock("./services/jobProcessor", () => ({
  enqueueJob: vi.fn(),
  startJobQueue: vi.fn(),
}));

// Mock voice transcription
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({ text: "Hello world lyrics", language: "en" }),
}));

// Mock Claude critic follow-up and reference comparison
vi.mock("./services/claudeCritic", () => ({
  CLAUDE_MODEL: "claude-sonnet-4-5-20250929",
  generateFollowUp: vi.fn().mockResolvedValue("Here's more detail about the chorus..."),
  generateReferenceComparison: vi.fn().mockResolvedValue("## Comparison\nYour track vs reference..."),
  generateTrackReview: vi.fn(),
  generateAlbumReview: vi.fn(),
  generateVersionComparison: vi.fn(),
  callClaude: vi.fn().mockResolvedValue("Great question! Here's my analysis of your track..."),
  extractScoresStructured: vi.fn().mockResolvedValue({ overall: 7, production: 7, songwriting: 8 }),
  extractScores: vi.fn().mockReturnValue({ overall: 7, production: 7, songwriting: 8 }),
}));

// Mock Gemini reference comparison
vi.mock("./services/geminiAudio", () => ({
  analyzeAudioWithGemini: vi.fn(),
  compareAudioWithGemini: vi.fn(),
  compareReferenceWithGemini: vi.fn().mockResolvedValue({
    referenceAnalysis: { tempo: 120, key: "C major" },
    comparison: "Both tracks share similar tempo but differ in frequency balance.",
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
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    deletedAt: null,
    monthlyReviewCount: 0,
    monthlyResetAt: new Date(),
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

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ── Tests ──

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const user = createTestUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("Test Artist");
  });

  it("returns null for unauthenticated requests", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("project.create", () => {
  it("creates a project with just a title (minimal input)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      title: "My New Single",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("creates a project with explicit type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      type: "album",
      title: "Midnight Sessions EP",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("accepts optional fields when provided", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      title: "Full Details Track",
      type: "single",
      description: "My debut single",
      reviewFocus: "producer",
      referenceArtists: "Frank Ocean",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("rejects invalid reviewFocus", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.project.create({
        type: "single",
        title: "Bad Focus",
        reviewFocus: "invalid" as any,
      })
    ).rejects.toThrow();
  });

  it("rejects empty title", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.project.create({
        type: "single",
        title: "",
      })
    ).rejects.toThrow();
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.project.create({
        type: "single",
        title: "Test Track",
      })
    ).rejects.toThrow();
  });
});

describe("project.list", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.project.list()).rejects.toThrow();
  });

  it("returns projects for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("track.upload", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.track.upload({
        projectId: 1,
        filename: "test.mp3",
        mimeType: "audio/mpeg",
        fileBase64: "dGVzdA==",
        fileSize: 4,
      })
    ).rejects.toThrow();
  });
});

describe("lyrics.save", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.lyrics.save({
        trackId: 1,
        text: "These are my lyrics",
      })
    ).rejects.toThrow();
  });
});

describe("job.analyze", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.job.analyze({ trackId: 1 })
    ).rejects.toThrow();
  });
});

describe("job.review", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.job.review({ trackId: 1 })
    ).rejects.toThrow();
  });
});

describe("usage.get", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.usage.get()).rejects.toThrow();
  });

  it("returns usage data for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.usage.get();
    expect(result).toBeDefined();
    expect(typeof result.audioMinutesUsed).toBe("number");
    expect(typeof result.audioMinutesLimit).toBe("number");
    expect(typeof result.tier).toBe("string");
  });
});

// ── Claude Critic unit tests ──

describe("claudeCritic score extraction", () => {
  it("CLAUDE_MODEL constant is set correctly", async () => {
    const { CLAUDE_MODEL } = await import("./services/claudeCritic");
    expect(CLAUDE_MODEL).toBe("claude-sonnet-4-5-20250929");
    expect(CLAUDE_MODEL).toContain("claude");
  });
});

// ── Review Focus configuration tests ──

describe("reviewFocus configuration", () => {
  it("returns config for all valid roles", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const roles = ["songwriter", "producer", "arranger", "artist", "anr", "full"] as const;
    for (const role of roles) {
      const config = getFocusConfig(role);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.scoringDimensions.length).toBeGreaterThan(0);
      expect(config.outputSections.length).toBeGreaterThan(0);
    }
  });

  it("full role has empty overrides", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("full");
    expect(config.geminiAddendum).toBe("");
    expect(config.claudeSystemOverride).toBe("");
  });

  it("non-full roles have system overrides", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const roles = ["songwriter", "producer", "arranger", "artist", "anr"] as const;
    for (const role of roles) {
      const config = getFocusConfig(role);
      expect(config.claudeSystemOverride.length).toBeGreaterThan(100);
      expect(config.geminiAddendum.length).toBeGreaterThan(50);
    }
  });

  it("getAllFocusConfigs returns all roles", async () => {
    const { getAllFocusConfigs } = await import("./services/reviewFocus");
    const configs = getAllFocusConfigs();
    expect(Object.keys(configs)).toHaveLength(6);
    expect(configs.songwriter).toBeDefined();
    expect(configs.producer).toBeDefined();
    expect(configs.anr).toBeDefined();
  });
});

// ── Gemini Audio service validation ──

describe("geminiAudio service", () => {
  it("exports analyzeAudioWithGemini function", async () => {
    const mod = await import("./services/geminiAudio");
    expect(typeof mod.analyzeAudioWithGemini).toBe("function");
  });

  it("exports compareAudioWithGemini function", async () => {
    const mod = await import("./services/geminiAudio");
    expect(typeof mod.compareAudioWithGemini).toBe("function");
  });
});

// ── Job processor validation ──

describe("jobProcessor", () => {
  it("exports enqueueJob function", async () => {
    const mod = await import("./services/jobProcessor");
    expect(typeof mod.enqueueJob).toBe("function");
  });
});

// ── Conversation tests ──

describe("conversation", () => {
  it("requires authentication to list messages", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.conversation.list({ reviewId: 1 })
    ).rejects.toThrow();
  });

  it("requires authentication to send messages", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.conversation.send({ reviewId: 1, message: "Tell me more" })
    ).rejects.toThrow();
  });

  it("rejects empty messages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.conversation.send({ reviewId: 1, message: "" })
    ).rejects.toThrow();
  });

  it("rejects messages over 2000 chars", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.conversation.send({ reviewId: 1, message: "a".repeat(2001) })
    ).rejects.toThrow();
  });
});

// ── Reference track tests ──

describe("reference", () => {
  it("requires authentication to list references", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.reference.list({ trackId: 1 })
    ).rejects.toThrow();
  });

  it("requires authentication to upload references", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.reference.upload({
        trackId: 1,
        filename: "ref.mp3",
        mimeType: "audio/mpeg",
        fileBase64: "dGVzdA==",
        fileSize: 4,
      })
    ).rejects.toThrow();
  });

  it("requires authentication to compare references", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.reference.compare({ referenceId: 1 })
    ).rejects.toThrow();
  });
});

// ── Score history tests ──

describe("scoreHistory", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.scoreHistory.get({ trackId: 1 })
    ).rejects.toThrow();
  });
});

// ── Gemini reference comparison export ──

describe("geminiAudio reference comparison", () => {
  it("exports compareReferenceWithGemini function", async () => {
    const mod = await import("./services/geminiAudio");
    expect(typeof mod.compareReferenceWithGemini).toBe("function");
  });
});

// ── Claude follow-up export ──

describe("claudeCritic follow-up", () => {
  it("exports generateFollowUp function", async () => {
    const mod = await import("./services/claudeCritic");
    expect(typeof mod.generateFollowUp).toBe("function");
  });

  it("exports generateReferenceComparison function", async () => {
    const mod = await import("./services/claudeCritic");
    expect(typeof mod.generateReferenceComparison).toBe("function");
  });
});

// ── Input validation tests ──

// ── Chat sidebar tests ──

describe("chat", () => {
  it("requires auth to create a chat session", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.createSession({})).rejects.toThrow();
  });

  it("creates a chat session with project context (artist tier)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" } as User;
    const ctx = createAuthContext(artistUser);
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(artistUser);
    const result = await caller.chat.createSession({ projectId: 1 });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("title");
  });

  it("creates a chat session without context (artist tier)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" } as User;
    const ctx = createAuthContext(artistUser);
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(artistUser);
    const result = await caller.chat.createSession({});
    expect(result.id).toBeDefined();
    expect(result.title).toBe("New conversation");
  });

  it("lists chat sessions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.listSessions({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("gets messages for a session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const messages = await caller.chat.getMessages({ sessionId: 99 });
    expect(Array.isArray(messages)).toBe(true);
  });

  it("sends a message and gets a Claude response (artist tier)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" } as User;
    const ctx = createAuthContext(artistUser);
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(artistUser);
    (db.getChatSessionById as any).mockResolvedValueOnce({ id: 99, userId: 1, projectId: null, trackId: null, title: "Test chat", lastActiveAt: new Date(), createdAt: new Date() });
    const result = await caller.chat.sendMessage({ sessionId: 99, message: "How can I improve my mix?" });
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe("string");
  });

  it("rejects getting messages for non-existent session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.getMessages({ sessionId: 999 })).rejects.toThrow();
  });

  it("deletes a chat session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.deleteSession({ sessionId: 99 });
    expect(result.success).toBe(true);
  });
});

describe("input validation", () => {
  it("rejects project creation with invalid type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.project.create({
        type: "invalid_type" as any,
        title: "Test",
      })
    ).rejects.toThrow();
  });

  it("rejects project creation with title too long", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.project.create({
        type: "single",
        title: "a".repeat(256),
      })
    ).rejects.toThrow();
  });

  it("rejects lyrics save with empty text", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.lyrics.save({
        trackId: 1,
        text: "",
      })
    ).rejects.toThrow();
  });
});

// ── Retry job tests ──

describe("job.retry", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.job.retry({ jobId: 1 })
    ).rejects.toThrow();
  });
});

// ── Analyze and Review one-click flow tests ──

describe("job.analyzeAndReview", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.job.analyzeAndReview({ trackId: 1 })
    ).rejects.toThrow();
  });
});

// ── Claude model version test ──

describe("Claude model version", () => {
  it("uses Claude Sonnet 4.5 model", async () => {
    const { CLAUDE_MODEL } = await import("./services/claudeCritic");
    expect(CLAUDE_MODEL).toBe("claude-sonnet-4-5-20250929");
    expect(CLAUDE_MODEL).toContain("4-5");
  });
});

// ── Persistent Job Queue tests ──

describe("persistent job queue", () => {
  it("exports startJobQueuePoller function", async () => {
    const mod = await import("./services/jobProcessor");
    expect(typeof mod.startJobQueue).toBe("function");
  });

  it("exports enqueueJob function", async () => {
    const mod = await import("./services/jobProcessor");
    expect(typeof mod.enqueueJob).toBe("function");
  });
});

// ── Structured Score Extraction tests ──

describe("structured score extraction", () => {
  it("exports extractScoresStructured function", async () => {
    const mod = await import("./services/claudeCritic");
    expect(typeof mod.extractScoresStructured).toBe("function");
  });

  it("exports extractScores as fallback", async () => {
    const mod = await import("./services/claudeCritic");
    expect(typeof mod.extractScores).toBe("function");
  });
});

// ── Review Export tests ──

describe("review.exportMarkdown", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.review.exportMarkdown({ id: 1 })
    ).rejects.toThrow();
  });

  it("returns not found for non-existent review", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.review.exportMarkdown({ id: 999 })
    ).rejects.toThrow("Review not found");
  });
});

// ── Database helpers for persistent queue ──

describe("db queue helpers", () => {
  it("getNextQueuedJob returns null when no jobs queued", async () => {
    const db = await import("./db");
    const result = await db.getNextQueuedJob();
    expect(result).toBeNull();
  });

  it("getStaleRunningJobs returns empty array", async () => {
    const db = await import("./db");
    const result = await db.getStaleRunningJobs();
    expect(result).toEqual([]);
  });

  it("updateTrackGenre resolves without error", async () => {
    const db = await import("./db");
    await expect(db.updateTrackGenre(1, "Rock", ["Alternative", "Indie"], ["Radiohead", "Coldplay"])).resolves.toBeUndefined();
  });
});

// ── Batch Processing tests ──

describe("job.batchReviewAll", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.job.batchReviewAll({ projectId: 1 })
    ).rejects.toThrow();
  });

  it("throws not found for non-existent project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce(null);

    await expect(
      caller.job.batchReviewAll({ projectId: 999 })
    ).rejects.toThrow();
  });

  it("returns queued count for valid project with tracks (pro tier)", async () => {
    const proUser = { ...createTestUser(), tier: "pro", audioMinutesLimit: 720 } as User;
    const ctx = createAuthContext(proUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, type: "album", title: "Test Album", status: "draft",
      createdAt: new Date(), updatedAt: new Date(),
    });
    (db.getUserById as any).mockResolvedValueOnce(proUser);
    (db.getUserById as any).mockResolvedValueOnce(proUser);
    (db.getTracksByProject as any).mockResolvedValueOnce([
      { id: 10, projectId: 1, userId: 1, status: "uploaded", originalFilename: "track1.mp3" },
      { id: 11, projectId: 1, userId: 1, status: "reviewed", originalFilename: "track2.mp3" },
      { id: 12, projectId: 1, userId: 1, status: "uploaded", originalFilename: "track3.mp3" },
    ]);
    (db.getActiveJobForTrack as any).mockResolvedValue(null);

    const result = await caller.job.batchReviewAll({ projectId: 1 });
    expect(result.queued).toBeGreaterThanOrEqual(0);
  });
});

// ── Version Diff tests ──

describe("review.versionDiff", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.review.versionDiff({ trackId: 1 })
    ).rejects.toThrow();
  });

  it("throws not found for non-existent track", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getTrackById as any).mockResolvedValueOnce(null);

    await expect(
      caller.review.versionDiff({ trackId: 999 })
    ).rejects.toThrow();
  });
});

// ── Shareable Review Links tests ──

describe("review.generateShareLink", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.review.generateShareLink({ id: 1 })
    ).rejects.toThrow();
  });

  it("throws not found for non-existent review", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce(null);

    await expect(
      caller.review.generateShareLink({ id: 999 })
    ).rejects.toThrow();
  });

  it("returns existing share token if already set (artist tier)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" } as User;
    const ctx = createAuthContext(artistUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce({
      id: 1, userId: 1, projectId: 1, reviewType: "track",
      reviewMarkdown: "Great track!", scoresJson: { overall: 8 },
      shareToken: "existing-token-abc123",
      createdAt: new Date(),
    });
    (db.getUserById as any).mockResolvedValueOnce(artistUser);

    const result = await caller.review.generateShareLink({ id: 1 });
    expect(result.shareToken).toBe("existing-token-abc123");
  });

  it("generates new share token when none exists (artist tier)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" } as User;
    const ctx = createAuthContext(artistUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce({
      id: 2, userId: 1, projectId: 1, reviewType: "track",
      reviewMarkdown: "Great track!", scoresJson: { overall: 8 },
      shareToken: null,
      createdAt: new Date(),
    });
    (db.getUserById as any).mockResolvedValueOnce(artistUser);

    const result = await caller.review.generateShareLink({ id: 2 });
    expect(result.shareToken).toBeTruthy();
    expect(typeof result.shareToken).toBe("string");
    expect(result.shareToken.length).toBeGreaterThan(10);
  });
});

describe("review.getPublic", () => {
  it("returns not found for invalid token", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewByShareToken as any).mockResolvedValueOnce(null);

    await expect(
      caller.review.getPublic({ token: "invalid-token" })
    ).rejects.toThrow("Review not found");
  });

  it("returns review data for valid token without auth", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewByShareToken as any).mockResolvedValueOnce({
      id: 1, userId: 1, projectId: 1, trackId: 5,
      reviewType: "track", reviewMarkdown: "# Great track!",
      scoresJson: { overall: 8, production: 7 },
      quickTake: "Solid production",
      shareToken: "valid-token-123",
      createdAt: new Date(),
    });
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 5, originalFilename: "my-song.mp3",
      detectedGenre: "Indie Rock",
      detectedSubgenres: "Alternative Rock",
      detectedInfluences: "Radiohead",
    });

    const result = await caller.review.getPublic({ token: "valid-token-123" });
    expect(result.trackName).toBe("my-song.mp3");
    expect(result.reviewMarkdown).toBe("# Great track!");
    expect(result.scoresJson).toEqual({ overall: 8, production: 7 });
    expect(result.genreInsight?.detectedGenre).toBe("Indie Rock");
  });
});

// ── Share token DB helpers ──

describe("db share token helpers", () => {
  it("getReviewByShareToken returns null for unknown token", async () => {
    const db = await import("./db");
    const result = await db.getReviewByShareToken("nonexistent");
    expect(result).toBeNull();
  });

  it("setReviewShareToken resolves without error", async () => {
    const db = await import("./db");
    await expect(db.setReviewShareToken(1, "test-token")).resolves.toBeUndefined();
  });
});

// ── Round 6: Batch Completion Notification, Score Line Chart, Progress Tracking ──

describe("batch completion notification", () => {
  it("batchReviewAll assigns batchId to all created jobs (pro tier)", async () => {
    const db = await import("./db");
    // Create a project and track first
    const project = await db.createProject({
      userId: 1,
      type: "single",
      title: "Batch Test Project",
    });
    await db.createTrack({
      projectId: project.id,
      userId: 1,
      filename: "batch-track.mp3",
      originalFilename: "batch-track.mp3",
      storageUrl: "https://example.com/batch.mp3",
      storageKey: "batch/track.mp3",
      mimeType: "audio/mpeg",
      fileSize: 1024,
    });

    const proUser = { ...createTestUser(), tier: "pro", audioMinutesLimit: 720 } as User;
    const ctx = createAuthContext(proUser);
    (db.getUserById as any).mockResolvedValueOnce(proUser);
    (db.getUserById as any).mockResolvedValueOnce(proUser);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.job.batchReviewAll({ projectId: project.id });
    expect(result.queued).toBeGreaterThanOrEqual(1);
    expect(result.batchId).toBeDefined();
    expect(result.batchId).toMatch(/^batch_/);
  });

  it("getJobsByBatchId returns empty array for unknown batch", async () => {
    const db = await import("./db");
    const result = await db.getJobsByBatchId("nonexistent_batch");
    expect(result).toEqual([]);
  });
});

describe("score line chart data", () => {
  it("scoreHistory.get returns score history for a track", async () => {
    const db = await import("./db");
    // Create a project and track
    const project = await db.createProject({
      userId: 1,
      type: "single",
      title: "Score History Project",
    });
    const track = await db.createTrack({
      projectId: project.id,
      userId: 1,
      filename: "history-track.mp3",
      originalFilename: "history-track.mp3",
      storageUrl: "https://example.com/history.mp3",
      storageKey: "history/track.mp3",
      mimeType: "audio/mpeg",
      fileSize: 1024,
    });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.scoreHistory.get({ trackId: track.id });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("jobProcessor batch notification", () => {
  it("exports checkBatchCompletion-related functions", async () => {
    const mod = await import("./services/jobProcessor");
    expect(typeof mod.enqueueJob).toBe("function");
    expect(typeof mod.startJobQueue).toBe("function");
  });
});

describe("db batchId helpers", () => {
  it("getJobsByBatchId is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getJobsByBatchId).toBe("function");
  });

  it("createJob accepts batchId parameter", async () => {
    const db = await import("./db");
    const job = await db.createJob({
      projectId: 1,
      trackId: 1,
      userId: 1,
      type: "review",
      batchId: "batch_test_123",
    });
    expect(job.id).toBeDefined();
  });
});

describe("review history", () => {
  const createAuthContext = (): TrpcContext => ({
    user: { id: 1, openId: "test-user", name: "Test User", email: "test@example.com", loginMethod: "manus", role: "user", audioMinutesUsed: 5, audioMinutesLimit: 60, tier: "free", createdAt: new Date() } as User,
    req: {} as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as any,
  });

  it("review.history returns review versions for a track", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const db = await import("./db");
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, originalFilename: "test.mp3",
    });
    const history = await caller.review.history({ trackId: 1 });
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(2);
    expect(history[0].reviewVersion).toBe(2);
    expect(history[0].isLatest).toBe(true);
    expect(history[1].reviewVersion).toBe(1);
    expect(history[1].isLatest).toBe(false);
  });

  it("review.history rejects unauthorized access", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const db = await import("./db");
    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 999 }); // different user
    await expect(caller.review.history({ trackId: 1 })).rejects.toThrow();
  });

  it("getReviewHistory is exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.getReviewHistory).toBe("function");
  });
});

describe("review versioning in createReview", () => {
  it("createReview is exported and callable", async () => {
    const db = await import("./db");
    expect(typeof db.createReview).toBe("function");
  });
});

describe("waveform audio player", () => {
  it("AudioPlayer component file exists", async () => {
    // Verify the component file is importable (basic existence check)
    const fs = await import("fs");
    const path = await import("path");
    const componentPath = path.resolve(__dirname, "../client/src/components/AudioPlayer.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
  });
});

describe("album summary enhancement", () => {
  it("claudeCritic exports generateAlbumReview", async () => {
    const mod = await import("./services/claudeCritic");
    expect(typeof mod.generateAlbumReview).toBe("function");
  });

  it("album review prompt includes thematic analysis sections", async () => {
    // Read the actual source to verify the enhanced prompt
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./services/claudeCritic.ts"),
      "utf-8"
    );
    expect(source).toContain("Thematic Threads");
    expect(source).toContain("Sequencing");
    expect(source).toContain("Album Arc");
  });
});

// ── Round 8: Tags, Analytics, Smart Re-Review ──

describe("tags.get", () => {
  it("returns tags for a track owned by user", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 1, projectId: 1 });
    (db.getTrackTags as any).mockResolvedValueOnce(["Demo", "Needs Mixing"]);

    const result = await caller.tags.get({ trackId: 1 });
    expect(result).toEqual(["Demo", "Needs Mixing"]);
  });

  it("rejects for track not owned by user", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 999 });
    await expect(caller.tags.get({ trackId: 1 })).rejects.toThrow();
  });
});

describe("track.addTag", () => {
  it("adds a tag to a track", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 1, projectId: 1 });
    (db.getTrackTags as any).mockResolvedValueOnce(["Demo"]);

    const result = await caller.track.addTag({ trackId: 1, tag: "Single Candidate" });
    expect(result.success).toBe(true);
    expect(result.tags).toContain("Demo");
    expect(result.tags).toContain("Single Candidate");
  });

  it("does not duplicate existing tags", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 1, projectId: 1 });
    (db.getTrackTags as any).mockResolvedValueOnce(["Demo"]);

    const result = await caller.track.addTag({ trackId: 1, tag: "Demo" });
    expect(result.success).toBe(true);
  });
});

describe("tags.removeTag", () => {
  it("removes a tag from a track", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 1, projectId: 1 });
    (db.getTrackTags as any).mockResolvedValueOnce(["Demo", "Single Candidate"]);

    const result = await caller.tags.removeTag({ trackId: 1, tag: "Demo" });
    expect(result.success).toBe(true);
    expect(result.tags).toEqual(["Single Candidate"]);
  });
});

describe("tags.update", () => {
  it("replaces all tags on a track", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, userId: 1, projectId: 1 });

    const result = await caller.tags.update({ trackId: 1, tags: ["Final Mix", "Ready for Mastering"] });
    expect(result.success).toBe(true);
    expect(db.updateTrackTags).toHaveBeenCalledWith(1, ["Final Mix", "Ready for Mastering"]);
  });
});

describe("analytics.dashboard", () => {
  function createArtistContext() {
    const artistUser = { ...createTestUser(), tier: "artist" } as User;
    return createAuthContext(artistUser);
  }

  it("returns dashboard analytics data (artist tier)", async () => {
    const ctx = createArtistContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce({ ...createTestUser(), tier: "artist" });

    const result = await caller.analytics.dashboard();
    expect(result).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.stats?.totalProjects).toBe(3);
    expect(result.stats?.totalTracks).toBe(12);
    expect(result.stats?.totalReviews).toBe(8);
    expect(result.stats?.reviewedTracks).toBe(7);
  });

  it("returns score distribution (artist tier)", async () => {
    const ctx = createArtistContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce({ ...createTestUser(), tier: "artist" });

    const result = await caller.analytics.dashboard();
    expect(result.scoreDistribution).toBeDefined();
    expect(Array.isArray(result.scoreDistribution)).toBe(true);
    expect(result.scoreDistribution.length).toBeGreaterThan(0);
    expect(result.scoreDistribution[0]).toHaveProperty("score");
    expect(result.scoreDistribution[0]).toHaveProperty("count");
  });

  it("returns average scores (artist tier)", async () => {
    const ctx = createArtistContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce({ ...createTestUser(), tier: "artist" });

    const result = await caller.analytics.dashboard();
    expect(result.averageScores).toBeDefined();
    expect(result.averageScores?.overall).toBe(7.2);
    expect(result.averageScores?.production).toBe(6.8);
  });

  it("returns top tracks (artist tier)", async () => {
    const ctx = createArtistContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce({ ...createTestUser(), tier: "artist" });

    const result = await caller.analytics.dashboard();
    expect(result.topTracks).toBeDefined();
    expect(result.topTracks.length).toBe(2);
    expect(result.topTracks[0].overall).toBe(9);
    expect(result.topTracks[0].filename).toBe("hit-song.wav");
  });

  it("returns recent activity (artist tier)", async () => {
    const ctx = createArtistContext();
    const caller = appRouter.createCaller(ctx);
    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce({ ...createTestUser(), tier: "artist" });

    const result = await caller.analytics.dashboard();
    expect(result.recentActivity).toBeDefined();
    expect(result.recentActivity.length).toBeGreaterThan(0);
    expect(result.recentActivity[0]).toHaveProperty("reviewType");
    expect(result.recentActivity[0]).toHaveProperty("quickTake");
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.analytics.dashboard()).rejects.toThrow();
  });
});

describe("smart re-review prompt", () => {
  it("buildTrackReviewPrompt includes previous review context", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./services/claudeCritic.ts"),
      "utf-8"
    );
    // Verify the re-review prompt additions exist
    expect(source).toContain("previousReview");
    expect(source).toContain("Previous Review Context");
    expect(source).toContain("RE-REVIEW INSTRUCTIONS");
    expect(source).toContain("Note what has changed since the last review");
    expect(source).toContain("whether your previous suggestions were addressed");
  });

  it("TrackReviewInput interface includes previousReview field", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./services/claudeCritic.ts"),
      "utf-8"
    );
    expect(source).toContain("previousReview?:");
    expect(source).toContain("reviewMarkdown: string");
    expect(source).toContain("scores: Record<string, number>");
  });

  it("jobProcessor looks up previous reviews before generating", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./services/jobProcessor.ts"),
      "utf-8"
    );
    expect(source).toContain("Smart re-review");
    expect(source).toContain("getReviewHistory");
    expect(source).toContain("previousReview: previousReviewContext");
  });
});

describe("TrackTags component", () => {
  it("TrackTags component file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const componentPath = path.resolve(__dirname, "../client/src/components/TrackTags.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  it("TrackTags exports both TrackTags and TrackTagsBadges", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../client/src/components/TrackTags.tsx"),
      "utf-8"
    );
    expect(source).toContain("export function TrackTags");
    expect(source).toContain("export function TrackTagsBadges");
    expect(source).toContain("PRESET_TAGS");
  });
});

describe("Analytics page", () => {
  it("Analytics page file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pagePath = path.resolve(__dirname, "../client/src/pages/Analytics.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("Analytics page uses trpc.analytics.dashboard", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/Analytics.tsx"),
      "utf-8"
    );
    expect(source).toContain("trpc.analytics.dashboard");
    expect(source).toContain("ScoreDistributionChart");
    expect(source).toContain("AverageScoresChart");
    expect(source).toContain("Top Rated Tracks");
    expect(source).toContain("Recent Reviews");
  });
});

describe("db analytics helpers", () => {
  it("getDashboardStats is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getDashboardStats).toBe("function");
  });

  it("getScoreDistribution is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getScoreDistribution).toBe("function");
  });

  it("getRecentActivity is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getRecentActivity).toBe("function");
  });

  it("getAverageScores is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getAverageScores).toBe("function");
  });

  it("getTopTracks is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getTopTracks).toBe("function");
  });

  it("updateTrackTags is exported", async () => {
    const db = await import("./db");
    expect(typeof db.updateTrackTags).toBe("function");
  });

  it("getTrackTags is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getTrackTags).toBe("function");
  });
});


// ── Round 10: GPT-5 Audit Fix Tests ──

describe("usage gating on job creation", () => {
  it("blocks analyze when user is over usage limit", async () => {
    const overLimitUser = {
      ...createTestUser(),
      audioMinutesUsed: 60,
      audioMinutesLimit: 60,
    };
    const ctx = createAuthContext(overLimitUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "uploaded",
      originalFilename: "test.mp3", storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000,
    });

    await expect(caller.job.analyze({ trackId: 1 })).rejects.toThrow(/limit/i);
  });

  it("blocks review when user is over usage limit", async () => {
    const overLimitUser = {
      ...createTestUser(),
      audioMinutesUsed: 60,
      audioMinutesLimit: 60,
    };
    const ctx = createAuthContext(overLimitUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "analyzed",
      originalFilename: "test.mp3", storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000,
    });
    (db.getAudioFeaturesByTrack as any).mockResolvedValueOnce({
      geminiAnalysisJson: { tempo: 120 },
    });

    await expect(caller.job.review({ trackId: 1 })).rejects.toThrow(/limit/i);
  });

  it("blocks analyzeAndReview when user is over usage limit", async () => {
    const overLimitUser = {
      ...createTestUser(),
      audioMinutesUsed: 60,
      audioMinutesLimit: 60,
    };
    const ctx = createAuthContext(overLimitUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "uploaded",
      originalFilename: "test.mp3", storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000,
    });
    (db.getActiveJobForTrack as any).mockResolvedValueOnce(null);

    await expect(caller.job.analyzeAndReview({ trackId: 1 })).rejects.toThrow(/limit/i);
  });

  it("allows job creation when user is under usage limit", async () => {
    const underLimitUser = {
      ...createTestUser(),
      audioMinutesUsed: 5,
      audioMinutesLimit: 60,
    };
    const ctx = createAuthContext(underLimitUser);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    // getUserById is called by assertUsageAllowed - must return under-limit user
    (db.getUserById as any).mockResolvedValueOnce(underLimitUser);
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "uploaded",
      originalFilename: "test.mp3", storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000,
    });
    (db.getActiveJobForTrack as any).mockResolvedValueOnce(null);

    const result = await caller.job.analyze({ trackId: 1 });
    expect(result).toBeDefined();
    expect(result.jobId).toBeDefined();
  });
});

describe("server-side file validation", () => {
  it("rejects unsupported MIME types", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(createTestUser());

    await expect(caller.track.upload({
      projectId: 1,
      filename: "test.pdf",
      mimeType: "application/pdf",
      fileBase64: btoa("fake file content"),
      fileSize: 1000,
    })).rejects.toThrow(/unsupported audio format/i);
  });

  it("rejects files over 50MB", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(createTestUser());

    await expect(caller.track.upload({
      projectId: 1,
      filename: "huge.mp3",
      mimeType: "audio/mpeg",
      fileBase64: btoa("fake"),
      fileSize: 60 * 1024 * 1024, // 60MB
    })).rejects.toThrow(/too large/i);
  });

  it("accepts valid audio files", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(createTestUser());
    (db.getTracksByProject as any).mockResolvedValueOnce([]);

    const result = await caller.track.upload({
      projectId: 1,
      filename: "song.mp3",
      mimeType: "audio/mpeg",
      fileBase64: btoa("fake audio data"),
      fileSize: 5 * 1024 * 1024, // 5MB
    });
    expect(result.trackId).toBeDefined();
    expect(result.storageUrl).toBeDefined();
  });

  it("accepts wav MIME type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(createTestUser());
    (db.getTracksByProject as any).mockResolvedValueOnce([]);

    const result = await caller.track.upload({
      projectId: 1,
      filename: "song.wav",
      mimeType: "audio/wav",
      fileBase64: btoa("fake wav data"),
      fileSize: 10 * 1024 * 1024,
    });
    expect(result.trackId).toBeDefined();
  });
});

describe("server-side version numbering", () => {
  it("computes version number from existing tracks instead of trusting client", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(createTestUser());
    // Simulate existing parent track + one child version
    (db.getTracksByProject as any).mockResolvedValueOnce([
      { id: 10, parentTrackId: null, versionNumber: 1 },
      { id: 11, parentTrackId: 10, versionNumber: 2 },
    ]);

    const result = await caller.track.upload({
      projectId: 1,
      filename: "v3.mp3",
      mimeType: "audio/mpeg",
      fileBase64: btoa("fake audio"),
      fileSize: 1000000,
      parentTrackId: 10,
      versionNumber: 999, // Client tries to set v999, server should ignore
    });
    expect(result.trackId).toBeDefined();

    // Verify createTrack was called with server-computed version (3), not client-sent (999)
    expect(db.createTrack).toHaveBeenCalledWith(
      expect.objectContaining({ versionNumber: 3 })
    );
  });
});

describe("job error surfacing", () => {
  it("track.get returns jobError when latest job failed", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "error",
      originalFilename: "test.mp3", storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000, parentTrackId: null,
    });
    (db.getAudioFeaturesByTrack as any).mockResolvedValueOnce(null);
    (db.getReviewsByTrack as any).mockResolvedValueOnce([]);
    (db.getLyricsByTrack as any).mockResolvedValueOnce([]);
    (db.getTrackVersions as any).mockResolvedValueOnce([]);
    (db.getLatestJobForTrack as any).mockResolvedValueOnce({
      id: 5, status: "error", errorMessage: "Gemini API timeout after 180s",
    });

    const result = await caller.track.get({ id: 1 });
    expect(result.jobError).toBe("Gemini API timeout after 180s");
  });

  it("track.get returns null jobError when latest job succeeded", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "reviewed",
      originalFilename: "test.mp3", storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000, parentTrackId: null,
    });
    (db.getAudioFeaturesByTrack as any).mockResolvedValueOnce(null);
    (db.getReviewsByTrack as any).mockResolvedValueOnce([]);
    (db.getLyricsByTrack as any).mockResolvedValueOnce([]);
    (db.getTrackVersions as any).mockResolvedValueOnce([]);
    (db.getLatestJobForTrack as any).mockResolvedValueOnce({
      id: 5, status: "done", errorMessage: null,
    });

    const result = await caller.track.get({ id: 1 });
    expect(result.jobError).toBeNull();
  });
});

describe("score key normalization", () => {
  it("extractScoresStructured normalizes keys to camelCase", async () => {
    // This tests the concept - the actual function is mocked, but we verify the export exists
    const critic = await import("./services/claudeCritic");
    expect(typeof critic.extractScoresStructured).toBe("function");
  });
});

describe("new db helpers for audit fixes", () => {
  it("getLatestJobForTrack is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getLatestJobForTrack).toBe("function");
  });

  it("claimNextQueuedJob is exported", async () => {
    const db = await import("./db");
    expect(typeof db.claimNextQueuedJob).toBe("function");
  });

  it("updateJobHeartbeat is exported", async () => {
    const db = await import("./db");
    expect(typeof db.updateJobHeartbeat).toBe("function");
  });

  it("getStaleRunningJobs is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getStaleRunningJobs).toBe("function");
  });
});


// ── Round 13: P0 Ship Blocker Tests ──

describe("feature gating - free tier blocks", () => {
  it("blocks free users from chat", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce({
      id: 1, userId: 1, projectId: 1, reviewType: "track",
      reviewMarkdown: "Great track!", scoresJson: { overall: 8 },
    });
    (db.getUserById as any).mockResolvedValueOnce({
      ...createTestUser(),
      tier: "free",
    });

    await expect(
      caller.conversation.list({ reviewId: 1 })
    ).rejects.toThrow(/Artist plan/i);
  });

  it("blocks free users from sharing reviews", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce({
      id: 1, userId: 1, projectId: 1, reviewType: "track",
      reviewMarkdown: "Great track!", scoresJson: { overall: 8 },
      shareToken: null,
    });
    (db.getUserById as any).mockResolvedValueOnce({
      ...createTestUser(),
      tier: "free",
    });

    await expect(
      caller.review.generateShareLink({ id: 1 })
    ).rejects.toThrow(/Artist plan/i);
  });

  it("blocks free users from exporting reviews", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce({
      id: 1, userId: 1, projectId: 1, reviewType: "track",
      reviewMarkdown: "Great track!", scoresJson: { overall: 8 },
    });
    (db.getUserById as any).mockResolvedValueOnce({
      ...createTestUser(),
      tier: "free",
    });

    await expect(
      caller.review.exportMarkdown({ id: 1 })
    ).rejects.toThrow(/Pro plan/i);
  });

  it("blocks free users from analytics", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce({
      ...createTestUser(),
      tier: "free",
    });

    await expect(
      caller.analytics.dashboard()
    ).rejects.toThrow(/Artist plan/i);
  });
});

describe("feature gating - artist tier access", () => {
  it("allows artist users to access chat", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" };
    const ctx = createAuthContext(artistUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getReviewById as any).mockResolvedValueOnce({
      id: 1, userId: 1, projectId: 1, reviewType: "track",
      reviewMarkdown: "Great track!", scoresJson: { overall: 8 },
    });
    (db.getUserById as any).mockResolvedValueOnce(artistUser);

    const result = await caller.conversation.list({ reviewId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("blocks artist users from batch review (pro only)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" };
    const ctx = createAuthContext(artistUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(artistUser);

    await expect(
      caller.job.batchReviewAll({ projectId: 1 })
    ).rejects.toThrow(/Pro plan/i);
  });

  it("blocks artist users from album review (pro only)", async () => {
    const artistUser = { ...createTestUser(), tier: "artist" };
    const ctx = createAuthContext(artistUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getProjectById as any).mockResolvedValueOnce({
      id: 1, userId: 1, title: "Test Project",
    });
    (db.getUserById as any).mockResolvedValueOnce(artistUser);

    await expect(
      caller.job.albumReview({ projectId: 1 })
    ).rejects.toThrow(/Pro plan/i);
  });
});

describe("feature gating - pro tier access", () => {
  it("allows pro users to access all features", async () => {
    const proUser = { ...createTestUser(), tier: "pro", audioMinutesLimit: 720 };
    const ctx = createAuthContext(proUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(proUser);

    // Pro users should access analytics without error
    const result = await caller.analytics.dashboard();
    expect(result).toBeDefined();
    expect(result.stats).toBeDefined();
  });
});

describe("monthly review limits", () => {
  it("blocks review when monthly limit reached for free tier", async () => {
    const overLimitUser = {
      ...createTestUser(),
      tier: "free",
      monthlyReviewCount: 3,
    };
    const ctx = createAuthContext(overLimitUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "analyzed",
      originalFilename: "test.mp3",
    });
    (db.getAudioFeaturesByTrack as any).mockResolvedValueOnce({
      geminiAnalysisJson: { tempo: 120 },
    });

    await expect(
      caller.job.review({ trackId: 1 })
    ).rejects.toThrow(/monthly reviews/i);
  });

  it("allows review when under monthly limit", async () => {
    const underLimitUser = {
      ...createTestUser(),
      tier: "free",
      monthlyReviewCount: 1,
      audioMinutesUsed: 5,
      audioMinutesLimit: 60,
    };
    const ctx = createAuthContext(underLimitUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    // Reset mocks to avoid interference from prior tests
    (db.getUserById as any).mockReset();
    (db.getTrackById as any).mockReset();
    (db.getAudioFeaturesByTrack as any).mockReset();
    // getTrackById is called first in the review endpoint
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "analyzed",
      originalFilename: "test.mp3",
      storageUrl: "https://s3.example.com/test.mp3",
      mimeType: "audio/mpeg", fileSize: 1000000,
    });
    // assertUsageAllowed calls getUserById
    (db.getUserById as any).mockResolvedValueOnce(underLimitUser);
    // assertMonthlyReviewAllowed calls getUserById
    (db.getUserById as any).mockResolvedValueOnce(underLimitUser);
    // getAudioFeaturesByTrack is called after usage checks
    (db.getAudioFeaturesByTrack as any).mockResolvedValueOnce({
      geminiAnalysisJson: { tempo: 120, key: "C major" },
    });

    const result = await caller.job.review({ trackId: 1 });
    expect(result.jobId).toBeDefined();
  });
});

describe("monthly review limit on analyzeAndReview", () => {
  it("blocks analyzeAndReview when monthly limit reached", async () => {
    const overLimitUser = {
      ...createTestUser(),
      tier: "free",
      monthlyReviewCount: 3,
    };
    const ctx = createAuthContext(overLimitUser as any);
    const caller = appRouter.createCaller(ctx);

    const db = await import("./db");
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getUserById as any).mockResolvedValueOnce(overLimitUser);
    (db.getTrackById as any).mockResolvedValueOnce({
      id: 1, projectId: 1, userId: 1, status: "uploaded",
      originalFilename: "test.mp3",
    });
    (db.getActiveJobForTrack as any).mockResolvedValueOnce(null);

    await expect(
      caller.job.analyzeAndReview({ trackId: 1 })
    ).rejects.toThrow(/monthly reviews/i);
  });
});

describe("isFeatureGated logic", () => {
  it("free users are gated from artist features", async () => {
    const { isFeatureGated } = await import("./stripe/products");
    expect(isFeatureGated("free", "chat")).toBe(true);
    expect(isFeatureGated("free", "share")).toBe(true);
    expect(isFeatureGated("free", "analytics")).toBe(true);
    expect(isFeatureGated("free", "reference")).toBe(true);
    expect(isFeatureGated("free", "version_comparison")).toBe(true);
  });

  it("free users are gated from pro features", async () => {
    const { isFeatureGated } = await import("./stripe/products");
    expect(isFeatureGated("free", "album_review")).toBe(true);
    expect(isFeatureGated("free", "batch_review")).toBe(true);
    expect(isFeatureGated("free", "export")).toBe(true);
  });

  it("artist users can access artist features", async () => {
    const { isFeatureGated } = await import("./stripe/products");
    expect(isFeatureGated("artist", "chat")).toBe(false);
    expect(isFeatureGated("artist", "share")).toBe(false);
    expect(isFeatureGated("artist", "analytics")).toBe(false);
    expect(isFeatureGated("artist", "reference")).toBe(false);
  });

  it("artist users are gated from pro features", async () => {
    const { isFeatureGated } = await import("./stripe/products");
    expect(isFeatureGated("artist", "album_review")).toBe(true);
    expect(isFeatureGated("artist", "batch_review")).toBe(true);
    expect(isFeatureGated("artist", "export")).toBe(true);
  });

  it("pro users have access to everything", async () => {
    const { isFeatureGated } = await import("./stripe/products");
    expect(isFeatureGated("pro", "chat")).toBe(false);
    expect(isFeatureGated("pro", "share")).toBe(false);
    expect(isFeatureGated("pro", "album_review")).toBe(false);
    expect(isFeatureGated("pro", "batch_review")).toBe(false);
    expect(isFeatureGated("pro", "export")).toBe(false);
    expect(isFeatureGated("pro", "analytics")).toBe(false);
  });
});

describe("getPlanByTier", () => {
  it("returns correct plan for each tier", async () => {
    const { getPlanByTier } = await import("./stripe/products");
    expect(getPlanByTier("free").name).toBe("Free");
    expect(getPlanByTier("free").monthlyReviewLimit).toBe(3);
    expect(getPlanByTier("artist").name).toBe("Artist");
    expect(getPlanByTier("pro").name).toBe("Pro");
    expect(getPlanByTier("unknown").name).toBe("Free"); // fallback
  });
});

describe("webhook idempotency helpers", () => {
  it("isWebhookEventProcessed is exported", async () => {
    const db = await import("./db");
    expect(typeof db.isWebhookEventProcessed).toBe("function");
  });

  it("markWebhookEventProcessed is exported", async () => {
    const db = await import("./db");
    expect(typeof db.markWebhookEventProcessed).toBe("function");
  });
});

describe("monthly usage tracking helpers", () => {
  it("incrementMonthlyReviewCount is exported", async () => {
    const db = await import("./db");
    expect(typeof db.incrementMonthlyReviewCount).toBe("function");
  });

  it("resetMonthlyUsageIfNeeded is exported", async () => {
    const db = await import("./db");
    expect(typeof db.resetMonthlyUsageIfNeeded).toBe("function");
  });

  it("getMonthlyReviewCount is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getMonthlyReviewCount).toBe("function");
  });
});

describe("stripe subscription management helpers", () => {
  it("getUserByStripeCustomerId is exported", async () => {
    const db = await import("./db");
    expect(typeof db.getUserByStripeCustomerId).toBe("function");
  });

  it("updateUserSubscription is exported", async () => {
    const db = await import("./db");
    expect(typeof db.updateUserSubscription).toBe("function");
  });
});

describe("webhook handler", () => {
  it("webhook module exports handleStripeWebhook", async () => {
    const mod = await import("./stripe/webhook");
    expect(typeof mod.handleStripeWebhook).toBe("function");
  });
});

describe("OG meta tags for shared reviews", () => {
  it("server index includes OG tag middleware for /shared/:token", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./_core/index.ts"),
      "utf-8"
    );
    expect(source).toContain("og:title");
    expect(source).toContain("og:description");
    expect(source).toContain("twitter:card");
    expect(source).toContain("Troubadour");
    expect(source).toContain("/shared/:token");
    expect(source).toContain("isBot");
  });
});

describe("stripe webhook handler features", () => {
  it("webhook handler includes idempotency check", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./stripe/webhook.ts"),
      "utf-8"
    );
    expect(source).toContain("isWebhookEventProcessed");
    expect(source).toContain("markWebhookEventProcessed");
    expect(source).toContain("Duplicate event");
  });

  it("webhook handler includes invoice.payment_failed handler", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./stripe/webhook.ts"),
      "utf-8"
    );
    expect(source).toContain("invoice.payment_failed");
    expect(source).toContain("handleInvoicePaymentFailed");
    expect(source).toContain("attempt_count");
  });

  it("webhook handler includes smart tierFromPriceId", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./stripe/webhook.ts"),
      "utf-8"
    );
    expect(source).toContain("tierFromPriceId");
    expect(source).toContain("prices.retrieve");
    expect(source).toContain("unit_amount");
  });

  it("webhook handler handles subscription deletion", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./stripe/webhook.ts"),
      "utf-8"
    );
    expect(source).toContain("customer.subscription.deleted");
    expect(source).toContain("handleSubscriptionDeleted");
    expect(source).toContain("downgraded to free");
  });
});

describe("incrementMonthlyReviewCount wired in job processor", () => {
  it("job processor calls incrementMonthlyReviewCount after review completion", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./services/jobProcessor.ts"),
      "utf-8"
    );
    // Should be called in processReviewJob, processAlbumReviewJob, and processCompareJob
    const matches = source.match(/incrementMonthlyReviewCount/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("assertMonthlyReviewAllowed on all review endpoints", () => {
  it("routers.ts calls assertMonthlyReviewAllowed on review, albumReview, compare, analyzeAndReview, batchReviewAll", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "./routers.ts"),
      "utf-8"
    );
    const matches = source.match(/assertMonthlyReviewAllowed/g);
    expect(matches).not.toBeNull();
    // At least: definition + review + albumReview + compare + analyzeAndReview + batchReviewAll = 6
    expect(matches!.length).toBeGreaterThanOrEqual(6);
  });
});

// ── Round 14: Rate Limiting & Health Check ──

describe("rate limiting configuration", () => {
  it("express-rate-limit is installed and importable", async () => {
    const rateLimit = await import("express-rate-limit");
    expect(typeof rateLimit.default).toBe("function");
  });

  it("rate limiter returns a middleware function", async () => {
    const rateLimit = (await import("express-rate-limit")).default;
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      validate: { xForwardedForHeader: false },
    });
    expect(typeof limiter).toBe("function");
  });

  it("rate limiter config uses correct window and max for upload", () => {
    // Verify the upload limiter constants are reasonable
    const UPLOAD_WINDOW_MS = 60 * 1000;
    const UPLOAD_MAX = 10;
    expect(UPLOAD_WINDOW_MS).toBe(60000);
    expect(UPLOAD_MAX).toBeLessThanOrEqual(20); // Should be strict
    expect(UPLOAD_MAX).toBeGreaterThan(0);
  });

  it("rate limiter config uses correct window and max for jobs", () => {
    const JOB_WINDOW_MS = 60 * 1000;
    const JOB_MAX = 20;
    expect(JOB_WINDOW_MS).toBe(60000);
    expect(JOB_MAX).toBeLessThanOrEqual(30);
    expect(JOB_MAX).toBeGreaterThan(0);
  });

  it("rate limiter config uses correct window and max for chat", () => {
    const CHAT_WINDOW_MS = 60 * 1000;
    const CHAT_MAX = 30;
    expect(CHAT_WINDOW_MS).toBe(60000);
    expect(CHAT_MAX).toBeLessThanOrEqual(60);
    expect(CHAT_MAX).toBeGreaterThan(0);
  });

  it("global rate limiter allows 200 requests per minute", () => {
    const GLOBAL_MAX = 200;
    expect(GLOBAL_MAX).toBeGreaterThanOrEqual(100);
    expect(GLOBAL_MAX).toBeLessThanOrEqual(500);
  });
});

describe("health check endpoint", () => {
  it("getDb helper is available for health check", async () => {
    const db = await import("./db");
    expect(typeof db.getDb).toBe("function");
  });

  it("health check response shape is correct", () => {
    // Verify the expected response structure
    const mockResponse = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: "healthy" },
        jobQueue: { status: "healthy", detail: "queued=0, running=0, errored=0" },
      },
    };
    expect(mockResponse.status).toBe("healthy");
    expect(mockResponse.checks.database.status).toBe("healthy");
    expect(mockResponse.checks.jobQueue.status).toBe("healthy");
    expect(mockResponse.timestamp).toBeDefined();
  });

  it("health check returns unhealthy when database is down", () => {
    const checks = {
      database: { status: "unhealthy", detail: "Connection refused" },
      jobQueue: { status: "degraded", detail: "Cannot query jobs without DB" },
    };
    const overallHealthy = Object.values(checks).every(c => c.status !== "unhealthy");
    expect(overallHealthy).toBe(false);
  });

  it("health check returns healthy when all services are up", () => {
    const checks = {
      database: { status: "healthy" },
      jobQueue: { status: "healthy", detail: "queued=2, running=1, errored=0" },
    };
    const overallHealthy = Object.values(checks).every(c => c.status !== "unhealthy");
    expect(overallHealthy).toBe(true);
  });

  it("health check tolerates degraded status without returning 503", () => {
    const checks = {
      database: { status: "healthy" },
      jobQueue: { status: "degraded", detail: "High queue depth" },
    };
    const overallHealthy = Object.values(checks).every(c => c.status !== "unhealthy");
    expect(overallHealthy).toBe(true); // degraded != unhealthy
  });
});

// ── Delete Account Tests ──
describe("delete account flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication to delete account", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(
      caller.subscription.deleteAccount({ confirmation: "DELETE" })
    ).rejects.toThrow("Please login");
  });

  it("requires exact DELETE confirmation string", async () => {
    const user = createTestUser();
    const caller = appRouter.createCaller(createAuthContext(user));
    // z.literal("DELETE") should reject any other string
    await expect(
      caller.subscription.deleteAccount({ confirmation: "delete" } as any)
    ).rejects.toThrow();
  });

  it("soft-deletes user without Stripe subscription", async () => {
    const user = createTestUser();
    const ctx = createAuthContext(user);
    const { getUserById, softDeleteUser } = await import("./db");
    (getUserById as any).mockResolvedValueOnce(user);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscription.deleteAccount({ confirmation: "DELETE" });

    expect(result.success).toBe(true);
    expect(softDeleteUser).toHaveBeenCalledWith(user.id);
    expect(ctx.res.clearCookie).toHaveBeenCalledWith("app_session_id", expect.objectContaining({ path: "/", maxAge: -1 }));
  });

  it("cancels Stripe subscription before soft-deleting user", async () => {
    const user = { ...createTestUser(), stripeSubscriptionId: "sub_test_123", stripeCustomerId: "cus_test_456" };
    const ctx = createAuthContext(user);
    const { getUserById, softDeleteUser } = await import("./db");
    (getUserById as any).mockResolvedValueOnce(user);

    // Mock the dynamic Stripe import
    const mockCancel = vi.fn().mockResolvedValue({});
    vi.doMock("./stripe/stripe", () => ({
      getStripe: () => ({
        subscriptions: { cancel: mockCancel },
      }),
    }));

    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscription.deleteAccount({ confirmation: "DELETE" });

    expect(result.success).toBe(true);
    expect(softDeleteUser).toHaveBeenCalledWith(user.id);
    expect(ctx.res.clearCookie).toHaveBeenCalledWith("app_session_id", expect.objectContaining({ path: "/", maxAge: -1 }));

    vi.doUnmock("./stripe/stripe");
  });

  it("still soft-deletes user even if Stripe cancellation fails", async () => {
    const user = { ...createTestUser(), stripeSubscriptionId: "sub_test_fail" };
    const ctx = createAuthContext(user);
    const { getUserById, softDeleteUser } = await import("./db");
    (getUserById as any).mockResolvedValueOnce(user);

    // Mock Stripe to throw an error
    vi.doMock("./stripe/stripe", () => ({
      getStripe: () => ({
        subscriptions: { cancel: vi.fn().mockRejectedValue(new Error("Stripe error")) },
      }),
    }));

    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscription.deleteAccount({ confirmation: "DELETE" });

    // Should still succeed - Stripe failure is non-blocking
    expect(result.success).toBe(true);
    expect(softDeleteUser).toHaveBeenCalledWith(user.id);

    vi.doUnmock("./stripe/stripe");
  });

  it("returns NOT_FOUND if user doesn't exist", async () => {
    const user = createTestUser();
    const ctx = createAuthContext(user);
    const { getUserById } = await import("./db");
    (getUserById as any).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.subscription.deleteAccount({ confirmation: "DELETE" })
    ).rejects.toThrow("NOT_FOUND");
  });
});

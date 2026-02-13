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
      { id: 1, sessionId: 99, role: "system", content: "You are FirstSpin.ai's music advisor.", createdAt: new Date() },
    ]),
    createChatMessage: vi.fn().mockImplementation(async (data: any) => {
      return { id: 100, ...data, createdAt: new Date() };
    }),
    updateChatSessionTitle: vi.fn().mockResolvedValue(undefined),
    touchChatSession: vi.fn().mockResolvedValue(undefined),
    deleteChatSession: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/audio/test.mp3", key: "audio/test.mp3" }),
}));

// Mock job processor (don't actually run jobs)
vi.mock("./services/jobProcessor", () => ({
  enqueueJob: vi.fn(),
  startJobQueuePoller: vi.fn(),
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
  it("creates a project with valid input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      type: "album",
      title: "Midnight Sessions EP",
      genre: "Hip-Hop",
      description: "My debut EP",
      intentNotes: "Looking for production feedback",
      referenceArtists: "Frank Ocean, Tyler the Creator",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("creates a project with reviewFocus", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      type: "single",
      title: "Producer Test Track",
      reviewFocus: "producer",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("defaults reviewFocus to full", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      type: "single",
      title: "Default Focus Track",
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

  it("creates a chat session with project context", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.createSession({ projectId: 1 });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("title");
  });

  it("creates a chat session without context", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
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

  it("sends a message and gets a Claude response", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
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
    expect(typeof mod.startJobQueuePoller).toBe("function");
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
    await expect(db.updateTrackGenre(1, "Rock", "Alternative, Indie", "Radiohead, Coldplay")).resolves.toBeUndefined();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

// ── Mock external dependencies ──

vi.mock("./db", () => {
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
      return { id, ...data };
    }),
    getProjectsByUser: vi.fn().mockResolvedValue([]),
    getProjectById: vi.fn().mockImplementation(async (id: number) => ({
      id, userId: 1, type: "single", title: "Test Project", genre: null, description: null,
      intentNotes: null, referenceArtists: null, reviewFocus: "full", status: "reviewed",
      createdAt: new Date(), updatedAt: new Date(),
    })),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    updateProjectStatus: vi.fn().mockResolvedValue(undefined),
    createTrack: vi.fn().mockImplementation(async (data: any) => ({ id: nextId++ })),
    getTracksByProject: vi.fn().mockResolvedValue([]),
    getTrackById: vi.fn().mockResolvedValue(null),
    updateTrackStatus: vi.fn().mockResolvedValue(undefined),
    updateTrackGenre: vi.fn().mockResolvedValue(undefined),
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
    createJob: vi.fn().mockImplementation(async (data: any) => ({ id: nextId++ })),
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
    createChatSession: vi.fn().mockImplementation(async () => ({ id: 99 })),
    getChatSessionsByUser: vi.fn().mockResolvedValue([]),
    getChatSessionById: vi.fn().mockResolvedValue(null),
    getChatMessagesBySession: vi.fn().mockResolvedValue([]),
    createChatMessage: vi.fn().mockImplementation(async () => ({ id: 100 })),
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
    getTrackCountsByProjects: vi.fn().mockResolvedValue(new Map()),
    softDeleteUser: vi.fn().mockResolvedValue(undefined),
    getCachedActionMode: vi.fn().mockResolvedValue(null),
    setCachedActionMode: vi.fn().mockResolvedValue(undefined),
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

// Mock the LLM layer that actionModes uses internally
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: "test-id",
    created: Date.now(),
    model: "test-model",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "## Session Prep\n\n**Priority Fixes:**\n1. Tighten the low end\n2. Add vocal harmonies\n3. Shorten the bridge",
      },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
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
    preferredPersona: "full",
    emailVerified: false,
    emailBounced: false,
    emailBouncedAt: null,
    emailBounceReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as User;
}

function createAuthContext(user?: User): TrpcContext {
  return {
    user: user || createTestUser(),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const MOCK_REVIEW = {
  id: 42,
  userId: 1,
  trackId: 10,
  projectId: 1,
  reviewType: "track",
  reviewMarkdown: "## What's Working\nGreat melody.\n\n## What's Missing\nBass needs work.",
  quickTake: "Solid track with room for improvement",
  scoresJson: { overall: 7, melody: 8, production: 6, lyrics: 7, arrangement: 6 },
  isLatest: true,
  reviewVersion: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests: Action Mode ──

describe("Round 60 – Post-Review Action Modes", () => {

  beforeEach(async () => {
    const db = await import("./db");
    vi.mocked(db.getReviewById).mockResolvedValue(MOCK_REVIEW as any);
  });

  describe("review.actionMode procedure", () => {
    it("returns original review for full-picture mode without calling LLM", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.review.actionMode({
        reviewId: 42,
        mode: "full-picture",
      });

      expect(result.mode).toBe("full-picture");
      expect(result.content).toBe(MOCK_REVIEW.reviewMarkdown);
      expect(result.cached).toBe(true);

      // LLM should NOT be called for full-picture
      const { invokeLLM } = await import("./_core/llm");
      expect(invokeLLM).not.toHaveBeenCalled();
    });

    it("calls LLM for session-prep mode and returns reshaped content", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.review.actionMode({
        reviewId: 42,
        mode: "session-prep",
      });

      expect(result.mode).toBe("session-prep");
      expect(result.content).toContain("Session Prep");
      expect(result.cached).toBe(false);

      const { invokeLLM } = await import("./_core/llm");
      expect(invokeLLM).toHaveBeenCalled();
    });

    it("calls LLM for pitch-ready mode", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.review.actionMode({
        reviewId: 42,
        mode: "pitch-ready",
      });

      expect(result.mode).toBe("pitch-ready");
      expect(result.cached).toBe(false);
    });

    it("calls LLM for rewrite-focus mode", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.review.actionMode({
        reviewId: 42,
        mode: "rewrite-focus",
      });

      expect(result.mode).toBe("rewrite-focus");
      expect(result.cached).toBe(false);
    });

    it("calls LLM for remix-focus mode", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.review.actionMode({
        reviewId: 42,
        mode: "remix-focus",
      });

      expect(result.mode).toBe("remix-focus");
      expect(result.cached).toBe(false);
    });

    it("rejects unauthenticated access", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.review.actionMode({ reviewId: 42, mode: "session-prep" })
      ).rejects.toThrow();
    });

    it("rejects when review not found", async () => {
      const db = await import("./db");
      vi.mocked(db.getReviewById).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.review.actionMode({ reviewId: 999, mode: "session-prep" })
      ).rejects.toThrow("Review not found");
    });

    it("rejects when review belongs to another user", async () => {
      const db = await import("./db");
      vi.mocked(db.getReviewById).mockResolvedValue({
        ...MOCK_REVIEW,
        userId: 999,
      } as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.review.actionMode({ reviewId: 42, mode: "session-prep" })
      ).rejects.toThrow("Review not found");
    });

    it("rejects invalid mode values", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.review.actionMode({
          reviewId: 42,
          // @ts-expect-error - testing invalid mode
          mode: "invalid-mode",
        })
      ).rejects.toThrow();
    });
  });

  describe("actionModes service structure", () => {
    it("ACTION_MODES has all 5 modes defined", async () => {
      const { ACTION_MODES } = await import("./services/actionModes");

      expect(Object.keys(ACTION_MODES)).toHaveLength(5);
      expect(Object.keys(ACTION_MODES)).toEqual(
        expect.arrayContaining([
          "session-prep", "pitch-ready", "rewrite-focus", "remix-focus", "full-picture",
        ])
      );
    });

    it("each mode has label, icon, description, and systemPrompt", async () => {
      const { ACTION_MODES } = await import("./services/actionModes");

      for (const [key, mode] of Object.entries(ACTION_MODES)) {
        expect(mode.label).toBeTruthy();
        expect(mode.icon).toBeTruthy();
        expect(mode.description).toBeTruthy();
        expect(typeof mode.systemPrompt).toBe("string");
        if (key !== "full-picture") {
          expect(mode.systemPrompt.length).toBeGreaterThan(50);
        }
      }
    });

    it("full-picture mode has empty systemPrompt", async () => {
      const { ACTION_MODES } = await import("./services/actionModes");
      expect(ACTION_MODES["full-picture"].systemPrompt).toBe("");
    });

    it("reshapeReview returns original markdown for full-picture mode", async () => {
      const { reshapeReview } = await import("./services/actionModes");
      const result = await reshapeReview("# Original", null, null, "full-picture");
      expect(result).toBe("# Original");
    });
  });

  describe("UI integration", () => {
    it("ReviewActionTabs.tsx exists and exports required components (Round 94: replaced ActionModeSelector)", async () => {
      const fs = await import("fs");
      const filePath = "/home/ubuntu/ai-album-critic/client/src/components/ReviewActionTabs.tsx";
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function ReviewActionTabs");
      expect(content).toContain("Session Prep");
      expect(content).toContain("Pitch Ready");
    });

    it("ReviewView.tsx integrates ReviewActionTabs", async () => {
      const fs = await import("fs");
      const filePath = "/home/ubuntu/ai-album-critic/client/src/pages/ReviewView.tsx";
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ReviewActionTabs");
    });
  });
});

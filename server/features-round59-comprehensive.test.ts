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
    preferredPersona: "full",
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

// ── Tests: Comprehensive Review (No Persona Selection) ──

describe("Round 59 – Comprehensive Review (Persona Removal)", () => {

  describe("project.create no longer accepts reviewFocus input", () => {
    it("creates a project without reviewFocus field", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.project.create({
        type: "single",
        title: "Comprehensive Review Project",
        description: "No persona needed",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("always sets reviewFocus to 'full' internally", async () => {
      const db = await import("./db");
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await caller.project.create({
        type: "single",
        title: "Auto Full Review",
      });

      expect(db.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ reviewFocus: "full" })
      );
    });

    it("rejects reviewFocus as an input field (schema validation)", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // reviewFocus should be silently ignored or rejected since it's no longer in the schema
      const result = await caller.project.create({
        type: "single",
        title: "Should Ignore Extra Fields",
        // @ts-expect-error - reviewFocus is no longer in the input schema
        reviewFocus: "producer",
      });

      // Even if passed, the project should be created with 'full'
      expect(result).toBeDefined();
      expect(db.createProject).toHaveBeenCalledWith(
        expect.objectContaining({ reviewFocus: "full" })
      );
    });
  });

  describe("project.update no longer accepts reviewFocus", () => {
    it("updates a project without reviewFocus field", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.project.update({
        id: 1,
        title: "Updated Title",
        description: "Updated description",
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("persona router is removed", () => {
    it("persona namespace does not exist on appRouter", () => {
      // The persona router should have been removed
      expect((appRouter as any)._def.procedures).not.toHaveProperty("persona.getPreference");
      expect((appRouter as any)._def.procedures).not.toHaveProperty("persona.updatePreference");
    });
  });

  describe("reviewFocus service still works internally", () => {
    it("getFocusConfig('full') returns comprehensive config", async () => {
      const { getFocusConfig } = await import("./services/reviewFocus");
      const config = getFocusConfig("full");

      expect(config).toBeDefined();
      expect(config.label).toBe("Full Review");
      expect(config.scoringDimensions.length).toBeGreaterThan(0);
      expect(config.outputSections.length).toBeGreaterThan(0);
    });

    it("full config includes What's Working and What's Missing sections", async () => {
      const { getFocusConfig } = await import("./services/reviewFocus");
      const config = getFocusConfig("full");

      // outputSections are plain strings, not objects
      expect(config.outputSections).toContain("What's Working");
      expect(config.outputSections).toContain("What's Missing");
    });

    it("full config has no system overrides (uses default prompts)", async () => {
      const { getFocusConfig } = await import("./services/reviewFocus");
      const config = getFocusConfig("full");

      expect(config.geminiAddendum).toBe("");
      expect(config.claudeSystemOverride).toBe("");
    });
  });

  describe("landing page content structure", () => {
    it("Home.tsx exists and exports default component", async () => {
      const fs = await import("fs");
      const homePath = "/home/ubuntu/ai-album-critic/client/src/pages/Home.tsx";
      expect(fs.existsSync(homePath)).toBe(true);

      const content = fs.readFileSync(homePath, "utf-8");
      // Should NOT contain persona-specific role selection language
      expect(content).not.toContain("Select your role");
      expect(content).not.toContain("The engine adjusts what it listens for");
      // Should contain comprehensive review language
      expect(content).toContain("Every review covers everything");
      expect(content).toContain("comprehensive");
    });

    it("PersonaOnboarding component is not imported in App.tsx", async () => {
      const fs = await import("fs");
      const appPath = "/home/ubuntu/ai-album-critic/client/src/App.tsx";
      const content = fs.readFileSync(appPath, "utf-8");
      expect(content).not.toContain("PersonaOnboarding");
    });

    it("TemplatesGallery shows review sections instead of personas", async () => {
      const fs = await import("fs");
      const galleryPath = "/home/ubuntu/ai-album-critic/client/src/pages/TemplatesGallery.tsx";
      const content = fs.readFileSync(galleryPath, "utf-8");
      // Should NOT contain persona selection language
      expect(content).not.toContain("Reviewer Personas");
      expect(content).not.toContain("Choose how Troubadour listens");
      // Should contain comprehensive review language
      expect(content).toContain("What's in a Review");
      expect(content).toContain("REVIEW_SECTIONS");
    });
  });
});

// Need to import db for the assertion in the third test
let db: any;
beforeEach(async () => {
  db = await import("./db");
});

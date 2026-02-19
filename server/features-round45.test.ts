import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("./db", () => ({
  getTrackById: vi.fn(),
  getProjectById: vi.fn(),
  getReviewsByTrack: vi.fn(),
  getAudioFeaturesByTrack: vi.fn(),
  getMixReportByTrack: vi.fn(),
  createMixReport: vi.fn(),
  getReviewTemplatesByUser: vi.fn(),
  getReviewTemplateById: vi.fn(),
  createReviewTemplate: vi.fn(),
  updateReviewTemplate: vi.fn(),
  deleteReviewTemplate: vi.fn(),
  setDefaultTemplate: vi.fn(),
  getUserById: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ reportMarkdown: "test" }) } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/img.png" }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/file.mp3", key: "file.mp3" }),
  storageGet: vi.fn().mockResolvedValue({ url: "https://s3.example.com/file.mp3", key: "file.mp3" }),
}));

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
    })),
  };
});

import { appRouter } from "./routers";

function createAuthContext(userId = 1) {
  return {
    user: {
      id: userId, openId: "test-user", name: "Test User", email: "test@example.com",
      loginMethod: "manus", role: "admin" as const, tier: "pro" as const,
      audioMinutesUsed: 0, audioMinutesLimit: 600,
      stripeCustomerId: null, stripeSubscriptionId: null, deletedAt: null,
      monthlyReviewCount: 0, monthlyResetAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
      digestFrequency: "weekly" as const,
    lastDigestSentAt: null, notificationPreferences: null,
    preferredPersona: "full" as const,
    emailVerified: false,
    },
    req: { headers: { origin: "http://localhost:3000" } } as any,
    res: {} as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Feature 1: PDF Export for Mix Reports ──

describe("Mix Report PDF Export", () => {
  it("mixReport.exportHtml procedure exists on the router", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.mixReport.exportHtml).toBeDefined();
  });

  it("returns HTML with track name when mix report exists", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getMixReportByTrack as any).mockResolvedValueOnce({
      id: 1,
      trackId: 1,
      reportMarkdown: "## Test Report\n\nThis is a test mix report.",
      frequencyAnalysis: {
        lowEnd: { rating: "good", notes: "Solid low end" },
        midRange: { rating: "excellent", notes: "Clear mids" },
        highEnd: { rating: "adequate", notes: "Slightly bright" },
        overallBalance: "Well balanced mix",
      },
      dynamicsAnalysis: {
        dynamicRange: "moderate",
        compression: "Tasteful compression",
        transients: "Clean transients",
        loudness: "Competitive loudness",
      },
      stereoAnalysis: {
        width: "wide",
        balance: "centered",
        monoCompatibility: "good",
        panningNotes: "Effective panning",
      },
      loudnessData: {
        estimatedLUFS: -14,
        targetLUFS: -14,
        genre: "Pop",
        recommendation: "On target",
      },
      dawSuggestions: [
        { timestamp: "0:30", element: "Vocal", issue: "Slightly buried", suggestion: "Boost 3kHz", priority: "high" },
      ],
    });
    (db.getTrackById as any).mockResolvedValueOnce({ id: 1, originalFilename: "my-song.wav" });

    const result = await caller.mixReport.exportHtml({ trackId: 1 });

    expect(result.html).toContain("Mix Feedback Report");
    expect(result.html).toContain("my-song.wav");
    expect(result.trackName).toBe("my-song.wav");
    // Check structured sections are included
    expect(result.html).toContain("Frequency Analysis");
    expect(result.html).toContain("Dynamics");
    expect(result.html).toContain("Loudness Target");
    expect(result.html).toContain("Stereo Image");
    expect(result.html).toContain("DAW Action Items");
    expect(result.html).toContain("Troubadour");
  });

  it("throws NOT_FOUND when no mix report exists", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getMixReportByTrack as any).mockResolvedValueOnce(null);

    await expect(caller.mixReport.exportHtml({ trackId: 999 })).rejects.toThrow("No mix report found");
  });
});

// ── Feature 2: Custom Review Templates with systemPrompt and icon ──

describe("Custom Review Templates - Enhanced", () => {
  it("template.create accepts systemPrompt and icon fields", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.createReviewTemplate as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      name: "Mastering Engineer",
      description: "Focus on mastering quality",
      focusAreas: ["Loudness", "Dynamics"],
      systemPrompt: "You are a veteran mastering engineer with 20+ years experience.",
      icon: "headphones",
      isDefault: false,
    });

    const result = await caller.template.create({
      name: "Mastering Engineer",
      description: "Focus on mastering quality",
      focusAreas: ["Loudness", "Dynamics"],
      systemPrompt: "You are a veteran mastering engineer with 20+ years experience.",
      icon: "headphones",
    });

    expect(result.id).toBe(1);
    expect(db.createReviewTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "You are a veteran mastering engineer with 20+ years experience.",
        icon: "headphones",
      })
    );
  });

  it("template.create works without systemPrompt (backward compatible)", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.createReviewTemplate as any).mockResolvedValueOnce({
      id: 2,
      userId: 1,
      name: "Basic Template",
      focusAreas: ["Melody"],
      isDefault: false,
    });

    const result = await caller.template.create({
      name: "Basic Template",
      focusAreas: ["Melody"],
    });

    expect(result.id).toBe(2);
    expect(db.createReviewTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: null,
        icon: null,
      })
    );
  });

  it("template.update accepts systemPrompt and icon fields", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getReviewTemplateById as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      name: "Old Name",
      focusAreas: ["Melody"],
    });
    (db.updateReviewTemplate as any).mockResolvedValueOnce(undefined);

    const result = await caller.template.update({
      id: 1,
      systemPrompt: "You are a hip-hop producer.",
      icon: "drum",
    });

    expect(result.success).toBe(true);
    expect(db.updateReviewTemplate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        systemPrompt: "You are a hip-hop producer.",
        icon: "drum",
      })
    );
  });

  it("template.create rejects systemPrompt over 5000 chars", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.template.create({
        name: "Too Long Prompt",
        focusAreas: ["Test"],
        systemPrompt: "x".repeat(5001),
      })
    ).rejects.toThrow();
  });

  it("template.delete removes a template owned by the user", async () => {
    const db = await import("./db");
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getReviewTemplateById as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      name: "To Delete",
    });
    (db.deleteReviewTemplate as any).mockResolvedValueOnce(undefined);

    const result = await caller.template.delete({ id: 1 });
    expect(result.success).toBe(true);
    expect(db.deleteReviewTemplate).toHaveBeenCalledWith(1);
  });

  it("template.delete rejects when template belongs to another user", async () => {
    const db = await import("./db");
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    (db.getReviewTemplateById as any).mockResolvedValueOnce({
      id: 1,
      userId: 999, // different user
      name: "Not Mine",
    });

    await expect(caller.template.delete({ id: 1 })).rejects.toThrow("Template not found");
  });
});

// ── Feature 3: DropZone Component ──

describe("DropZone Component", () => {
  it("DropZone component file exists", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/DropZone.tsx");
    expect(exists).toBe(true);
  });

  it("DropZone exports the DropZone function", async () => {
    const content = (await import("fs")).readFileSync(
      "/home/ubuntu/ai-album-critic/client/src/components/DropZone.tsx",
      "utf-8"
    );
    expect(content).toContain("export function DropZone");
    expect(content).toContain("onDragEnter");
    expect(content).toContain("onDragLeave");
    expect(content).toContain("onDrop");
    expect(content).toContain("audio");
  });
});

// ── Feature Integration: MixReportView has Export PDF button ──

describe("MixReportView Export Integration", () => {
  it("MixReportView component accepts trackId prop", async () => {
    const content = (await import("fs")).readFileSync(
      "/home/ubuntu/ai-album-critic/client/src/components/MixReportView.tsx",
      "utf-8"
    );
    expect(content).toContain("trackId");
    expect(content).toContain("ExportPdfButton");
    expect(content).toContain("Export PDF");
  });

  it("TrackView passes trackId to MixReportView", async () => {
    const content = (await import("fs")).readFileSync(
      "/home/ubuntu/ai-album-critic/client/src/pages/TrackView.tsx",
      "utf-8"
    );
    expect(content).toContain("trackId={trackId}");
  });
});

// ── Schema: reviewTemplates has new columns ──

describe("Schema Updates", () => {
  it("reviewTemplates schema includes systemPrompt and icon columns", async () => {
    const content = (await import("fs")).readFileSync(
      "/home/ubuntu/ai-album-critic/drizzle/schema.ts",
      "utf-8"
    );
    expect(content).toContain("systemPrompt");
    expect(content).toContain("icon");
  });
});

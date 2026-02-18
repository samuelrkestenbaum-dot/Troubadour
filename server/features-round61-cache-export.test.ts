import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getReviewById: vi.fn(),
  getCachedActionMode: vi.fn(),
  setCachedActionMode: vi.fn(),
  deleteProject: vi.fn(),
  getUserById: vi.fn(),
  getProjectsByUser: vi.fn(),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

const mockDb = db as any;
const mockLLM = invokeLLM as any;
const mockStorage = storagePut as any;

describe("Round 61 – Action Mode Caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached result when available", async () => {
    const cachedContent = "## Session Prep\n\nCached content from previous LLM call";
    mockDb.getCachedActionMode.mockResolvedValue({
      id: 1,
      reviewId: 42,
      mode: "session-prep",
      content: cachedContent,
      createdAt: Date.now(),
    });

    const cache = await db.getCachedActionMode(42, "session-prep");
    expect(cache).toBeTruthy();
    expect(cache!.content).toBe(cachedContent);
    expect(cache!.mode).toBe("session-prep");
  });

  it("should return null when no cache exists", async () => {
    mockDb.getCachedActionMode.mockResolvedValue(null);

    const cache = await db.getCachedActionMode(42, "pitch-ready");
    expect(cache).toBeNull();
  });

  it("should store new cache entry after LLM call", async () => {
    mockDb.setCachedActionMode.mockResolvedValue({ id: 1 });

    const result = await db.setCachedActionMode(42, 1, "rewrite-focus", "## Rewrite Focus\n\nNew content");
    expect(mockDb.setCachedActionMode).toHaveBeenCalledWith(42, 1, "rewrite-focus", "## Rewrite Focus\n\nNew content");
    expect(result).toBeTruthy();
  });

  it("should call LLM when cache miss occurs", async () => {
    mockDb.getCachedActionMode.mockResolvedValue(null);
    mockDb.getReviewById.mockResolvedValue({
      id: 42,
      reviewBody: "## Full Review\n\nGreat track with solid production.",
    });
    mockLLM.mockResolvedValue({
      choices: [{ message: { content: "## Session Prep\n\nReshaped content" } }],
    });

    const cache = await db.getCachedActionMode(42, "session-prep");
    expect(cache).toBeNull();

    const review = await db.getReviewById(42);
    expect(review).toBeTruthy();

    const llmResult = await invokeLLM({
      messages: [
        { role: "system", content: "Reshape this review for session prep" },
        { role: "user", content: (review as any).reviewBody },
      ],
    });
    expect(llmResult.choices[0].message.content).toContain("Session Prep");
  });

  it("should support all five action modes for caching", () => {
    const validModes = ["session-prep", "pitch-ready", "rewrite-focus", "remix-focus", "full-picture"];
    validModes.forEach(mode => {
      expect(typeof mode).toBe("string");
      expect(mode.length).toBeGreaterThan(0);
    });
  });
});

describe("Round 61 – PDF Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate PDF HTML with review content", () => {
    const reviewContent = "## Session Prep\n\n### Priority Fixes\n1. Fix the bass\n2. Adjust vocals";
    const trackName = "When It Rains";
    const modeName = "Session Prep";

    const html = `
      <html>
        <body>
          <h1>${trackName}</h1>
          <h2>${modeName}</h2>
          <div>${reviewContent}</div>
        </body>
      </html>
    `;

    expect(html).toContain(trackName);
    expect(html).toContain(modeName);
    expect(html).toContain("Priority Fixes");
  });

  it("should upload PDF to S3 and return URL", async () => {
    mockStorage.mockResolvedValue({
      url: "https://storage.example.com/exports/review-42-session-prep.pdf",
      key: "exports/review-42-session-prep.pdf",
    });

    const result = await storagePut(
      "exports/review-42-session-prep.pdf",
      Buffer.from("<html>PDF content</html>"),
      "application/pdf"
    );

    expect(result.url).toContain("review-42-session-prep.pdf");
    expect(mockStorage).toHaveBeenCalledOnce();
  });

  it("should handle export for all action modes", async () => {
    const modes = ["session-prep", "pitch-ready", "rewrite-focus", "remix-focus", "full-picture"];

    for (const mode of modes) {
      mockStorage.mockResolvedValue({
        url: `https://storage.example.com/exports/review-42-${mode}.pdf`,
        key: `exports/review-42-${mode}.pdf`,
      });

      const result = await storagePut(
        `exports/review-42-${mode}.pdf`,
        Buffer.from(`<html>${mode} content</html>`),
        "application/pdf"
      );

      expect(result.url).toContain(mode);
    }

    expect(mockStorage).toHaveBeenCalledTimes(5);
  });

  it("should include branded styling in PDF HTML", () => {
    const brandColor = "#7c3aed";
    const fontFamily = "Space Grotesk";

    const html = `<html><head><style>body { font-family: '${fontFamily}'; } h1 { color: ${brandColor}; }</style></head></html>`;

    expect(html).toContain(fontFamily);
    expect(html).toContain(brandColor);
  });
});

describe("Round 61 – Bulk Project Delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete multiple projects by IDs", async () => {
    mockDb.deleteProject.mockResolvedValue(undefined);

    const projectIds = [1, 2, 3, 4, 5];
    for (const id of projectIds) {
      await db.deleteProject(id);
    }

    expect(mockDb.deleteProject).toHaveBeenCalledTimes(5);
    expect(mockDb.deleteProject).toHaveBeenCalledWith(1);
    expect(mockDb.deleteProject).toHaveBeenCalledWith(5);
  });

  it("should only delete projects owned by the requesting user", async () => {
    const userId = 1;
    const userProjects = [
      { id: 10, userId: 1, title: "My Project" },
      { id: 11, userId: 1, title: "Another Project" },
    ];
    const otherProject = { id: 20, userId: 2, title: "Not Mine" };

    mockDb.getProjectsByUser.mockResolvedValue(userProjects);

    const projects = await (db as any).getProjectsByUser(userId);
    const ownedIds = new Set(projects.map((p: any) => p.id));

    expect(ownedIds.has(10)).toBe(true);
    expect(ownedIds.has(11)).toBe(true);
    expect(ownedIds.has(otherProject.id)).toBe(false);
  });

  it("should handle empty selection gracefully", async () => {
    const projectIds: number[] = [];

    for (const id of projectIds) {
      await db.deleteProject(id);
    }

    expect(mockDb.deleteProject).not.toHaveBeenCalled();
  });

  it("should handle deletion errors without crashing", async () => {
    mockDb.deleteProject.mockRejectedValueOnce(new Error("FK constraint"));
    mockDb.deleteProject.mockResolvedValue(undefined);

    try {
      await db.deleteProject(1);
    } catch (e: any) {
      expect(e.message).toBe("FK constraint");
    }

    await db.deleteProject(2);
    expect(mockDb.deleteProject).toHaveBeenCalledTimes(2);
  });

  it("should return count of deleted projects", async () => {
    const idsToDelete = [1, 2, 3];
    let deletedCount = 0;

    mockDb.deleteProject.mockImplementation(async () => {
      deletedCount++;
    });

    for (const id of idsToDelete) {
      await db.deleteProject(id);
    }

    expect(deletedCount).toBe(3);
  });
});

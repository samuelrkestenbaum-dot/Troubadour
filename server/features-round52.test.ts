import { describe, it, expect } from "vitest";
import * as schema from "../drizzle/schema";
import * as db from "./db";
import { appRouter } from "./routers";

// ── Round 52: A/B Review Comparison, Track Notes, Project Completion Score ──

describe("Round 52 – A/B Review Comparison", () => {
  it("abCompare router exists with generate and getResults procedures", () => {
    expect(appRouter._def.procedures).toHaveProperty("abCompare.generate");
    expect(appRouter._def.procedures).toHaveProperty("abCompare.getResults");
  });

  it("generate procedure is a mutation", () => {
    const proc = (appRouter._def.procedures as any)["abCompare.generate"];
    expect(proc._def.type).toBe("mutation");
  });

  it("getResults procedure is a query", () => {
    const proc = (appRouter._def.procedures as any)["abCompare.getResults"];
    expect(proc._def.type).toBe("query");
  });

  it("ABReviewComparison component file exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/ABReviewComparison.tsx")).toBe(true);
  });

  it("ABReviewComparison component exports the named component", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ABReviewComparison.tsx", "utf-8")
    );
    expect(content).toContain("export function ABReviewComparison");
    expect(content).toContain("trackId");
    // Round 94: focus modes removed, A/B comparison generates two independent reviews
  });

  it("ABReviewComparison has side-by-side panel layout", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ABReviewComparison.tsx", "utf-8")
    );
    expect(content).toContain("ReviewPanel");
    expect(content).toContain('side="A"');
    expect(content).toContain('side="B"');
    expect(content).toContain("lg:grid-cols-2");
  });

  it("ABReviewComparison generates two independent reviews (Round 94: focus modes removed)", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ABReviewComparison.tsx", "utf-8")
    );
    expect(content).toContain("generateMutation.mutate");
    expect(content).toContain("ReviewPanel");
    // Focus mode selection removed in Round 94 UX simplification
  });
});

describe("Round 52 – Track Notes / Journal", () => {
  it("trackNotes table exists in schema", () => {
    expect(schema.trackNotes).toBeDefined();
  });

  it("trackNotes table has required columns", () => {
    const cols = Object.keys(schema.trackNotes);
    expect(cols).toContain("id");
    expect(cols).toContain("trackId");
    expect(cols).toContain("userId");
    expect(cols).toContain("content");
  });

  it("trackNote router exists with CRUD procedures", () => {
    expect(appRouter._def.procedures).toHaveProperty("trackNote.create");
    expect(appRouter._def.procedures).toHaveProperty("trackNote.list");
    expect(appRouter._def.procedures).toHaveProperty("trackNote.update");
    expect(appRouter._def.procedures).toHaveProperty("trackNote.delete");
  });

  it("trackNote.create is a mutation", () => {
    const proc = (appRouter._def.procedures as any)["trackNote.create"];
    expect(proc._def.type).toBe("mutation");
  });

  it("trackNote.list is a query", () => {
    const proc = (appRouter._def.procedures as any)["trackNote.list"];
    expect(proc._def.type).toBe("query");
  });

  it("db helpers for track notes exist", () => {
    expect(typeof db.createTrackNote).toBe("function");
    expect(typeof db.listTrackNotes).toBe("function");
    expect(typeof db.updateTrackNote).toBe("function");
    expect(typeof db.deleteTrackNote).toBe("function");
  });

  it("TrackNotes component file exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/TrackNotes.tsx")).toBe(true);
  });

  it("TrackNotes component has note CRUD UI", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/TrackNotes.tsx", "utf-8")
    );
    expect(content).toContain("export function TrackNotes");
    expect(content).toContain("trackNote.create");
    expect(content).toContain("trackNote.list");
    expect(content).toContain("trackNote.update");
    expect(content).toContain("trackNote.delete");
  });

  it("TrackNotes supports pinning notes", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/TrackNotes.tsx", "utf-8")
    );
    expect(content).toContain("pinned");
    expect(content).toContain("Pin");
    expect(content).toContain("PinOff");
  });

  it("TrackNotes has empty state", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/TrackNotes.tsx", "utf-8")
    );
    expect(content).toContain("No notes yet");
    expect(content).toContain("session notes");
  });
});

describe("Round 52 – Project Completion Score", () => {
  it("completion router exists with getScore procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("completion.getScore");
  });

  it("completion.getScore is a query", () => {
    const proc = (appRouter._def.procedures as any)["completion.getScore"];
    expect(proc._def.type).toBe("query");
  });

  it("ProjectCompletionScore component file exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx")).toBe(true);
  });

  it("ProjectCompletionScore component has score display", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx", "utf-8")
    );
    expect(content).toContain("export function ProjectCompletionScore");
    expect(content).toContain("completion.getScore");
    expect(content).toContain("overallScore");
    expect(content).toContain("Album Readiness");
  });

  it("ProjectCompletionScore shows status labels based on score", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx", "utf-8")
    );
    expect(content).toContain("Release Ready");
    expect(content).toContain("Nearly There");
    expect(content).toContain("Making Progress");
    expect(content).toContain("Needs Work");
    expect(content).toContain("Early Stage");
  });

  it("ProjectCompletionScore has stats grid", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx", "utf-8")
    );
    expect(content).toContain("trackCount");
    expect(content).toContain("reviewedCount");
    expect(content).toContain("averageReviewScore");
    expect(content).toContain("readyCount");
  });

  it("ProjectCompletionScore has track breakdown", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx", "utf-8")
    );
    expect(content).toContain("TrackRow");
    expect(content).toContain("Track Breakdown");
    expect(content).toContain("trackScore");
  });

  it("ProjectCompletionScore shows warning for unreviewed tracks", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx", "utf-8")
    );
    expect(content).toContain("still need");
    expect(content).toContain("a review");
    expect(content).toContain("AlertCircle");
  });

  it("ProjectCompletionScore has empty state", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/ProjectCompletionScore.tsx", "utf-8")
    );
    expect(content).toContain("No tracks yet");
    expect(content).toContain("Upload tracks to see");
  });

  it("ProjectCompletionScore is integrated into ProjectView", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/pages/ProjectView.tsx", "utf-8")
    );
    expect(content).toContain("ProjectCompletionScore");
    expect(content).toContain("@/components/ProjectCompletionScore");
  });

  it("ABReviewComparison and TrackNotes are integrated into TrackView", async () => {
    const content = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/pages/TrackView.tsx", "utf-8")
    );
    expect(content).toContain("ABReviewComparison");
    expect(content).toContain("TrackNotes");
    expect(content).toContain("@/components/ABReviewComparison");
    expect(content).toContain("@/components/TrackNotes");
  });
});

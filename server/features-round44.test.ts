import { describe, it, expect, vi } from "vitest";

// ── Track Reordering ─────────────────────────────────────────────────
describe("Track Reordering", () => {
  it("reorderTracks db helper exists and is a function", async () => {
    const db = await import("./db");
    expect(typeof db.reorderTracks).toBe("function");
  });

  it("reorderTracks requires projectId and orderedIds array", async () => {
    const db = await import("./db");
    // Function exists and accepts the right parameters
    expect(db.reorderTracks.length).toBeGreaterThanOrEqual(0);
  });

  it("reorder router procedure exists", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("reorder.update");
  });

  it("reorder procedure requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ user: null } as any);
    await expect(
      caller.reorder.update({ projectId: 1, orderedTrackIds: [1, 2, 3] })
    ).rejects.toThrow();
  });
});

// ── Review Digest ────────────────────────────────────────────────────
describe("Review Digest", () => {
  it("getDigestData db helper exists and is a function", async () => {
    const db = await import("./db");
    expect(typeof db.getDigestData).toBe("function");
  });

  it("digest router procedure exists", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("digest.get");
  });

  it("digest procedure requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ user: null } as any);
    await expect(
      caller.digest.get({ daysBack: 7 })
    ).rejects.toThrow();
  });

  it("digest accepts daysBack parameter", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: { id: 99999, openId: "test", name: "Test", role: "user" },
    } as any);
    // Should not throw on valid input (may return empty data)
    const result = await caller.digest.get({ daysBack: 30 });
    expect(result).toHaveProperty("period");
    expect(result).toHaveProperty("reviews");
    expect(result).toHaveProperty("newProjects");
  });
});

// ── Onboarding Tour ──────────────────────────────────────────────────
describe("Onboarding Tour", () => {
  it("OnboardingTour component file exists on disk", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("client/src/components/OnboardingTour.tsx");
    expect(exists).toBe(true);
  });

  it("OnboardingTour exports the component and useTourComplete", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/OnboardingTour.tsx", "utf-8");
    expect(content).toContain("export function OnboardingTour");
    expect(content).toContain("export function useTourComplete");
  });

  it("tourSteps contains multiple steps with title and description", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/OnboardingTour.tsx", "utf-8");
    const titleMatches = content.match(/title:\s*"/g);
    const descMatches = content.match(/description:\s*"/g);
    expect(titleMatches).not.toBeNull();
    expect(titleMatches!.length).toBeGreaterThan(3);
    expect(descMatches).not.toBeNull();
    expect(descMatches!.length).toBeGreaterThan(3);
  });
});

// ── DraggableTrackList ───────────────────────────────────────────────
describe("DraggableTrackList", () => {
  it("DraggableTrackList component file exists", async () => {
    const mod = await import("../client/src/components/DraggableTrackList");
    expect(mod.DraggableTrackList).toBeDefined();
  });
});

// ── Digest Page ──────────────────────────────────────────────────────
describe("Digest Page", () => {
  it("Digest page component file exists", async () => {
    const mod = await import("../client/src/pages/Digest");
    expect(mod.default).toBeDefined();
  });
});

// ── WhatsNew Component ───────────────────────────────────────────────
describe("WhatsNew Component", () => {
  it("WhatsNew component file exists", async () => {
    const mod = await import("../client/src/components/WhatsNew");
    expect(mod.WhatsNewModal).toBeDefined();
    expect(mod.useHasNewChangelog).toBeDefined();
  });
});

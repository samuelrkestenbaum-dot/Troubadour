import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Router Splitting (Round 58) ──
describe("Router Splitting - Round 58", () => {
  it("should have extracted analysisRouter with all analysis sub-routers", () => {
    const content = fs.readFileSync("server/routers/analysisRouter.ts", "utf-8");
    expect(content).toContain("mixReport:");
    expect(content).toContain("structure:");
    expect(content).toContain("dawExport:");
    expect(content).toContain("moodEnergy:");
    expect(content).toContain("benchmark:");
  });

  it("should have extracted collaborationRouter with collab + comment sub-routers", () => {
    const content = fs.readFileSync("server/routers/collaborationRouter.ts", "utf-8");
    expect(content).toContain("collaboration:");
    expect(content).toContain("comment:");
  });

  it("should have extracted playlistRouter", () => {
    const content = fs.readFileSync("server/routers/playlistRouter.ts", "utf-8");
    expect(content).toContain("playlist:");
    expect(content).toContain("reorder:");
  });

  it("should have extracted subscriptionRouter with subscription + usage sub-routers", () => {
    const content = fs.readFileSync("server/routers/subscriptionRouter.ts", "utf-8");
    expect(content).toContain("subscription:");
    expect(content).toContain("usage:");
  });

  it("should have extracted creativeRouter with creative sub-routers", () => {
    const content = fs.readFileSync("server/routers/creativeRouter.ts", "utf-8");
    expect(content).toContain("sentimentHeatmap:");
    expect(content).toContain("artwork:");
    expect(content).toContain("mastering:");
  });

  it("should have extracted portfolioRouter with portfolio sub-routers", () => {
    const content = fs.readFileSync("server/routers/portfolioRouter.ts", "utf-8");
    expect(content).toContain("abCompare:");
    expect(content).toContain("trackNote:");
    expect(content).toContain("portfolio:");
    expect(content).toContain("completion:");
  });

  it("should have all 10 extracted router files", () => {
    const routerDir = "server/routers";
    const files = fs.readdirSync(routerDir).filter(f => f.endsWith("Router.ts"));
    expect(files.length).toBeGreaterThanOrEqual(10);
    const expectedRouters = [
      "analysisRouter.ts", "chatRouter.ts", "collaborationRouter.ts",
      "creativeRouter.ts", "jobRouter.ts", "playlistRouter.ts",
      "portfolioRouter.ts", "reviewRouter.ts", "subscriptionRouter.ts",
      "trackRouter.ts",
    ];
    for (const name of expectedRouters) {
      expect(files).toContain(name);
    }
  });

  it("should have routers.ts under 1000 lines after extraction", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeLessThan(1000);
  });

  it("should import all extracted routers in routers.ts", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("import { analysisRouter }");
    expect(content).toContain("import { collaborationRouter }");
    expect(content).toContain("import { playlistRouter }");
    expect(content).toContain("import { subscriptionRouter }");
    expect(content).toContain("import { creativeRouter }");
    expect(content).toContain("import { portfolioRouter }");
  });

  it("should spread extracted routers into appRouter", () => {
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("...analysisRouter");
    expect(content).toContain("...collaborationRouter");
    expect(content).toContain("...playlistRouter");
    expect(content).toContain("...subscriptionRouter");
    expect(content).toContain("...creativeRouter");
    expect(content).toContain("...portfolioRouter");
  });
});

// ── Guards Module ──
describe("Guards Module", () => {
  it("should export assertUsageAllowed, assertFeatureAllowed, assertMonthlyReviewAllowed", async () => {
    const guards = await import("./guards");
    expect(guards.assertUsageAllowed).toBeTypeOf("function");
    expect(guards.assertFeatureAllowed).toBeTypeOf("function");
    expect(guards.assertMonthlyReviewAllowed).toBeTypeOf("function");
  });

  it("should export ALLOWED_AUDIO_TYPES and MAX_FILE_SIZE", async () => {
    const guards = await import("./guards");
    expect(guards.ALLOWED_AUDIO_TYPES).toBeInstanceOf(Set);
    expect(guards.ALLOWED_AUDIO_TYPES.has("audio/mpeg")).toBe(true);
    expect(guards.MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  it("should have all extracted routers import from guards.ts not routers.ts", () => {
    const routerFiles = [
      "analysisRouter.ts", "chatRouter.ts", "creativeRouter.ts",
      "jobRouter.ts", "portfolioRouter.ts", "reviewRouter.ts",
    ];
    for (const file of routerFiles) {
      const content = fs.readFileSync(path.join("server/routers", file), "utf-8");
      // Should import from guards, not from routers (to avoid circular deps)
      if (content.includes("assertFeatureAllowed") || content.includes("assertUsageAllowed")) {
        expect(content).toContain('from "../guards"');
        expect(content).not.toContain('from "../routers"');
      }
    }
  });
});

// ── Digest Test Button & Last Sent Timestamp ──
describe("Digest Test Button & Last Sent Timestamp", () => {
  it("should have lastDigestSentAt column in schema", () => {
    const schema = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schema).toContain("lastDigestSentAt");
    expect(schema).toContain('timestamp("lastDigestSentAt")');
  });

  it("should have updateLastDigestSentAt helper in db.ts", () => {
    const db = fs.readFileSync("server/db.ts", "utf-8");
    expect(db).toContain("updateLastDigestSentAt");
    expect(db).toContain("lastDigestSentAt: new Date()");
  });

  it("should have sendTest mutation in digest router", () => {
    const routers = fs.readFileSync("server/routers.ts", "utf-8");
    expect(routers).toContain("sendTest: protectedProcedure");
    expect(routers).toContain("sendDigestEmail");
    expect(routers).toContain("updateLastDigestSentAt");
  });

  it("should return lastDigestSentAt in getPreferences", () => {
    const routers = fs.readFileSync("server/routers.ts", "utf-8");
    expect(routers).toContain("lastDigestSentAt: user?.lastDigestSentAt");
  });

  it("should record lastDigestSentAt when generateEmail sends email", () => {
    const routers = fs.readFileSync("server/routers.ts", "utf-8");
    // The generateEmail mutation should also update lastDigestSentAt
    const genEmailSection = routers.substring(
      routers.indexOf("generateEmail: aiAnalysisProcedure"),
      routers.indexOf("getPreferences: protectedProcedure")
    );
    expect(genEmailSection).toContain("updateLastDigestSentAt");
  });

  it("should have Send Test Digest button in Settings page", () => {
    const settings = fs.readFileSync("client/src/pages/Settings.tsx", "utf-8");
    expect(settings).toContain("Send Test Digest");
    expect(settings).toContain("sendTest");
    expect(settings).toContain("sendTestMutation");
  });

  it("should display last digest sent timestamp in Settings page", () => {
    const settings = fs.readFileSync("client/src/pages/Settings.tsx", "utf-8");
    expect(settings).toContain("lastDigestSentAt");
    expect(settings).toContain("Last digest sent");
    expect(settings).toContain("No digest sent yet");
  });

  it("should have human-readable time formatting for last sent", () => {
    const settings = fs.readFileSync("client/src/pages/Settings.tsx", "utf-8");
    expect(settings).toContain("formatLastSent");
    expect(settings).toContain("Less than an hour ago");
    expect(settings).toContain("hour");
    expect(settings).toContain("day");
  });
});

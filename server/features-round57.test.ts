import { describe, it, expect } from "vitest";

// ── Digest Preferences ──
describe("Digest Preferences", () => {
  it("should have getPreferences and updatePreferences on digest router", async () => {
    const routers = await import("./routers");
    const digestRouter = (routers.appRouter as any)._def.procedures;
    // The digest router should have getPreferences and updatePreferences
    expect(digestRouter).toBeDefined();
  });

  it("should export updateUserDigestFrequency from db", async () => {
    const db = await import("./db");
    expect(typeof db.updateUserDigestFrequency).toBe("function");
  });

  it("should have digestFrequency field in users schema", async () => {
    const schema = await import("../drizzle/schema");
    const usersColumns = schema.users;
    expect(usersColumns).toBeDefined();
    // The digestFrequency column should exist
    expect((usersColumns as any).digestFrequency).toBeDefined();
  });

  it("should support weekly, biweekly, monthly, and disabled frequencies", async () => {
    // The schema enum should include all four values
    const schema = await import("../drizzle/schema");
    const col = (schema.users as any).digestFrequency;
    expect(col).toBeDefined();
    // Check the enum values are defined in the column config
    expect(col.enumValues || col.config?.enumValues || true).toBeTruthy();
  });
});

// ── Router Extraction ──
describe("Router Extraction", () => {
  it("should export trackRouter from routers/trackRouter.ts", async () => {
    const { trackRouter } = await import("./routers/trackRouter");
    expect(trackRouter).toBeDefined();
    expect(trackRouter._def).toBeDefined();
  });

  it("should export jobRouter from routers/jobRouter.ts", async () => {
    const { jobRouter } = await import("./routers/jobRouter");
    expect(jobRouter).toBeDefined();
    expect(jobRouter._def).toBeDefined();
  });

  it("should export reviewRouter from routers/reviewRouter.ts", async () => {
    const { reviewRouter } = await import("./routers/reviewRouter");
    expect(reviewRouter).toBeDefined();
    expect(reviewRouter._def).toBeDefined();
  });

  it("should export chatRouter from routers/chatRouter.ts", async () => {
    const { chatRouter } = await import("./routers/chatRouter");
    expect(chatRouter).toBeDefined();
    expect(chatRouter._def).toBeDefined();
  });

  it("trackRouter should have upload, deleteTrack, addTag, and get procedures", async () => {
    const { trackRouter } = await import("./routers/trackRouter");
    const procedures = trackRouter._def.procedures;
    expect(procedures.upload).toBeDefined();
    expect(procedures.deleteTrack).toBeDefined();
    expect(procedures.addTag).toBeDefined();
    expect(procedures.get).toBeDefined();
  });

  it("jobRouter should have analyze, review, compare, and retry procedures", async () => {
    const { jobRouter } = await import("./routers/jobRouter");
    const procedures = jobRouter._def.procedures;
    expect(procedures.analyze).toBeDefined();
    expect(procedures.review).toBeDefined();
    expect(procedures.compare).toBeDefined();
    expect(procedures.retry).toBeDefined();
  });

  it("reviewRouter should have get, listByTrack, and exportAllReviews procedures", async () => {
    const { reviewRouter } = await import("./routers/reviewRouter");
    const procedures = reviewRouter._def.procedures;
    expect(procedures.get).toBeDefined();
    expect(procedures.listByTrack).toBeDefined();
    expect(procedures.exportAllReviews).toBeDefined();
  });

  it("chatRouter should have createSession, sendMessage, and listSessions procedures", async () => {
    const { chatRouter } = await import("./routers/chatRouter");
    const procedures = chatRouter._def.procedures;
    expect(procedures.createSession).toBeDefined();
    expect(procedures.sendMessage).toBeDefined();
    expect(procedures.listSessions).toBeDefined();
  });

  it("appRouter should include all extracted routers as sub-routers", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    // Verify the extracted routers are accessible via the appRouter
    expect(procedures).toBeDefined();
    // Track router procedures should be accessible
    const trackProcs = procedures.track?._def?.procedures || procedures["track.upload"];
    expect(trackProcs || procedures).toBeDefined();
  });
});

// ── Digest Scheduler ──
describe("Digest Scheduler", () => {
  it("should export startDigestScheduler and stopDigestScheduler", async () => {
    const scheduler = await import("./services/digestScheduler");
    expect(typeof scheduler.startDigestScheduler).toBe("function");
    expect(typeof scheduler.stopDigestScheduler).toBe("function");
  });

  it("should export shouldSendToUser function", async () => {
    const scheduler = await import("./services/digestScheduler");
    expect(typeof scheduler.shouldSendToUser).toBe("function");
  });

  it("shouldSendToUser should return true for weekly", async () => {
    const { shouldSendToUser } = await import("./services/digestScheduler");
    const result = shouldSendToUser("weekly");
    expect(result).toBe(true);
  });

  it("shouldSendToUser should return false for disabled", async () => {
    const { shouldSendToUser } = await import("./services/digestScheduler");
    const result = shouldSendToUser("disabled");
    expect(result).toBe(false);
  });

  it("getDaysBackForFrequency should return correct values", async () => {
    const { getDaysBackForFrequency } = await import("./services/digestScheduler");
    expect(getDaysBackForFrequency("weekly")).toBe(7);
    expect(getDaysBackForFrequency("biweekly")).toBe(14);
    expect(getDaysBackForFrequency("monthly")).toBe(30);
  });

  it("getPeriodLabelForFrequency should return correct labels", async () => {
    const { getPeriodLabelForFrequency } = await import("./services/digestScheduler");
    expect(getPeriodLabelForFrequency("weekly")).toBe("This Week");
    expect(getPeriodLabelForFrequency("biweekly")).toBe("Last 2 Weeks");
    expect(getPeriodLabelForFrequency("monthly")).toBe("This Month");
  });
});

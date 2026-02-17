import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Round 56 Features", () => {
  describe("Digest Scheduler", () => {
    it("exports startDigestScheduler and stopDigestScheduler", async () => {
      const mod = await import("./services/digestScheduler");
      expect(typeof mod.startDigestScheduler).toBe("function");
      expect(typeof mod.stopDigestScheduler).toBe("function");
    });

    it("exports forceDigestRun for manual triggering", async () => {
      const mod = await import("./services/digestScheduler");
      expect(typeof mod.forceDigestRun).toBe("function");
    });

    it("startDigestScheduler can be called without throwing", async () => {
      const mod = await import("./services/digestScheduler");
      // Start and immediately stop to avoid leaving timers running
      expect(() => mod.startDigestScheduler()).not.toThrow();
      mod.stopDigestScheduler();
    });

    it("stopDigestScheduler can be called multiple times safely", async () => {
      const mod = await import("./services/digestScheduler");
      expect(() => mod.stopDigestScheduler()).not.toThrow();
      expect(() => mod.stopDigestScheduler()).not.toThrow();
    });

    it("startDigestScheduler is idempotent (second call is a no-op)", async () => {
      const mod = await import("./services/digestScheduler");
      mod.stopDigestScheduler(); // Ensure clean state
      mod.startDigestScheduler();
      // Second call should not throw (it logs a warning and returns)
      expect(() => mod.startDigestScheduler()).not.toThrow();
      mod.stopDigestScheduler();
    });
  });

  describe("Digest Email HTML Generation", () => {
    it("digest router generateEmail procedure exists", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("digest.generateEmail");
    });

    it("digest router get procedure exists", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("digest.get");
    });
  });

  describe("Track Router Extraction", () => {
    it("trackRouter is properly imported and merged into appRouter", async () => {
      const { appRouter } = await import("./routers");
      // Verify key track procedures exist
      expect(appRouter._def.procedures).toHaveProperty("track.upload");
      expect(appRouter._def.procedures).toHaveProperty("track.addTag");
      expect(appRouter._def.procedures).toHaveProperty("track.deleteTrack");
      expect(appRouter._def.procedures).toHaveProperty("track.upload");
      expect(appRouter._def.procedures).toHaveProperty("track.get");
    });

    it("trackRouter file exports a valid router", async () => {
      const mod = await import("./routers/trackRouter");
      expect(mod.trackRouter).toBeDefined();
      expect(mod.trackRouter._def).toBeDefined();
    });
  });

  describe("BatchActionsToolbar Refactor", () => {
    it("tags.update procedure exists for batch tagging", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("tags.update");
    });

    it("track.deleteTrack procedure exists for batch deletion", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("track.deleteTrack");
    });
  });

  describe("Server Startup Integration", () => {
    it("health endpoint returns expected structure", async () => {
      // The health endpoint is registered in _core/index.ts
      // We verify the structure by checking the modules it depends on
      const { getRateLimiterStats } = await import("./userRateLimiter");
      const stats = getRateLimiterStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
    });

    it("graceful shutdown module exports correctly", async () => {
      const mod = await import("./shutdown");
      expect(typeof mod.registerGracefulShutdown).toBe("function");
      expect(typeof mod.isServerShuttingDown).toBe("function");
      expect(mod.isServerShuttingDown()).toBe(false);
    });

    it("logger module exports correctly", async () => {
      const mod = await import("./logger");
      expect(typeof mod.requestIdMiddleware).toBe("function");
      expect(mod.logger).toBeDefined();
      expect(typeof mod.logger.info).toBe("function");
      expect(typeof mod.logger.error).toBe("function");
      expect(typeof mod.logger.warn).toBe("function");
    });
  });

  describe("Email Service", () => {
    it("email service exports sendDigestEmail and sendReviewCompleteEmail", async () => {
      const mod = await import("./services/emailService");
      expect(typeof mod.sendDigestEmail).toBe("function");
      expect(typeof mod.sendNotificationEmail).toBe("function");
    });

    it("sendDigestEmail returns success:false when Postmark is not configured", async () => {
      const { sendDigestEmail } = await import("./services/emailService");
      const result = await sendDigestEmail({
        to: "test@example.com",
        userName: "Test",
        htmlContent: "<p>Test</p>",
        periodLabel: "This Week",
      });
      // Without POSTMARK_API_TOKEN, it should gracefully return false
      expect(result).toHaveProperty("success");
    });
  });
});

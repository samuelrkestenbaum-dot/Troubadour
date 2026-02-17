import { describe, it, expect, vi } from "vitest";

// ── User Rate Limiter Tests ──
describe("User Rate Limiter", () => {
  it("should export all rate limiter instances", async () => {
    const mod = await import("./userRateLimiter");
    expect(mod.aiReviewLimiter).toBeDefined();
    expect(mod.aiAnalysisLimiter).toBeDefined();
    expect(mod.aiChatLimiter).toBeDefined();
    expect(mod.imageGenLimiter).toBeDefined();
    expect(mod.exportLimiter).toBeDefined();
  });

  it("should export UserRateLimiter class", async () => {
    const { UserRateLimiter } = await import("./userRateLimiter");
    expect(UserRateLimiter).toBeDefined();
    const limiter = new UserRateLimiter({ maxRequests: 3, windowMs: 60000, name: "test" });
    expect(limiter).toBeDefined();
    limiter.destroy();
  });

  it("should allow requests within the limit", async () => {
    const { UserRateLimiter } = await import("./userRateLimiter");
    const limiter = new UserRateLimiter({ maxRequests: 5, windowMs: 60000, name: "test-allow" });
    const result1 = limiter.check(1);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(4);
    expect(result1.limit).toBe(5);
    limiter.destroy();
  });

  it("should block requests exceeding the limit", async () => {
    const { UserRateLimiter } = await import("./userRateLimiter");
    const limiter = new UserRateLimiter({ maxRequests: 2, windowMs: 60000, name: "test-block" });
    limiter.check(1);
    limiter.check(1);
    const result = limiter.check(1);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBeGreaterThan(0);
    limiter.destroy();
  });

  it("should track different users independently", async () => {
    const { UserRateLimiter } = await import("./userRateLimiter");
    const limiter = new UserRateLimiter({ maxRequests: 1, windowMs: 60000, name: "test-users" });
    const result1 = limiter.check(1);
    const result2 = limiter.check(2);
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    // Both should be blocked now
    const result3 = limiter.check(1);
    expect(result3.allowed).toBe(false);
    const result4 = limiter.check(2);
    expect(result4.allowed).toBe(false);
    limiter.destroy();
  });

  it("should return correct rate limit info", async () => {
    const { UserRateLimiter } = await import("./userRateLimiter");
    const limiter = new UserRateLimiter({ maxRequests: 10, windowMs: 300000, name: "test-info" });
    const result = limiter.check(99);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
    expect(result.resetMs).toBeGreaterThan(0);
    expect(result.resetMs).toBeLessThanOrEqual(300000);
    limiter.destroy();
  });

  it("should export getRateLimiterStats function", async () => {
    const { getRateLimiterStats } = await import("./userRateLimiter");
    const stats = getRateLimiterStats();
    expect(stats).toHaveProperty("aiReview");
    expect(stats).toHaveProperty("aiAnalysis");
    expect(stats).toHaveProperty("aiChat");
    expect(stats).toHaveProperty("imageGen");
    expect(stats).toHaveProperty("export");
  });

  it("should export userRateLimit middleware factory", async () => {
    const { userRateLimit } = await import("./userRateLimiter");
    expect(userRateLimit).toBeTypeOf("function");
  });
});

// ── Structured Logger Tests ──
describe("Structured Logger", () => {
  it("should export logger functions", async () => {
    const mod = await import("./logger");
    expect(mod.logger).toBeDefined();
    expect(mod.logger.info).toBeTypeOf("function");
    expect(mod.logger.warn).toBeTypeOf("function");
    expect(mod.logger.error).toBeTypeOf("function");
    expect(mod.logger.debug).toBeTypeOf("function");
  });

  it("should export requestIdMiddleware", async () => {
    const mod = await import("./logger");
    expect(mod.requestIdMiddleware).toBeTypeOf("function");
  });

  it("should export generateRequestId", async () => {
    const { generateRequestId } = await import("./logger");
    const id = generateRequestId();
    expect(id).toBeTypeOf("string");
    expect(id.length).toBe(8);
  });

  it("should log with correct format", async () => {
    const { logger } = await import("./logger");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test message", { key: "value" });
    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain("INFO");
    expect(logOutput).toContain("Test message");
    consoleSpy.mockRestore();
  });

  it("should export requestContext AsyncLocalStorage", async () => {
    const { requestContext } = await import("./logger");
    expect(requestContext).toBeDefined();
    expect(requestContext.getStore).toBeTypeOf("function");
  });
});

// ── Graceful Shutdown Tests ──
describe("Graceful Shutdown", () => {
  it("should export registerGracefulShutdown function", async () => {
    const mod = await import("./shutdown");
    expect(mod.registerGracefulShutdown).toBeTypeOf("function");
  });

  it("should export isServerShuttingDown function", async () => {
    const { isServerShuttingDown } = await import("./shutdown");
    expect(isServerShuttingDown).toBeTypeOf("function");
    expect(isServerShuttingDown()).toBe(false);
  });
});

// ── Rate-Limited Procedure Exports ──
describe("Rate-Limited tRPC Procedures", () => {
  it("should export all rate-limited procedure variants", async () => {
    const mod = await import("./_core/trpc");
    expect(mod.aiReviewProcedure).toBeDefined();
    expect(mod.aiAnalysisProcedure).toBeDefined();
    expect(mod.aiChatProcedure).toBeDefined();
    expect(mod.imageGenProcedure).toBeDefined();
    expect(mod.exportProcedure).toBeDefined();
  });

  it("should export standard procedures alongside rate-limited ones", async () => {
    const mod = await import("./_core/trpc");
    expect(mod.publicProcedure).toBeDefined();
    expect(mod.protectedProcedure).toBeDefined();
    expect(mod.adminProcedure).toBeDefined();
    expect(mod.router).toBeDefined();
  });
});

// ── Sanitization Tests ──
describe("Input Sanitization", () => {
  it("should export sanitize functions", async () => {
    const mod = await import("./sanitize");
    expect(mod.sanitizeText).toBeTypeOf("function");
    expect(mod.sanitizeRichContent).toBeTypeOf("function");
    expect(mod.sanitizeUrl).toBeTypeOf("function");
    expect(mod.sanitizeEmail).toBeTypeOf("function");
  });

  it("should strip dangerous HTML from text", async () => {
    const { sanitizeText } = await import("./sanitize");
    const result = sanitizeText('<script>alert("xss")</script>Hello');
    expect(result).not.toContain("<script>");
    expect(result).toContain("Hello");
  });

  it("should preserve safe HTML in sanitizeRichContent", async () => {
    const { sanitizeRichContent } = await import("./sanitize");
    const result = sanitizeRichContent("<b>Bold</b> <i>Italic</i>");
    expect(result).toContain("<b>Bold</b>");
    expect(result).toContain("<i>Italic</i>");
  });

  it("should strip dangerous tags in sanitizeRichContent", async () => {
    const { sanitizeRichContent } = await import("./sanitize");
    const result = sanitizeRichContent('<script>alert("xss")</script><b>Safe</b>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("<b>Safe</b>");
  });

  it("should sanitize URLs with javascript: protocol", async () => {
    const { sanitizeUrl } = await import("./sanitize");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("should validate email addresses", async () => {
    const { sanitizeEmail } = await import("./sanitize");
    expect(sanitizeEmail("test@example.com")).toBe("test@example.com");
    expect(sanitizeEmail("not-an-email")).toBe("");
  });
});

// ── Email Service Tests ──
describe("Email Service", () => {
  it("should export sendEmail and sendDigestEmail functions", async () => {
    const mod = await import("./services/emailService");
    expect(mod.sendEmail).toBeTypeOf("function");
    expect(mod.sendDigestEmail).toBeTypeOf("function");
  });
});

// ── Sentry Server Module Tests ──
describe("Sentry Server Module", () => {
  it("should export initSentry and captureError functions", async () => {
    const mod = await import("./sentry");
    expect(mod.initSentry).toBeTypeOf("function");
    expect(mod.captureError).toBeTypeOf("function");
  });
});

// ── Rate Limiter Integration with Routers ──
describe("Rate Limiter Integration", () => {
  it("should have rate-limited procedures applied to AI endpoints in routers", async () => {
    const fs = await import("fs");
    const mainContent = fs.readFileSync("server/routers.ts", "utf-8");
    const jobContent = fs.readFileSync("server/routers/jobRouter.ts", "utf-8");
    const chatContent = fs.readFileSync("server/routers/chatRouter.ts", "utf-8");
    const reviewContent = fs.readFileSync("server/routers/reviewRouter.ts", "utf-8");
    const creativeContent = fs.readFileSync("server/routers/creativeRouter.ts", "utf-8");
    const analysisContent = fs.readFileSync("server/routers/analysisRouter.ts", "utf-8");
    const allContent = mainContent + jobContent + chatContent + reviewContent + creativeContent + analysisContent;
    // Verify AI review endpoints use aiReviewProcedure (now in extracted jobRouter)
    expect(allContent).toContain("analyze: aiReviewProcedure");
    expect(allContent).toContain("review: aiReviewProcedure");
    expect(allContent).toContain("reReview: aiReviewProcedure");
    // Verify chat endpoints use aiChatProcedure (now in extracted chatRouter)
    expect(allContent).toContain("sendMessage: aiChatProcedure");
    // Verify export endpoints use exportProcedure (now in extracted reviewRouter)
    expect(allContent).toContain("exportMarkdown: exportProcedure");
    expect(allContent).toContain("exportHtml: exportProcedure");
    // Verify analysis endpoints use aiAnalysisProcedure
    expect(allContent).toContain("generateChecklist: aiAnalysisProcedure");
    // Verify standard procedures are still used for non-AI endpoints
    expect(allContent).toContain("protectedProcedure");
  });
});

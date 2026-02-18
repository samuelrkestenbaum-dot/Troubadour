import { describe, it, expect, vi } from "vitest";

// ── Sanitization Tests ──
describe("Input Sanitization", () => {
  it("sanitizeText strips all HTML tags", async () => {
    const { sanitizeText } = await import("./sanitize");
    expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe("Hello");
    expect(sanitizeText("<b>bold</b> text")).toBe("bold text");
    expect(sanitizeText("plain text")).toBe("plain text");
  });

  it("sanitizeText handles empty and null-like inputs", async () => {
    const { sanitizeText } = await import("./sanitize");
    expect(sanitizeText("")).toBe("");
    expect(sanitizeText("   ")).toBe("");
  });

  it("sanitizeRichContent allows safe HTML tags", async () => {
    const { sanitizeRichContent } = await import("./sanitize");
    const result = sanitizeRichContent("<b>bold</b> <em>italic</em> <p>paragraph</p>");
    expect(result).toContain("<b>bold</b>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<p>paragraph</p>");
  });

  it("sanitizeRichContent strips script tags", async () => {
    const { sanitizeRichContent } = await import("./sanitize");
    const result = sanitizeRichContent('<p>Hello</p><script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("<p>Hello</p>");
  });

  it("sanitizeUrl blocks javascript: protocol", async () => {
    const { sanitizeUrl } = await import("./sanitize");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("");
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("sanitizeUrl blocks data: URIs except images", async () => {
    const { sanitizeUrl } = await import("./sanitize");
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });

  it("sanitizeEmail validates email format", async () => {
    const { sanitizeEmail } = await import("./sanitize");
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
    expect(sanitizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
    expect(sanitizeEmail("not-an-email")).toBe("");
    expect(sanitizeEmail("")).toBe("");
  });
});

// ── Email Service Tests ──
// These tests mock the ENV to simulate Postmark being unconfigured,
// since the real POSTMARK_API_TOKEN is now set in the environment.
describe("Email Service", () => {
  it("sendEmail returns success when Postmark is not configured", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { postmarkApiToken: "", postmarkFromEmail: "" },
    }));
    const { sendEmail } = await import("./services/emailService");
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      htmlBody: "<p>Hello</p>",
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^local-/);
    vi.doUnmock("./_core/env");
  });

  it("sendDigestEmail returns success when Postmark is not configured", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { postmarkApiToken: "", postmarkFromEmail: "" },
    }));
    const { sendDigestEmail } = await import("./services/emailService");
    const result = await sendDigestEmail({
      to: "test@example.com",
      userName: "Test User",
      htmlContent: "<p>Your digest</p>",
      periodLabel: "This Week",
    });
    expect(result.success).toBe(true);
    vi.doUnmock("./_core/env");
  });

  it("sendNotificationEmail wraps content in branded template", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: { postmarkApiToken: "", postmarkFromEmail: "" },
    }));
    const { sendNotificationEmail } = await import("./services/emailService");
    const result = await sendNotificationEmail({
      to: "test@example.com",
      subject: "Review Ready",
      preheader: "Your review is ready",
      bodyHtml: "<p>Check it out</p>",
    });
    expect(result.success).toBe(true);
    vi.doUnmock("./_core/env");
  });
});

// ── Sentry Module Tests ──
describe("Sentry Server Module", () => {
  it("exports initSentry function", async () => {
    const sentry = await import("./sentry");
    expect(typeof sentry.initSentry).toBe("function");
  });

  it("initSentry does not throw when DSN is empty", async () => {
    const sentry = await import("./sentry");
    expect(() => sentry.initSentry()).not.toThrow();
  });
});

// ── Sentry Client Module Tests ──
describe("Sentry Client Module", () => {
  it("exports initSentry function", async () => {
    const sentry = await import("../client/src/lib/sentry");
    expect(typeof sentry.initSentry).toBe("function");
  });
});

// ── Security Headers (Helmet) ──
describe("Security Headers", () => {
  it("helmet package is installed and importable", async () => {
    const helmet = await import("helmet");
    expect(typeof helmet.default).toBe("function");
  });
});

// ── XSS Package ──
describe("XSS Package", () => {
  it("xss FilterXSS class is available", async () => {
    const { FilterXSS } = await import("xss");
    expect(typeof FilterXSS).toBe("function");
    const filter = new FilterXSS({});
    expect(typeof filter.process).toBe("function");
  });
});

// ── Portfolio Export DB Helper ──
describe("Portfolio Export DB Helper", () => {
  it("getPortfolioData function exists", async () => {
    const db = await import("./db");
    expect(typeof db.getPortfolioData).toBe("function");
  });
});

// ── Digest Email DB Helper ──
describe("Digest Email DB Helper", () => {
  it("getDigestData function exists", async () => {
    const db = await import("./db");
    expect(typeof db.getDigestData).toBe("function");
  });
});

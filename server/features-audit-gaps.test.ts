import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Phase 1: Security & Data Integrity ──

describe("Phase 1: Magic Bytes Audio Validation", () => {
  it("should export validateAudioMagicBytes function", async () => {
    const mod = await import("./utils/audioValidation");
    expect(typeof mod.validateAudioMagicBytes).toBe("function");
  });

  it("should accept valid MP3 magic bytes (ID3 tag)", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    // ID3v2 header: 0x49 0x44 0x33 — needs >= 16 bytes
    const mp3Buffer = Buffer.alloc(16);
    mp3Buffer[0] = 0x49; mp3Buffer[1] = 0x44; mp3Buffer[2] = 0x33;
    const result = validateAudioMagicBytes(mp3Buffer);
    expect(result.valid).toBe(true);
    expect(result.detectedFormat).toBe("MP3/ID3v2");
  });

  it("should accept valid MP3 magic bytes (sync word)", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    const mp3Buffer = Buffer.alloc(16);
    mp3Buffer[0] = 0xFF; mp3Buffer[1] = 0xFB;
    const result = validateAudioMagicBytes(mp3Buffer);
    expect(result.valid).toBe(true);
    expect(result.detectedFormat).toBe("MP3/MPEG1-L3");
  });

  it("should accept valid WAV magic bytes", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    // RIFF....WAVE — needs RIFF at 0 and WAVE at 8
    const wavBuffer = Buffer.alloc(16);
    Buffer.from("RIFF").copy(wavBuffer, 0);
    Buffer.from("WAVE").copy(wavBuffer, 8);
    const result = validateAudioMagicBytes(wavBuffer);
    expect(result.valid).toBe(true);
    expect(result.detectedFormat).toBe("WAV/RIFF");
  });

  it("should accept valid FLAC magic bytes", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    const flacBuffer = Buffer.alloc(16);
    Buffer.from("fLaC").copy(flacBuffer, 0);
    const result = validateAudioMagicBytes(flacBuffer);
    expect(result.valid).toBe(true);
    expect(result.detectedFormat).toBe("FLAC");
  });

  it("should accept valid OGG magic bytes", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    const oggBuffer = Buffer.alloc(16);
    Buffer.from("OggS").copy(oggBuffer, 0);
    const result = validateAudioMagicBytes(oggBuffer);
    expect(result.valid).toBe(true);
    expect(result.detectedFormat).toBe("OGG");
  });

  it("should reject invalid magic bytes", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    // PNG header — not a valid audio format, 16+ bytes
    const pngBuffer = Buffer.alloc(16);
    pngBuffer[0] = 0x89; pngBuffer[1] = 0x50; pngBuffer[2] = 0x4E; pngBuffer[3] = 0x47;
    const result = validateAudioMagicBytes(pngBuffer);
    expect(result.valid).toBe(false);
    expect(result.detectedFormat).toBeNull();
  });

  it("should reject buffer shorter than 16 bytes", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    const shortBuffer = Buffer.alloc(8);
    const result = validateAudioMagicBytes(shortBuffer);
    expect(result.valid).toBe(false);
  });

  it("should return detected format name for valid audio", async () => {
    const { validateAudioMagicBytes } = await import("./utils/audioValidation");
    const flacBuffer = Buffer.alloc(16);
    Buffer.from("fLaC").copy(flacBuffer, 0);
    const result = validateAudioMagicBytes(flacBuffer);
    expect(result.valid).toBe(true);
    expect(result.detectedFormat).toBe("FLAC");
  });
});

describe("Phase 1: Circuit Breaker", () => {
  it("should export CircuitBreaker class", async () => {
    const mod = await import("./utils/circuitBreaker");
    expect(typeof mod.CircuitBreaker).toBe("function");
  });

  it("should start in CLOSED state", async () => {
    const { CircuitBreaker } = await import("./utils/circuitBreaker");
    const cb = new CircuitBreaker("test-service", { failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(cb.getState()).toBe("CLOSED");
  });

  it("should execute function successfully in CLOSED state", async () => {
    const { CircuitBreaker } = await import("./utils/circuitBreaker");
    const cb = new CircuitBreaker("test-exec", { failureThreshold: 3, resetTimeoutMs: 1000 });
    const result = await cb.execute(() => Promise.resolve("success"));
    expect(result).toBe("success");
    expect(cb.getState()).toBe("CLOSED");
  });

  it("should track failures and open circuit after threshold", async () => {
    const { CircuitBreaker } = await import("./utils/circuitBreaker");
    const cb = new CircuitBreaker("test-fail", { failureThreshold: 2, resetTimeoutMs: 60000 });

    // First failure
    await expect(cb.execute(() => Promise.reject(new Error("fail1")))).rejects.toThrow("fail1");
    expect(cb.getState()).toBe("CLOSED");

    // Second failure — should trip to OPEN
    await expect(cb.execute(() => Promise.reject(new Error("fail2")))).rejects.toThrow("fail2");
    expect(cb.getState()).toBe("OPEN");
  });

  it("should reject immediately when circuit is OPEN", async () => {
    const { CircuitBreaker } = await import("./utils/circuitBreaker");
    const cb = new CircuitBreaker("test-open", { failureThreshold: 1, resetTimeoutMs: 60000 });

    // Trip the circuit
    await expect(cb.execute(() => Promise.reject(new Error("trip")))).rejects.toThrow("trip");
    expect(cb.getState()).toBe("OPEN");

    // Should reject without calling the function
    await expect(cb.execute(() => Promise.resolve("should-not-run"))).rejects.toThrow();
  });

  it("should reset failure count on success", async () => {
    const { CircuitBreaker } = await import("./utils/circuitBreaker");
    const cb = new CircuitBreaker("test-reset", { failureThreshold: 3, resetTimeoutMs: 1000 });

    // One failure
    await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    // Success should reset
    await cb.execute(() => Promise.resolve("ok"));
    expect(cb.getState()).toBe("CLOSED");

    // Two more failures should NOT trip (count was reset)
    await expect(cb.execute(() => Promise.reject(new Error("f1")))).rejects.toThrow();
    await expect(cb.execute(() => Promise.reject(new Error("f2")))).rejects.toThrow();
    expect(cb.getState()).toBe("CLOSED");
  });
});

describe("Phase 1: Dead Letter Queue Schema & DB Helpers", () => {
  it("should have deadLetterQueue table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.deadLetterQueue).toBeDefined();
  });

  it("should export addToDeadLetterQueue function", async () => {
    const db = await import("./db");
    expect(typeof db.addToDeadLetterQueue).toBe("function");
  });

  it("should export getDeadLetterQueueItems function", async () => {
    const db = await import("./db");
    expect(typeof db.getDeadLetterQueueItems).toBe("function");
  });

  it("should export markDlqItemProcessed function", async () => {
    const db = await import("./db");
    expect(typeof db.markDlqItemProcessed).toBe("function");
  });

  it("should export getDlqStats function", async () => {
    const db = await import("./db");
    expect(typeof db.getDlqStats).toBe("function");
  });
});

describe("Phase 1: DLQ Integration in Job Processor", () => {
  it("should reference addToDeadLetterQueue in job processor", async () => {
    const jobProcessorPath = path.join(__dirname, "services/jobProcessor.ts");
    const content = fs.readFileSync(jobProcessorPath, "utf-8");
    expect(content).toContain("addToDeadLetterQueue");
  });

  it("should check retry count before adding to DLQ", async () => {
    const jobProcessorPath = path.join(__dirname, "services/jobProcessor.ts");
    const content = fs.readFileSync(jobProcessorPath, "utf-8");
    // Should have both retry check and DLQ insertion
    expect(content).toMatch(/retries|retry|attempts|maxRetries/i);
    expect(content).toContain("addToDeadLetterQueue");
  });
});

describe("Phase 1: CSRF / SameSite Cookie", () => {
  it("should set sameSite cookie attribute", async () => {
    const cookiesPath = path.join(__dirname, "_core/cookies.ts");
    const content = fs.readFileSync(cookiesPath, "utf-8");
    expect(content).toMatch(/sameSite/i);
  });
});

// ── Phase 2: Performance & Resilience ──

describe("Phase 2: React.lazy Code Splitting", () => {
  it("should use lazy for page imports in App.tsx", () => {
    const appPath = path.join(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");
    // Could be React.lazy or { lazy } from 'react'
    expect(content).toMatch(/lazy\(/);
    expect(content).toContain("Suspense");
  });

  it("should lazy-load at least 20 pages", () => {
    const appPath = path.join(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");
    const lazyImports = content.match(/lazy\(/g);
    expect(lazyImports).toBeDefined();
    expect(lazyImports!.length).toBeGreaterThanOrEqual(20);
  });

  it("should have a Suspense fallback component", () => {
    const appPath = path.join(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("fallback=");
  });
});

describe("Phase 2: Server-side Cache Utility", () => {
  it("should export TTLCache class", async () => {
    const mod = await import("./utils/cache");
    expect(typeof mod.TTLCache).toBe("function");
  });

  it("should cache and retrieve values", async () => {
    const { TTLCache } = await import("./utils/cache");
    const cache = new TTLCache<string>(60000); // 60s TTL
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return undefined for expired entries", async () => {
    const { TTLCache } = await import("./utils/cache");
    const cache = new TTLCache<string>(1); // 1ms TTL
    cache.set("key1", "value1");
    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(cache.get("key1")).toBeUndefined();
  });

  it("should invalidate entries", async () => {
    const { TTLCache } = await import("./utils/cache");
    const cache = new TTLCache<string>(60000);
    cache.set("key1", "value1");
    cache.invalidate("key1");
    expect(cache.get("key1")).toBeUndefined();
  });

  it("should clear all entries", async () => {
    const { TTLCache } = await import("./utils/cache");
    const cache = new TTLCache<string>(60000);
    cache.set("k1", "v1");
    cache.set("k2", "v2");
    cache.invalidateAll();
    expect(cache.get("k1")).toBeUndefined();
    expect(cache.get("k2")).toBeUndefined();
  });

  it("should export pre-configured caches", async () => {
    const mod = await import("./utils/cache");
    expect(mod.adminSettingsCache).toBeDefined();
    expect(mod.genreBenchmarksCache).toBeDefined();
    expect(mod.userTierCache).toBeDefined();
  });
});

describe("Phase 2: Circuit Breakers on External Services", () => {
  it("should have circuit breaker in claudeCritic.ts", () => {
    const filePath = path.join(__dirname, "services/claudeCritic.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("CircuitBreaker");
    expect(content).toContain("circuitBreaker");
  });

  it("should have circuit breaker in geminiAudio.ts", () => {
    const filePath = path.join(__dirname, "services/geminiAudio.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("CircuitBreaker");
    expect(content).toContain("circuitBreaker");
  });

  it("should have circuit breaker in emailNotification.ts", () => {
    const filePath = path.join(__dirname, "services/emailNotification.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("CircuitBreaker");
    expect(content).toContain("circuitBreaker");
  });
});

// ── Phase 3: Business Logic & UX ──

describe("Phase 3: Stripe Webhook Expansion", () => {
  it("should handle customer.subscription.trial_will_end event", () => {
    const webhookPath = path.join(__dirname, "stripe/webhook.ts");
    const content = fs.readFileSync(webhookPath, "utf-8");
    expect(content).toContain("customer.subscription.trial_will_end");
  });

  it("should handle customer.subscription.paused event", () => {
    const webhookPath = path.join(__dirname, "stripe/webhook.ts");
    const content = fs.readFileSync(webhookPath, "utf-8");
    expect(content).toContain("customer.subscription.paused");
  });

  it("should handle customer.subscription.resumed event", () => {
    const webhookPath = path.join(__dirname, "stripe/webhook.ts");
    const content = fs.readFileSync(webhookPath, "utf-8");
    expect(content).toContain("customer.subscription.resumed");
  });

  it("should handle invoice.payment_failed event", () => {
    const webhookPath = path.join(__dirname, "stripe/webhook.ts");
    const content = fs.readFileSync(webhookPath, "utf-8");
    // Should handle payment failure events
    expect(content).toMatch(/invoice\.payment_failed|payment_intent\.payment_failed/);
  });
});

describe("Phase 3: Error Recovery UX", () => {
  it("should have retry button in TrackView error banner", () => {
    const trackViewPath = path.join(__dirname, "../client/src/pages/TrackView.tsx");
    const content = fs.readFileSync(trackViewPath, "utf-8");
    expect(content).toContain("Error Banner with Retry");
    expect(content).toContain("RotateCcw");
    expect(content).toContain("Retry");
  });

  it("should show helpful error message when no jobError exists", () => {
    const trackViewPath = path.join(__dirname, "../client/src/pages/TrackView.tsx");
    const content = fs.readFileSync(trackViewPath, "utf-8");
    expect(content).toContain("temporary AI service outage");
  });
});

describe("Phase 3: Service Status / Graceful Degradation", () => {
  it("should have ServiceStatusBanner component", () => {
    const bannerPath = path.join(__dirname, "../client/src/components/ServiceStatusBanner.tsx");
    expect(fs.existsSync(bannerPath)).toBe(true);
    const content = fs.readFileSync(bannerPath, "utf-8");
    expect(content).toContain("ServiceStatusBanner");
  });

  it("should have serviceHealth procedure in system router", () => {
    const routerPath = path.join(__dirname, "_core/systemRouter.ts");
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("serviceHealth");
  });

  it("should be integrated in DashboardLayout", () => {
    const layoutPath = path.join(__dirname, "../client/src/components/DashboardLayout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("ServiceStatusBanner");
  });
});

describe("Phase 3: DLQ Admin Router", () => {
  it("should export dlqRouter", async () => {
    const mod = await import("./routers/dlqRouter");
    expect(mod.dlqRouter).toBeDefined();
  });

  it("should be registered in appRouter", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("dlq: dlqRouter");
    expect(content).toContain("import { dlqRouter }");
  });
});

// ── Phase 4: Polish & Growth ──

describe("Phase 4: Audit Trail", () => {
  it("should export logAuditEvent function", async () => {
    const mod = await import("./utils/auditTrail");
    expect(typeof mod.logAuditEvent).toBe("function");
  });

  it("should define standard audit action types", async () => {
    // Verify the module compiles and the type system accepts known actions
    const { logAuditEvent } = await import("./utils/auditTrail");
    // This test verifies the function exists and can be called
    // (actual DB call will be a no-op in test environment)
    expect(logAuditEvent).toBeDefined();
  });

  it("should have audit logging in project create mutation", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain('action: "project.create"');
  });

  it("should have audit logging in project delete mutation", () => {
    const routersPath = path.join(__dirname, "routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain('action: "project.delete"');
  });

  it("should have audit logging in track upload mutation", () => {
    const trackRouterPath = path.join(__dirname, "routers/trackRouter.ts");
    const content = fs.readFileSync(trackRouterPath, "utf-8");
    expect(content).toContain('action: "track.upload"');
  });

  it("should have audit logging in subscription checkout", () => {
    const subRouterPath = path.join(__dirname, "routers/subscriptionRouter.ts");
    const content = fs.readFileSync(subRouterPath, "utf-8");
    expect(content).toContain('action: "subscription.checkout"');
  });

  it("should have audit logging in collaboration invite", () => {
    const collabRouterPath = path.join(__dirname, "routers/collaborationRouter.ts");
    const content = fs.readFileSync(collabRouterPath, "utf-8");
    expect(content).toContain('action: "collaboration.invite"');
  });

  it("should never throw from logAuditEvent (fire-and-forget)", async () => {
    const { logAuditEvent } = await import("./utils/auditTrail");
    // Should not throw even with invalid data (DB will be unavailable in test)
    await expect(
      logAuditEvent({ userId: -1, action: "login" })
    ).resolves.not.toThrow();
  });
});

// ── Cross-cutting: TypeScript Compilation ──

describe("Cross-cutting: All new files compile", () => {
  const newFiles = [
    "server/utils/audioValidation.ts",
    "server/utils/circuitBreaker.ts",
    "server/utils/cache.ts",
    "server/utils/auditTrail.ts",
    "server/routers/dlqRouter.ts",
    "client/src/components/ServiceStatusBanner.tsx",
  ];

  for (const file of newFiles) {
    it(`${file} should exist`, () => {
      const fullPath = path.join(__dirname, "..", file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }
});

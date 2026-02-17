import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Round 56 Navigation Tests: CTA Fixes, Persona Wiring, BatchActions Deps ──

function createTestContext(authenticated = true): TrpcContext {
  return {
    user: authenticated
      ? {
          id: 1,
          openId: "test-user",
          email: "test@example.com",
          name: "Test User",
          loginMethod: "manus",
          role: "user",
          audioMinutesUsed: 0,
          audioMinutesLimit: 60,
          tier: "free",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          deletedAt: null,
          monthlyReviewCount: 0,
          monthlyResetAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          digestFrequency: "weekly" as const,
          lastDigestSentAt: null,
          notificationPreferences: null,
          preferredPersona: "full" as const,
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Round 56 Nav – project.create accepts reviewFocus (persona wiring)", () => {
  it("project.create procedure exists and is a mutation", () => {
    expect(appRouter._def.procedures).toHaveProperty("project.create");
    const proc = (appRouter._def.procedures as any)["project.create"];
    expect(proc._def.type).toBe("mutation");
  });

  it("project.create input schema accepts all valid reviewFocus values", () => {
    const proc = (appRouter._def.procedures as any)["project.create"];
    const inputSchema = proc._def.inputs?.[0];
    expect(inputSchema).toBeDefined();

    const validPersonas = ["songwriter", "producer", "arranger", "artist", "anr", "full"];
    for (const persona of validPersonas) {
      const result = inputSchema.safeParse({
        title: "Test Project",
        reviewFocus: persona,
      });
      expect(result.success).toBe(true);
    }
  });

  it("project.create input schema rejects invalid reviewFocus values", () => {
    const proc = (appRouter._def.procedures as any)["project.create"];
    const inputSchema = proc._def.inputs?.[0];
    expect(inputSchema).toBeDefined();

    const result = inputSchema.safeParse({
      title: "Test Project",
      reviewFocus: "invalid_persona",
    });
    expect(result.success).toBe(false);
  });

  it("project.create defaults reviewFocus to 'full' when not provided", () => {
    const proc = (appRouter._def.procedures as any)["project.create"];
    const inputSchema = proc._def.inputs?.[0];
    expect(inputSchema).toBeDefined();

    const result = inputSchema.safeParse({ title: "Test Project" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewFocus).toBe("full");
    }
  });
});

describe("Round 56 Nav – Auth state for CTA navigation logic", () => {
  it("auth.me returns user when authenticated", async () => {
    const ctx = createTestContext(true);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
    expect(result?.email).toBe("test@example.com");
  });

  it("auth.me returns null when not authenticated", async () => {
    const ctx = createTestContext(false);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("Round 56 Nav – Template/persona router procedures", () => {
  it("template.list procedure exists and is a query", () => {
    expect(appRouter._def.procedures).toHaveProperty("template.list");
    const proc = (appRouter._def.procedures as any)["template.list"];
    expect(proc._def.type).toBe("query");
  });

  it("template.create procedure exists and is a mutation", () => {
    expect(appRouter._def.procedures).toHaveProperty("template.create");
    const proc = (appRouter._def.procedures as any)["template.create"];
    expect(proc._def.type).toBe("mutation");
  });
});

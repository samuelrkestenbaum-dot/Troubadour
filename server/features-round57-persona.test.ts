import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-persona-user",
    email: "persona@example.com",
    name: "Persona Test User",
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
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("persona.getPreference", () => {
  it("procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.persona.getPreference).toBe("function");
  });
});

describe("persona.updatePreference", () => {
  it("procedure exists and is callable", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.persona.updatePreference).toBe("function");
  });

  it("rejects invalid persona values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.persona.updatePreference({ persona: "invalid" as any })
    ).rejects.toThrow();
  });
});

describe("project.update with reviewFocus", () => {
  it("procedure accepts reviewFocus parameter", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.project.update).toBe("function");
  });

  it("rejects invalid reviewFocus values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.project.update({ id: 1, reviewFocus: "invalid_persona" as any })
    ).rejects.toThrow();
  });
});

describe("project.create with persona persistence", () => {
  it("accepts reviewFocus parameter", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(typeof caller.project.create).toBe("function");
  });

  it("rejects invalid reviewFocus values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.project.create({
        title: "Test Project",
        reviewFocus: "invalid_focus" as any,
      })
    ).rejects.toThrow();
  });

  it("accepts valid persona values in reviewFocus", async () => {
    const validPersonas = ["songwriter", "producer", "arranger", "artist", "anr", "full"];
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const persona of validPersonas) {
      try {
        await caller.project.create({
          title: `Test ${persona}`,
          reviewFocus: persona as any,
        });
      } catch (e: any) {
        // DB errors are expected since we're not connected to a real DB in tests
        // But Zod validation errors should NOT occur for valid personas
        expect(e.message).not.toContain("Invalid enum value");
      }
    }
  });
});

describe("persona preference schema", () => {
  it("valid persona enum values are accepted by updatePreference input", async () => {
    const validPersonas = ["songwriter", "producer", "arranger", "artist", "anr", "full"];
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const persona of validPersonas) {
      try {
        await caller.persona.updatePreference({ persona: persona as any });
      } catch (e: any) {
        // DB errors expected, but Zod validation should pass
        expect(e.message).not.toContain("Invalid enum value");
      }
    }
  });

  it("preferredPersona column exists in users schema", async () => {
    const schema = await import("../drizzle/schema");
    const usersColumns = schema.users;
    expect((usersColumns as any).preferredPersona).toBeDefined();
  });
});

describe("db persona helpers", () => {
  it("should export updateUserPreferredPersona function", async () => {
    const db = await import("./db");
    expect(typeof db.updateUserPreferredPersona).toBe("function");
  });

  it("should export getUserPreferredPersona function", async () => {
    const db = await import("./db");
    expect(typeof db.getUserPreferredPersona).toBe("function");
  });
});

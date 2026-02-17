import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides: Partial<AuthenticatedUser> = {}): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-onboarding-user",
    email: "onboarding@example.com",
    name: "Onboarding Test User",
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
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  return {
    ctx: {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    },
  };
}

// ── Persona Onboarding Flow Tests ──
describe("Persona onboarding - preference update flow", () => {
  it("persona.updatePreference accepts all 6 valid persona values", async () => {
    const validPersonas = ["songwriter", "producer", "arranger", "artist", "anr", "full"] as const;
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const persona of validPersonas) {
      try {
        await caller.persona.updatePreference({ persona });
      } catch (e: any) {
        // DB errors expected in test env, but Zod validation should pass
        expect(e.message).not.toContain("Invalid enum value");
      }
    }
  });

  it("persona.updatePreference rejects empty string", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.persona.updatePreference({ persona: "" as any })
    ).rejects.toThrow();
  });

  it("persona.updatePreference rejects non-enum values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const invalidValues = ["listener", "fan", "manager", "engineer", "dj", "critic"];
    for (const val of invalidValues) {
      await expect(
        caller.persona.updatePreference({ persona: val as any })
      ).rejects.toThrow();
    }
  });

  it("persona.getPreference requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.persona.getPreference()).rejects.toThrow("Please login");
  });

  it("persona.updatePreference requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.persona.updatePreference({ persona: "songwriter" })
    ).rejects.toThrow("Please login");
  });
});

// ── Schema Validation ──
describe("Persona onboarding - schema validation", () => {
  it("users table has preferredPersona column", async () => {
    const schema = await import("../drizzle/schema");
    expect((schema.users as any).preferredPersona).toBeDefined();
  });

  it("PersonaOnboarding component file exists", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync("client/src/components/PersonaOnboarding.tsx");
    expect(exists).toBe(true);
  });

  it("PersonaOnboarding is imported in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appContent).toContain("PersonaOnboarding");
    expect(appContent).toContain("import { PersonaOnboarding }");
  });

  it("PersonaOnboarding component includes all 6 persona options", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PersonaOnboarding.tsx", "utf-8");
    expect(content).toContain('"songwriter"');
    expect(content).toContain('"producer"');
    expect(content).toContain('"artist"');
    expect(content).toContain('"arranger"');
    expect(content).toContain('"anr"');
    expect(content).toContain('"full"');
  });

  it("PersonaOnboarding uses localStorage to track dismissal", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PersonaOnboarding.tsx", "utf-8");
    expect(content).toContain("persona-onboarding-dismissed");
    expect(content).toContain("localStorage");
  });

  it("PersonaOnboarding uses trpc.persona.updatePreference mutation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PersonaOnboarding.tsx", "utf-8");
    expect(content).toContain("trpc.persona.updatePreference.useMutation");
  });

  it("PersonaOnboarding has Skip and Continue buttons", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/PersonaOnboarding.tsx", "utf-8");
    expect(content).toContain("Skip for now");
    expect(content).toContain("Continue");
  });
});

// ── Project Creation with Persona from Onboarding ──
describe("Persona onboarding - project creation integration", () => {
  it("project.create accepts reviewFocus from onboarding persona", async () => {
    const personas = ["songwriter", "producer", "arranger", "artist", "anr", "full"] as const;

    for (const persona of personas) {
      const { ctx } = createAuthContext({ preferredPersona: persona as any });
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.project.create({
          title: `Onboarding ${persona} project`,
          reviewFocus: persona,
        });
      } catch (e: any) {
        expect(e.message).not.toContain("Invalid enum value");
      }
    }
  });
});

// ── DB Helper Exports ──
describe("db persona helper exports", () => {
  it("exports updateUserPreferredPersona", async () => {
    const db = await import("./db");
    expect(typeof db.updateUserPreferredPersona).toBe("function");
  });

  it("exports getUserPreferredPersona", async () => {
    const db = await import("./db");
    expect(typeof db.getUserPreferredPersona).toBe("function");
  });
});

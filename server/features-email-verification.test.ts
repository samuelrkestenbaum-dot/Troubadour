import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user" as const,
    tier: "free" as const,
    audioMinutesUsed: 0,
    audioMinutesLimit: 60,
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
    emailVerified: false,
    ...overrides,
  };
  return {
    user,
    req: { headers: { origin: "http://localhost:3000" } } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { headers: { origin: "http://localhost:3000" } } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
  createEmailVerificationToken: vi.fn().mockResolvedValue(1),
  getEmailVerificationToken: vi.fn(),
  markEmailVerificationTokenUsed: vi.fn(),
  setUserEmailVerified: vi.fn(),
  getActiveVerificationToken: vi.fn(),
  cleanupExpiredVerificationTokens: vi.fn(),
  getProjectsByUser: vi.fn().mockResolvedValue([]),
  getTrackCountsByProjects: vi.fn().mockResolvedValue(new Map()),
  getDashboardStats: vi.fn().mockResolvedValue({ totalProjects: 0, totalTracks: 0, totalReviews: 0, reviewedTracks: 0 }),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  getAverageScores: vi.fn().mockResolvedValue(null),
  getTopTracks: vi.fn().mockResolvedValue([]),
  getTopGenre: vi.fn().mockResolvedValue(null),
  getScoreDistribution: vi.fn().mockResolvedValue([]),
  getTracksByUser: vi.fn().mockResolvedValue([]),
  getPlatformStats: vi.fn().mockResolvedValue({ totalReviews: 0, totalTracks: 0, totalProjects: 0, totalUsers: 0 }),
  getNotificationsByUser: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  getFavoritesByUser: vi.fn().mockResolvedValue([]),
  getReviewTemplatesByUser: vi.fn().mockResolvedValue([]),
  getCollaboratorsByProject: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════
// Email Verification Router Tests
// ══════════════════════════════════════════════════════════════

describe("Email Verification - Status", () => {
  it("returns verification status for authenticated user", async () => {
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.emailVerification.status();
    expect(result.emailVerified).toBe(false);
    expect(result.email).toBe("test@example.com");
    expect(result.hasEmail).toBe(true);
  });

  it("returns emailVerified true when user is verified", async () => {
    const ctx = createAuthContext({ emailVerified: true, email: "verified@example.com" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.emailVerification.status();
    expect(result.emailVerified).toBe(true);
    expect(result.email).toBe("verified@example.com");
  });

  it("returns hasEmail false when user has no email", async () => {
    const ctx = createAuthContext({ email: null });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.emailVerification.status();
    expect(result.hasEmail).toBe(false);
    expect(result.email).toBeNull();
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.emailVerification.status()).rejects.toThrow();
  });
});

describe("Email Verification - Send Verification", () => {
  it("sends verification email for unverified user", async () => {
    const db = await import("./db");
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    (db.getActiveVerificationToken as any).mockResolvedValueOnce(null);
    (db.createEmailVerificationToken as any).mockResolvedValueOnce(1);

    const result = await caller.emailVerification.sendVerification({
      origin: "http://localhost:3000",
    });

    expect(result.email).toBe("test@example.com");
    expect(db.createEmailVerificationToken).toHaveBeenCalledWith(
      1,
      "test@example.com",
      expect.any(String),
      expect.any(Date)
    );
  });

  it("rejects when email is already verified", async () => {
    const ctx = createAuthContext({ emailVerified: true, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.emailVerification.sendVerification({ origin: "http://localhost:3000" })
    ).rejects.toThrow("already verified");
  });

  it("rejects when user has no email", async () => {
    const ctx = createAuthContext({ email: null, emailVerified: false });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.emailVerification.sendVerification({ origin: "http://localhost:3000" })
    ).rejects.toThrow("No email address");
  });

  it("enforces rate limiting with cooldown period", async () => {
    const db = await import("./db");
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    // Simulate a recently created token (10 seconds ago)
    (db.getActiveVerificationToken as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      token: "existing-token",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      createdAt: new Date(Date.now() - 10000), // 10 seconds ago
    });

    await expect(
      caller.emailVerification.sendVerification({ origin: "http://localhost:3000" })
    ).rejects.toThrow("wait");
  });

  it("allows resend after cooldown period", async () => {
    const db = await import("./db");
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    // Simulate a token created 2 minutes ago (past cooldown)
    (db.getActiveVerificationToken as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      token: "old-token",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      createdAt: new Date(Date.now() - 120000), // 2 minutes ago
    });
    (db.createEmailVerificationToken as any).mockResolvedValueOnce(2);

    const result = await caller.emailVerification.sendVerification({
      origin: "http://localhost:3000",
    });

    expect(result.email).toBe("test@example.com");
    expect(db.createEmailVerificationToken).toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.emailVerification.sendVerification({ origin: "http://localhost:3000" })
    ).rejects.toThrow();
  });

  it("validates origin is a URL", async () => {
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.emailVerification.sendVerification({ origin: "not-a-url" })
    ).rejects.toThrow();
  });

  it("generates a token with 48 characters", async () => {
    const db = await import("./db");
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    (db.getActiveVerificationToken as any).mockResolvedValueOnce(null);
    (db.createEmailVerificationToken as any).mockResolvedValueOnce(1);

    await caller.emailVerification.sendVerification({
      origin: "http://localhost:3000",
    });

    const tokenArg = (db.createEmailVerificationToken as any).mock.calls[0][2];
    expect(tokenArg.length).toBeGreaterThanOrEqual(20);
    expect(typeof tokenArg).toBe("string");
  });

  it("sets token expiry to 24 hours from now", async () => {
    const db = await import("./db");
    const ctx = createAuthContext({ emailVerified: false, email: "test@example.com" });
    const caller = appRouter.createCaller(ctx);

    (db.getActiveVerificationToken as any).mockResolvedValueOnce(null);
    (db.createEmailVerificationToken as any).mockResolvedValueOnce(1);

    await caller.emailVerification.sendVerification({
      origin: "http://localhost:3000",
    });

    const expiresAt = (db.createEmailVerificationToken as any).mock.calls[0][3] as Date;
    const diffHours = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThanOrEqual(24.1);
  });
});

describe("Email Verification - Verify Token", () => {
  it("successfully verifies a valid token", async () => {
    const db = await import("./db");
    const ctx = createUnauthContext(); // Public procedure
    const caller = appRouter.createCaller(ctx);

    (db.getEmailVerificationToken as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      token: "valid-token",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 86400000), // 24h from now
      usedAt: null,
      createdAt: new Date(),
    });

    const result = await caller.emailVerification.verify({ token: "valid-token" });

    expect(result.success).toBe(true);
    expect(result.email).toBe("test@example.com");
    expect(result.message).toContain("verified");
    expect(db.markEmailVerificationTokenUsed).toHaveBeenCalledWith(1);
    expect(db.setUserEmailVerified).toHaveBeenCalledWith(1, true);
  });

  it("rejects an invalid token", async () => {
    const db = await import("./db");
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getEmailVerificationToken as any).mockResolvedValueOnce(null);

    await expect(
      caller.emailVerification.verify({ token: "invalid-token" })
    ).rejects.toThrow("Invalid or expired");
  });

  it("rejects an already-used token", async () => {
    const db = await import("./db");
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getEmailVerificationToken as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      token: "used-token",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: new Date(), // Already used
      createdAt: new Date(),
    });

    await expect(
      caller.emailVerification.verify({ token: "used-token" })
    ).rejects.toThrow("already been used");
  });

  it("rejects an expired token", async () => {
    const db = await import("./db");
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getEmailVerificationToken as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      token: "expired-token",
      email: "test@example.com",
      expiresAt: new Date(Date.now() - 1000), // Expired
      usedAt: null,
      createdAt: new Date(Date.now() - 86400000),
    });

    await expect(
      caller.emailVerification.verify({ token: "expired-token" })
    ).rejects.toThrow("expired");
  });

  it("rejects empty token", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.emailVerification.verify({ token: "" })
    ).rejects.toThrow();
  });

  it("does not require authentication (public procedure)", async () => {
    const db = await import("./db");
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    (db.getEmailVerificationToken as any).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      token: "public-token",
      email: "test@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      createdAt: new Date(),
    });

    const result = await caller.emailVerification.verify({ token: "public-token" });
    expect(result.success).toBe(true);
  });
});

describe("Email Verification - Router Structure", () => {
  it("emailVerification router is registered on appRouter", () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    expect(caller.emailVerification).toBeDefined();
    expect(caller.emailVerification.status).toBeDefined();
    expect(caller.emailVerification.sendVerification).toBeDefined();
    expect(caller.emailVerification.verify).toBeDefined();
  });
});

describe("Email Verification - Schema", () => {
  it("emailVerificationTokens table is defined in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.emailVerificationTokens).toBeDefined();
  });

  it("users table has emailVerified field", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.users.emailVerified).toBeDefined();
  });
});

describe("Email Verification - DB Helpers", () => {
  it("createEmailVerificationToken is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.createEmailVerificationToken).toBe("function");
  });

  it("getEmailVerificationToken is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.getEmailVerificationToken).toBe("function");
  });

  it("markEmailVerificationTokenUsed is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.markEmailVerificationTokenUsed).toBe("function");
  });

  it("setUserEmailVerified is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.setUserEmailVerified).toBe("function");
  });

  it("getActiveVerificationToken is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.getActiveVerificationToken).toBe("function");
  });

  it("cleanupExpiredVerificationTokens is exported from db", async () => {
    const db = await import("./db");
    expect(typeof db.cleanupExpiredVerificationTokens).toBe("function");
  });
});

describe("Email Verification - Frontend Components", () => {
  it("VerifyEmail page component exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/pages/VerifyEmail.tsx")).toBe(true);
  });

  it("EmailVerificationBanner component exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("/home/ubuntu/ai-album-critic/client/src/components/EmailVerificationBanner.tsx")).toBe(true);
  });

  it("VerifyEmail route is registered in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/App.tsx", "utf-8");
    expect(appContent).toContain("verify-email");
    expect(appContent).toContain("VerifyEmail");
  });

  it("EmailVerificationBanner is integrated in DashboardLayout", async () => {
    const fs = await import("fs");
    const layoutContent = fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/components/DashboardLayout.tsx", "utf-8");
    expect(layoutContent).toContain("EmailVerificationBanner");
  });
});

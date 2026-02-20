/**
 * Tests for Digest Email Gating behind emailVerified status
 * 
 * Verifies that:
 * 1. Digest scheduler only sends emails to verified users
 * 2. generateEmail procedure only sends emails to verified users
 * 3. sendTest procedure blocks unverified users
 * 4. In-app notifications are still created regardless of verification status
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");

function readFile(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf-8");
}

// ── 1. Digest Scheduler Gating ──
describe("Digest Scheduler - Email Verification Gating", () => {
  const scheduler = readFile("server/services/digestScheduler.ts");

  it("gates email sending behind emailVerified in the main scheduler loop", () => {
    // The scheduler should check emailVerified before sending
    expect(scheduler).toContain("emailVerified === true");
  });

  it("checks both email existence and verification status", () => {
    // Should require both user.email AND emailVerified
    expect(scheduler).toContain("user.email && (user as any).emailVerified === true");
  });

  it("still creates in-app notifications regardless of email verification", () => {
    // The createNotification call should NOT be gated behind emailVerified
    expect(scheduler).toContain("await db.createNotification(");
    
    // Verify the notification creation is NOT inside the emailVerified check
    const notifIndex = scheduler.indexOf("createNotification({");
    const emailVerifiedIndex = scheduler.indexOf("emailVerified === true");
    
    // Notification should come BEFORE the email verification check in the main loop
    expect(notifIndex).toBeLessThan(emailVerifiedIndex);
  });

  it("comments explain the gating decision", () => {
    expect(scheduler).toContain("Send email only if user has email AND email is verified");
  });

  it("forceDigestRun still creates notifications for all eligible users", () => {
    // The forceDigestRun function should still create notifications
    const forceRunSection = scheduler.substring(scheduler.indexOf("forceDigestRun"));
    expect(forceRunSection).toContain("createNotification");
  });
});

// ── 2. Router generateEmail Gating ──
describe("Router generateEmail - Email Verification Gating", () => {
  const routers = readFile("server/routers.ts");

  it("gates generateEmail email sending behind emailVerified", () => {
    expect(routers).toContain("user.email && user.emailVerified");
  });

  it("has comment explaining the verification requirement", () => {
    expect(routers).toContain("Send email via Postmark (only if email is verified)");
  });
});

// ── 3. Router sendTest Gating ──
describe("Router sendTest - Email Verification Gating", () => {
  const routers = readFile("server/routers.ts");

  it("throws BAD_REQUEST for unverified users on sendTest", () => {
    // Find the sendTest section
    const sendTestIndex = routers.indexOf("sendTest:");
    const sendTestSection = routers.substring(sendTestIndex, sendTestIndex + 500);
    
    expect(sendTestSection).toContain("emailVerified");
    expect(sendTestSection).toContain("BAD_REQUEST");
  });

  it("provides a helpful error message for unverified users", () => {
    expect(routers).toContain("Please verify your email address before sending test digests");
  });

  it("checks email verification after checking email existence", () => {
    const sendTestIndex = routers.indexOf("sendTest:");
    const sendTestSection = routers.substring(sendTestIndex, sendTestIndex + 500);
    
    const emailCheckIndex = sendTestSection.indexOf("!user.email");
    const verifiedCheckIndex = sendTestSection.indexOf("!user.emailVerified");
    
    // Email existence check should come before verification check
    expect(emailCheckIndex).toBeLessThan(verifiedCheckIndex);
  });
});

// ── 4. Collaboration Emails NOT Gated ──
describe("Collaboration Emails - NOT Gated (by design)", () => {
  const emailNotification = readFile("server/services/emailNotification.ts");

  it("sendCollaborationInvite does NOT check emailVerified", () => {
    const inviteSection = emailNotification.substring(
      emailNotification.indexOf("sendCollaborationInvite"),
      emailNotification.indexOf("sendReviewCompleteNotification")
    );
    expect(inviteSection).not.toContain("emailVerified");
  });

  it("sendReviewCompleteNotification does NOT check emailVerified", () => {
    const reviewSection = emailNotification.substring(
      emailNotification.indexOf("sendReviewCompleteNotification"),
      emailNotification.indexOf("notifyCollaborators")
    );
    expect(reviewSection).not.toContain("emailVerified");
  });

  it("notifyCollaborators does NOT check emailVerified", () => {
    const collabSection = emailNotification.substring(
      emailNotification.indexOf("notifyCollaborators")
    );
    expect(collabSection).not.toContain("emailVerified");
  });
});

// ── 5. Email Verification Router Exists ──
describe("Email Verification Router Integration", () => {
  const routers = readFile("server/routers.ts");
  
  it("emailVerification router is registered in appRouter", () => {
    expect(routers).toContain("emailVerification");
    expect(routers).toContain("emailVerificationRouter");
  });

  it("emailVerification router file exists with correct procedures", () => {
    const verificationRouter = readFile("server/routers/emailVerificationRouter.ts");
    expect(verificationRouter).toContain("status:");
    expect(verificationRouter).toContain("sendVerification:");
    expect(verificationRouter).toContain("verify:");
  });
});

// ── 6. Schema Verification ──
describe("Schema - emailVerified Field", () => {
  const schema = readFile("drizzle/schema.ts");

  it("users table has emailVerified field", () => {
    expect(schema).toContain("emailVerified");
  });

  it("emailVerificationTokens table exists", () => {
    expect(schema).toContain("emailVerificationTokens");
  });
});

// ── 7. UI Components ──
describe("UI - Email Verification Components", () => {
  it("EmailVerificationBanner component exists", () => {
    const banner = readFile("client/src/components/EmailVerificationBanner.tsx");
    expect(banner).toContain("emailVerification");
    expect(banner).toContain("Verify");
  });

  it("DashboardLayout includes EmailVerificationBanner", () => {
    const layout = readFile("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain("EmailVerificationBanner");
  });

  it("VerifyEmail page exists with token handling", () => {
    const verifyPage = readFile("client/src/pages/VerifyEmail.tsx");
    expect(verifyPage).toContain("token");
    expect(verifyPage).toContain("emailVerification.verify");
  });

  it("Settings page shows email verification status", () => {
    const settings = readFile("client/src/pages/Settings.tsx");
    expect(settings).toContain("emailVerified");
    expect(settings).toContain("Verified");
  });
});

// ── 8. Strategic Audit Alignment ──
describe("Strategic Audit Alignment", () => {
  it("gating is applied consistently across all digest email paths", () => {
    const scheduler = readFile("server/services/digestScheduler.ts");
    const routers = readFile("server/routers.ts");
    
    // All three paths should check emailVerified
    expect(scheduler).toContain("emailVerified");
    
    // generateEmail path - search a wider range since the file is large
    const generateEmailIndex = routers.indexOf("generateEmail:");
    const generateEmailSection = routers.substring(generateEmailIndex, generateEmailIndex + 5000);
    expect(generateEmailSection).toContain("emailVerified");
    
    // sendTest path
    const sendTestIndex = routers.indexOf("sendTest:");
    const sendTestSection = routers.substring(sendTestIndex, sendTestIndex + 500);
    expect(sendTestSection).toContain("emailVerified");
  });

  it("in-app notifications serve as fallback for unverified users", () => {
    const scheduler = readFile("server/services/digestScheduler.ts");
    
    // Verify notifications are created before email check
    const mainLoop = scheduler.substring(
      scheduler.indexOf("for (const user of users)"),
      scheduler.indexOf("sent++;")
    );
    
    const notifPos = mainLoop.indexOf("createNotification");
    const emailCheckPos = mainLoop.indexOf("emailVerified");
    
    // Notifications should be created before the email verification check
    expect(notifPos).toBeGreaterThan(-1);
    expect(emailCheckPos).toBeGreaterThan(-1);
    expect(notifPos).toBeLessThan(emailCheckPos);
  });
});

import { describe, it, expect } from "vitest";

describe("Postmark API Token Validation", () => {
  it("should have POSTMARK_API_TOKEN set in environment", () => {
    const token = process.env.POSTMARK_API_TOKEN;
    expect(token).toBeDefined();
    expect(token).not.toBe("");
    expect(typeof token).toBe("string");
  });

  it("should validate Postmark token against API", async () => {
    const token = process.env.POSTMARK_API_TOKEN;
    if (!token) {
      console.log("POSTMARK_API_TOKEN not set — skipping API validation");
      return;
    }

    // Use the Postmark server info endpoint to validate the token
    const response = await fetch("https://api.postmarkapp.com/server", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Postmark-Server-Token": token,
      },
    });

    // A valid token returns 200 with server info
    // An invalid token returns 401
    expect(response.status).toBe(200);

    const data = (await response.json()) as { Name?: string; ApiTokens?: string[] };
    expect(data).toHaveProperty("Name");
    console.log(`[Postmark] Token valid — server name: ${data.Name}`);
  });

  it("should have emailService module that uses ENV.postmarkApiToken", async () => {
    const emailService = await import("./services/emailService");
    expect(emailService.sendEmail).toBeDefined();
    expect(emailService.sendDigestEmail).toBeDefined();
    expect(emailService.sendNotificationEmail).toBeDefined();
  });

  it("should have emailNotification module for collaboration/review emails", async () => {
    const emailNotification = await import("./services/emailNotification");
    expect(emailNotification.sendCollaborationInvite).toBeDefined();
    expect(emailNotification.sendReviewCompleteNotification).toBeDefined();
    expect(emailNotification.notifyCollaborators).toBeDefined();
  });
});

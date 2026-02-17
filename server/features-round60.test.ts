import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Helpers ──
function readFile(name: string) {
  return readFileSync(resolve(__dirname, name), "utf-8");
}
function readClientFile(name: string) {
  return readFileSync(resolve(__dirname, "../client/src", name), "utf-8");
}

describe("Round 60 – Bulk Export, Notification Preferences, Score Timeline", () => {

  // ── Bulk Review Export (ZIP) ──
  describe("Bulk Review Export", () => {
    it("should have exportZip procedure in reviewRouter", () => {
      const code = readFile("routers/reviewRouter.ts");
      expect(code).toContain("exportZip:");
      expect(code).toContain("protectedProcedure");
      expect(code).toContain("archiver");
    });

    it("should accept projectId input for exportZip", () => {
      const code = readFile("routers/reviewRouter.ts");
      expect(code).toContain("projectId: z.number()");
    });

    it("should generate markdown files for each track review", () => {
      const code = readFile("routers/reviewRouter.ts");
      expect(code).toContain("reviewMarkdown");
      expect(code).toContain("Overall Score");
      expect(code).toContain(".md");
    });

    it("should include album review in the ZIP when present", () => {
      const code = readFile("routers/reviewRouter.ts");
      expect(code).toContain("albumReview");
      expect(code).toContain("Album Review");
    });

    it("should upload ZIP to S3 and return URL", () => {
      const code = readFile("routers/reviewRouter.ts");
      expect(code).toContain("storagePut");
      expect(code).toContain("application/zip");
      expect(code).toContain("zipBuffer");
    });

    it("should have ZIP export button in ProjectView", () => {
      const code = readClientFile("pages/ProjectView.tsx");
      expect(code).toContain("exportZip");
      expect(code).toContain("ZIP");
    });

    it("should open ZIP URL in new tab on success", () => {
      const code = readClientFile("pages/ProjectView.tsx");
      expect(code).toContain("window.open(result.url");
      expect(code).toContain("trackCount");
    });
  });

  // ── Notification Preferences ──
  describe("Notification Preferences", () => {
    it("should have notificationPreferences column in users schema", () => {
      const schema = readFileSync(resolve(__dirname, "../drizzle/schema.ts"), "utf-8");
      expect(schema).toContain("notificationPreferences");
      expect(schema).toContain("json(");
    });

    it("should define default notification preferences in db.ts", () => {
      const code = readFile("db.ts");
      expect(code).toContain("DEFAULT_NOTIFICATION_PREFS");
      expect(code).toContain("review_complete: true");
      expect(code).toContain("collaboration_invite: true");
      expect(code).toContain("collaboration_accepted: true");
      expect(code).toContain("digest: true");
      expect(code).toContain("payment_failed: true");
      expect(code).toContain("system: true");
    });

    it("should export getDefaultNotificationPrefs function", () => {
      const code = readFile("db.ts");
      expect(code).toContain("export function getDefaultNotificationPrefs");
    });

    it("should export getNotificationPreferences function", () => {
      const code = readFile("db.ts");
      expect(code).toContain("export async function getNotificationPreferences");
    });

    it("should export updateNotificationPreferences function", () => {
      const code = readFile("db.ts");
      expect(code).toContain("export async function updateNotificationPreferences");
    });

    it("should check user preferences before creating notifications", () => {
      const code = readFile("db.ts");
      const startIdx = code.indexOf("export async function createNotification");
      const section = code.slice(startIdx, startIdx + 600);
      expect(section).toContain("notificationPreferences");
      expect(section).toContain("disabled this notification type");
    });

    it("should merge partial preferences with defaults", () => {
      const code = readFile("db.ts");
      expect(code).toContain("...DEFAULT_NOTIFICATION_PREFS");
    });

    it("should have getPreferences procedure in notification router", () => {
      const code = readFile("routers.ts");
      expect(code).toContain("getPreferences: protectedProcedure");
      expect(code).toContain("getNotificationPreferences");
    });

    it("should have updatePreferences procedure in notification router", () => {
      const code = readFile("routers.ts");
      expect(code).toContain("updatePreferences: protectedProcedure");
      expect(code).toContain("updateNotificationPreferences");
    });

    it("should accept all 6 notification type booleans as optional inputs", () => {
      const code = readFile("routers.ts");
      expect(code).toContain("review_complete: z.boolean().optional()");
      expect(code).toContain("collaboration_invite: z.boolean().optional()");
      expect(code).toContain("collaboration_accepted: z.boolean().optional()");
      expect(code).toContain("digest: z.boolean().optional()");
      expect(code).toContain("payment_failed: z.boolean().optional()");
      expect(code).toContain("system: z.boolean().optional()");
    });
  });

  // ── Notification Preferences UI ──
  describe("Notification Preferences UI", () => {
    it("should have NotificationPreferencesSection component in Settings", () => {
      const code = readClientFile("pages/Settings.tsx");
      expect(code).toContain("NotificationPreferencesSection");
      expect(code).toContain("notification.getPreferences");
      expect(code).toContain("notification.updatePreferences");
    });

    it("should use Switch components for each notification type", () => {
      const code = readClientFile("pages/Settings.tsx");
      expect(code).toContain("Switch");
      expect(code).toContain("onCheckedChange");
    });

    it("should define all 6 notification types with labels and descriptions", () => {
      const code = readClientFile("pages/Settings.tsx");
      expect(code).toContain("NOTIFICATION_TYPES");
      expect(code).toContain("Review Complete");
      expect(code).toContain("Collaboration Invites");
      expect(code).toContain("Collaboration Accepted");
      expect(code).toContain("Weekly Digest");
      expect(code).toContain("Payment Alerts");
      expect(code).toContain("System Updates");
    });

    it("should use optimistic updates for toggle changes", () => {
      const code = readClientFile("pages/Settings.tsx");
      expect(code).toContain("onMutate");
      expect(code).toContain("onError");
      expect(code).toContain("onSettled");
    });

    it("should show loading skeleton while preferences load", () => {
      const code = readClientFile("pages/Settings.tsx");
      expect(code).toContain("animate-pulse");
    });
  });

  // ── Score Timeline (already exists) ──
  describe("Score Timeline (pre-existing)", () => {
    it("should have ScoreLineChart component", () => {
      const code = readClientFile("components/ScoreLineChart.tsx");
      expect(code).toContain("ScoreLineChart");
      expect(code).toContain("DIMENSION_COLORS");
    });

    it("should have ProgressTracker in TrackView", () => {
      const code = readClientFile("pages/TrackView.tsx");
      expect(code).toContain("ProgressTracker");
      expect(code).toContain("scoreHistory");
    });

    it("should show delta between first and latest scores", () => {
      const code = readClientFile("pages/TrackView.tsx");
      expect(code).toContain("overallDelta");
      expect(code).toContain("Score Evolution");
    });
  });

  // ── Test mock user objects include notificationPreferences ──
  describe("Mock user objects updated", () => {
    // Only check files that have actual mock user objects (with lastDigestSentAt as a property value)
    const testFiles = [
      "auth.logout.test.ts",
      "features-round40.test.ts",
      "features-round41.test.ts",
      "features-round42.test.ts",
      "features-round43.test.ts",
      "features-round45.test.ts",
      "features.test.ts",
    ];

    for (const file of testFiles) {
      it(`should include notificationPreferences in ${file} mock users`, () => {
        const code = readFile(file);
        if (code.includes("lastDigestSentAt: null")) {
          expect(code).toContain("notificationPreferences");
        }
      });
    }
  });
});

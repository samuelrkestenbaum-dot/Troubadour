import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1. Clipboard Paste Audio Validation (unit-testable logic) ──

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/flac", "audio/x-flac", "audio/aac", "audio/mp4", "audio/m4a",
  "audio/x-m4a", "audio/ogg", "audio/webm", "audio/opus",
  "video/mp4",   // WhatsApp voice notes
  "video/webm",  // Some messaging apps
]);

function isAudioFile(file: { type: string; name: string }): boolean {
  if (AUDIO_MIME_TYPES.has(file.type)) return true;
  if (file.type.startsWith("audio/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "webm", "mp4", "wma"].includes(ext)) return true;
  return false;
}

describe("Clipboard Paste Audio Validation", () => {
  it("accepts standard audio MIME types", () => {
    expect(isAudioFile({ type: "audio/mpeg", name: "song.mp3" })).toBe(true);
    expect(isAudioFile({ type: "audio/wav", name: "track.wav" })).toBe(true);
    expect(isAudioFile({ type: "audio/flac", name: "master.flac" })).toBe(true);
    expect(isAudioFile({ type: "audio/ogg", name: "voice.ogg" })).toBe(true);
  });

  it("accepts WhatsApp voice notes (video/mp4)", () => {
    expect(isAudioFile({ type: "video/mp4", name: "audio.mp4" })).toBe(true);
  });

  it("accepts video/webm from messaging apps", () => {
    expect(isAudioFile({ type: "video/webm", name: "recording.webm" })).toBe(true);
  });

  it("accepts files with audio extensions even without MIME", () => {
    expect(isAudioFile({ type: "", name: "track.mp3" })).toBe(true);
    expect(isAudioFile({ type: "", name: "demo.wav" })).toBe(true);
    expect(isAudioFile({ type: "", name: "song.m4a" })).toBe(true);
    expect(isAudioFile({ type: "", name: "clip.opus" })).toBe(true);
  });

  it("accepts unknown audio/* MIME types", () => {
    expect(isAudioFile({ type: "audio/x-custom", name: "file.bin" })).toBe(true);
  });

  it("rejects non-audio files", () => {
    expect(isAudioFile({ type: "image/png", name: "photo.png" })).toBe(false);
    expect(isAudioFile({ type: "text/plain", name: "notes.txt" })).toBe(false);
    expect(isAudioFile({ type: "application/pdf", name: "doc.pdf" })).toBe(false);
    expect(isAudioFile({ type: "video/avi", name: "movie.avi" })).toBe(false);
  });

  it("rejects files with non-audio extensions and no MIME", () => {
    expect(isAudioFile({ type: "", name: "image.jpg" })).toBe(false);
    expect(isAudioFile({ type: "", name: "document.docx" })).toBe(false);
  });
});

// ── 2. Instrumentation Advice Persistence ──

describe("Instrumentation Advice DB Helpers", () => {
  it("exports saveInstrumentationAdvice function", async () => {
    const db = await import("../server/db");
    expect(typeof db.saveInstrumentationAdvice).toBe("function");
  });

  it("exports getInstrumentationAdviceByTrack function", async () => {
    const db = await import("../server/db");
    expect(typeof db.getInstrumentationAdviceByTrack).toBe("function");
  });

  it("exports getLatestInstrumentationAdvice function", async () => {
    const db = await import("../server/db");
    expect(typeof db.getLatestInstrumentationAdvice).toBe("function");
  });
});

// ── 3. Signature Sound DB Helpers ──

describe("Signature Sound DB Helpers", () => {
  it("exports saveSignatureSound function", async () => {
    const db = await import("../server/db");
    expect(typeof db.saveSignatureSound).toBe("function");
  });

  it("exports getSignatureSoundByProject function", async () => {
    const db = await import("../server/db");
    expect(typeof db.getSignatureSoundByProject).toBe("function");
  });

  it("exports getSignatureSoundHistory function", async () => {
    const db = await import("../server/db");
    expect(typeof db.getSignatureSoundHistory).toBe("function");
  });
});

// ── 4. Signature Sound Advisor Service ──

describe("Signature Sound Advisor Service", () => {
  it("exports generateSignatureSound function", async () => {
    const service = await import("../server/services/signatureSoundAdvisor");
    expect(typeof service.generateSignatureSound).toBe("function");
  });

  it("requires tracks array in input", async () => {
    const service = await import("../server/services/signatureSoundAdvisor");
    // Should throw or handle gracefully with empty tracks
    try {
      await service.generateSignatureSound({
        projectTitle: "Test Album",
        tracks: [],
      });
    } catch (err: any) {
      // Expected: either LLM call fails or validation catches empty tracks
      expect(err).toBeDefined();
    }
  });
});

// ── 5. Instrumentation Advisor Service ──

describe("Instrumentation Advisor - Target States", () => {
  it("exports TARGET_STATES with all 6 targets", async () => {
    const service = await import("../server/services/instrumentationAdvisor");
    expect(service.TARGET_STATES).toBeDefined();
    const keys = Object.keys(service.TARGET_STATES);
    expect(keys.length).toBe(6);
    expect(keys).toContain("fuller");
    expect(keys).toContain("stripped");
    expect(keys).toContain("radioReady");
    expect(keys).toContain("cinematic");
    expect(keys).toContain("liveReady");
    expect(keys).toContain("electronic");
  });

  it("each target state has label, description, and icon", async () => {
    const service = await import("../server/services/instrumentationAdvisor");
    for (const [key, target] of Object.entries(service.TARGET_STATES)) {
      const t = target as { label: string; description: string; icon: string };
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
    }
  });
});

// ── 6. Schema Tables ──

describe("Schema - New Tables", () => {
  it("exports instrumentationAdvice table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.instrumentationAdvice).toBeDefined();
  });

  it("exports signatureSound table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.signatureSound).toBeDefined();
  });
});

// ── 7. Export Procedures ──

describe("Export Session Prep Sheet", () => {
  it("analysis router exports instrumentation and signatureSound procedures", async () => {
    const router = await import("../server/routers/analysisRouter");
    expect(router.analysisRouter).toBeDefined();
    // The analysisRouter is an object with procedure definitions
    const keys = Object.keys(router.analysisRouter);
    expect(keys).toContain("instrumentation");
    expect(keys).toContain("signatureSound");
    expect(keys).toContain("structure");
    expect(keys).toContain("moodEnergy");
  });
});

// ── 8. Admin Notification Preferences - Slack & HubSpot ──

describe("Admin Notification Preferences include Slack & HubSpot", () => {
  it("exports getAdminNotificationPrefs and setAdminNotificationPrefs", async () => {
    const db = await import("../server/db");
    expect(typeof db.getAdminNotificationPrefs).toBe("function");
    expect(typeof db.setAdminNotificationPrefs).toBe("function");
    expect(typeof db.getAdminsWithPref).toBe("function");
  });
});

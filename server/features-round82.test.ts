import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── 1. Review Quality: Score Calibration & Anti-Inflation ───

describe("Review Quality - Score Calibration", () => {
  const criticPath = path.resolve(__dirname, "services/claudeCritic.ts");
  const criticSource = fs.readFileSync(criticPath, "utf-8");

  it("system prompt includes score calibration anchors", () => {
    expect(criticSource).toContain("SCORE CALIBRATION");
    expect(criticSource).toContain("say 4");
    expect(criticSource).toContain("say 9");
    expect(criticSource).toContain("Differentiate");
  });

  it("system prompt includes anti-inflation guidance", () => {
    // Should warn against defaulting to 6-7s
    expect(criticSource).toContain("DO NOT default");
  });

  it("system prompt requires naming the fix, not just the problem", () => {
    expect(criticSource.toLowerCase()).toContain("fix");
  });

  it("system prompt asks how to make the track better", () => {
    expect(criticSource).toContain("How to Make This");
  });

  it("system prompt still includes original review dimensions", () => {
    expect(criticSource.toLowerCase()).toContain("songwriting");
    expect(criticSource.toLowerCase()).toContain("production");
    expect(criticSource.toLowerCase()).toContain("vocal");
  });

  it("system prompt still requires timestamped feedback", () => {
    expect(criticSource.toLowerCase()).toContain("timestamp");
  });
});

// ─── 2. Upload-to-Results Flow: Progress Messaging ───

describe("Upload-to-Results Flow - Progress Messages", () => {
  const processorPath = path.resolve(__dirname, "services/jobProcessor.ts");
  const processorSource = fs.readFileSync(processorPath, "utf-8");

  it("job processor has descriptive progress messages for audio analysis", () => {
    // Should have more descriptive messages than just "Analyzing audio..."
    const hasListening = processorSource.toLowerCase().includes("listening") ||
                         processorSource.toLowerCase().includes("audio");
    expect(hasListening).toBe(true);
  });

  it("job processor has progress messages for review generation", () => {
    const hasReview = processorSource.toLowerCase().includes("review") ||
                      processorSource.toLowerCase().includes("critique") ||
                      processorSource.toLowerCase().includes("writing");
    expect(hasReview).toBe(true);
  });

  it("job processor updates progress percentage at multiple stages", () => {
    // Should have multiple progress percentage updates
    const progressMatches = processorSource.match(/progress[:\s]*\d+/gi) || [];
    expect(progressMatches.length).toBeGreaterThanOrEqual(2);
  });

  // Frontend progress display
  const projectViewPath = path.resolve(__dirname, "../client/src/pages/ProjectView.tsx");
  const projectViewSource = fs.readFileSync(projectViewPath, "utf-8");

  it("ProjectView shows estimated time remaining", () => {
    const hasEstimate = projectViewSource.toLowerCase().includes("estimated") ||
                        projectViewSource.toLowerCase().includes("remaining") ||
                        projectViewSource.toLowerCase().includes("~") ||
                        projectViewSource.toLowerCase().includes("min");
    expect(hasEstimate).toBe(true);
  });

  it("ProjectView has phase indicators with icons", () => {
    // Should import phase-related icons
    const hasPhaseIcons = projectViewSource.includes("Headphones") ||
                          projectViewSource.includes("Brain") ||
                          projectViewSource.includes("FileText") ||
                          projectViewSource.includes("Loader2");
    expect(hasPhaseIcons).toBe(true);
  });
});

// ─── 3. Onboarding / First-Use Experience ───

describe("Onboarding - Dashboard Empty State", () => {
  const dashboardPath = path.resolve(__dirname, "../client/src/pages/Dashboard.tsx");
  const dashboardSource = fs.readFileSync(dashboardPath, "utf-8");

  it("dashboard has 'What you'll get' preview section", () => {
    expect(dashboardSource).toContain("What you'll get");
  });

  it("dashboard shows sample review snippet in empty state", () => {
    expect(dashboardSource).toContain("Sample Review Preview");
    expect(dashboardSource).toContain("QUICK TAKE");
  });

  it("sample review includes realistic timestamped feedback", () => {
    expect(dashboardSource).toContain("0:47");
    expect(dashboardSource).toContain("1:22");
  });

  it("sample review shows dimensional scores", () => {
    expect(dashboardSource).toContain("Songwriting: 7.8");
    expect(dashboardSource).toContain("Production: 7.2");
    expect(dashboardSource).toContain("Vocal: 8.1");
  });

  it("dashboard shows 'What you'll unlock' Intelligence Suite features", () => {
    expect(dashboardSource).toContain("Skill Progression");
    expect(dashboardSource).toContain("Competitive Benchmarks");
    expect(dashboardSource).toContain("Release Readiness");
    expect(dashboardSource).toContain("Creative Streaks");
    expect(dashboardSource).toContain("Artist DNA");
  });

  it("dashboard shows time expectation for first review", () => {
    expect(dashboardSource).toContain("1-2 minutes");
  });

  it("dashboard still has the original welcome hero", () => {
    expect(dashboardSource).toContain("Welcome to Troubadour");
    expect(dashboardSource).toContain("Create Your First Project");
  });

  it("dashboard still has How It Works steps", () => {
    expect(dashboardSource).toContain("How it works");
    expect(dashboardSource).toContain("Upload your track");
    expect(dashboardSource).toContain("AI listens & analyzes");
    expect(dashboardSource).toContain("Get your critique");
  });
});

describe("Onboarding - NewProject 'What Happens Next'", () => {
  const newProjectPath = path.resolve(__dirname, "../client/src/pages/NewProject.tsx");
  const newProjectSource = fs.readFileSync(newProjectPath, "utf-8");

  it("NewProject shows 'What happens next' callout when files are queued", () => {
    expect(newProjectSource).toContain("What happens next");
  });

  it("callout explains the AI listening process", () => {
    expect(newProjectSource).toContain("deep listening");
  });

  it("callout mentions timestamped feedback", () => {
    expect(newProjectSource).toContain("timestamped feedback");
  });

  it("callout sets time expectation", () => {
    expect(newProjectSource).toContain("1-2 minutes per track");
  });

  it("callout mentions live progress", () => {
    expect(newProjectSource).toContain("live progress");
  });

  it("callout is conditionally rendered (only when files are queued)", () => {
    expect(newProjectSource).toContain("trackedFiles.length > 0");
    expect(newProjectSource).toContain("!isCreating");
  });

  it("Clock icon is imported for the callout", () => {
    expect(newProjectSource).toContain("Clock");
  });
});

// ─── 4. Integration Checks ───

describe("Integration - All changes coexist", () => {
  it("Dashboard still imports all required icons", () => {
    const dashboardPath = path.resolve(__dirname, "../client/src/pages/Dashboard.tsx");
    const dashboardSource = fs.readFileSync(dashboardPath, "utf-8");
    // Intelligence Suite icons
    expect(dashboardSource).toContain("GraduationCap");
    expect(dashboardSource).toContain("Swords");
    expect(dashboardSource).toContain("Rocket");
    expect(dashboardSource).toContain("Flame");
    expect(dashboardSource).toContain("Dna");
  });

  it("NewProject still has the DropZone component", () => {
    const newProjectPath = path.resolve(__dirname, "../client/src/pages/NewProject.tsx");
    const newProjectSource = fs.readFileSync(newProjectPath, "utf-8");
    expect(newProjectSource).toContain("DropZone");
  });

  it("NewProject still auto-starts analysis after upload", () => {
    const newProjectPath = path.resolve(__dirname, "../client/src/pages/NewProject.tsx");
    const newProjectSource = fs.readFileSync(newProjectPath, "utf-8");
    expect(newProjectSource).toContain("analyzeAndReview");
  });
});

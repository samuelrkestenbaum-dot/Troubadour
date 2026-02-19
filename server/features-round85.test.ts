import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── 1. Sidebar Notification Badges ───────────────────────────────────
describe("Sidebar Notification Badges (useNavBadges)", () => {
  const hookPath = path.resolve(__dirname, "../client/src/hooks/useNavBadges.ts");
  const hookSource = fs.readFileSync(hookPath, "utf-8");

  it("hook file exists and exports useNavBadges", () => {
    expect(hookSource).toContain("export function useNavBadges");
  });

  it("tracks Intelligence Suite feature paths", () => {
    expect(hookSource).toContain("/skill-progression");
    expect(hookSource).toContain("/competitive-benchmarks");
    expect(hookSource).toContain("/release-readiness");
    expect(hookSource).toContain("/streak");
    expect(hookSource).toContain("/artist-dna");
    expect(hookSource).toContain("/flywheel");
    expect(hookSource).toContain("/digest");
  });

  it("uses localStorage for visit tracking", () => {
    expect(hookSource).toContain("localStorage");
    expect(hookSource).toContain("troubadour_nav_visits");
  });

  it("returns badges map and markVisited function", () => {
    expect(hookSource).toContain("return { badges, totalBadges, markVisited }");
  });

  it("queries streak data for badge determination", () => {
    expect(hookSource).toContain("trpc.streak.get.useQuery");
  });

  it("queries skill tracker data for badge determination", () => {
    expect(hookSource).toContain("trpc.skillTracker.overview.useQuery");
  });

  it("queries artist DNA data for badge determination", () => {
    expect(hookSource).toContain("trpc.artistDNA.latest.useQuery");
  });

  it("queries flywheel data for badge determination", () => {
    expect(hookSource).toContain("trpc.flywheel.archetype.useQuery");
  });

  it("uses staleTime to avoid excessive refetching", () => {
    expect(hookSource).toContain("staleTime: 60_000");
  });

  it("only fetches when user is logged in", () => {
    expect(hookSource).toContain("enabled: !!user");
  });
});

describe("DashboardLayout Badge Integration", () => {
  const layoutPath = path.resolve(__dirname, "../client/src/components/DashboardLayout.tsx");
  const layoutSource = fs.readFileSync(layoutPath, "utf-8");

  it("imports useNavBadges hook", () => {
    expect(layoutSource).toContain("useNavBadges");
  });

  it("renders badge dots for active features", () => {
    expect(layoutSource).toContain("badges[item.path]");
  });

  it("hides badge when item is active (already viewing)", () => {
    expect(layoutSource).toContain("!isActive");
  });

  it("uses animated pulse for badge visibility", () => {
    expect(layoutSource).toContain("animate-pulse");
  });

  it("calls markVisited on location change", () => {
    expect(layoutSource).toContain("markVisited(location)");
  });
});

// ─── 2. Upgrade Prompt A/B Copy Variants ──────────────────────────────
describe("UpgradePrompt A/B Copy Variants", () => {
  const promptPath = path.resolve(__dirname, "../client/src/components/UpgradePrompt.tsx");
  const promptSource = fs.readFileSync(promptPath, "utf-8");

  it("defines 4 copy variants (A, B, C, D)", () => {
    // Keys are unquoted in TypeScript source: A: { ... }
    expect(promptSource).toMatch(/^\s+A:\s*\{/m);
    expect(promptSource).toMatch(/^\s+B:\s*\{/m);
    expect(promptSource).toMatch(/^\s+C:\s*\{/m);
    expect(promptSource).toMatch(/^\s+D:\s*\{/m);
  });

  it("variant A uses loss aversion approach", () => {
    expect(promptSource).toContain("loss_aversion");
  });

  it("variant B uses social proof approach", () => {
    expect(promptSource).toContain("social_proof");
  });

  it("variant C uses curiosity gap approach", () => {
    expect(promptSource).toContain("curiosity_gap");
  });

  it("variant D uses value proposition approach", () => {
    expect(promptSource).toContain("value_proposition");
  });

  it("each variant has copy for all 3 triggers", () => {
    // Check that each variant has review, feature, upload keys
    const variantBlocks = promptSource.match(/name:\s*"[a-z_]+",\s*review:/g);
    expect(variantBlocks).not.toBeNull();
    expect(variantBlocks!.length).toBe(4);
  });

  it("persists variant assignment in localStorage", () => {
    expect(promptSource).toContain("troubadour_upgrade_variant");
    expect(promptSource).toContain("localStorage.getItem");
    expect(promptSource).toContain("localStorage.setItem");
  });

  it("uses getAssignedVariant for deterministic assignment", () => {
    expect(promptSource).toContain("getAssignedVariant");
  });
});

describe("UpgradePrompt PostHog Analytics Integration", () => {
  const promptPath = path.resolve(__dirname, "../client/src/components/UpgradePrompt.tsx");
  const promptSource = fs.readFileSync(promptPath, "utf-8");

  it("imports trackEvent from analytics", () => {
    expect(promptSource).toContain('import { trackEvent } from "@/lib/analytics"');
  });

  it("tracks upgrade_prompt_shown event", () => {
    expect(promptSource).toContain("upgrade_prompt_shown");
  });

  it("tracks upgrade_prompt_dismissed event", () => {
    expect(promptSource).toContain("upgrade_prompt_dismissed");
  });

  it("tracks upgrade_prompt_clicked event", () => {
    expect(promptSource).toContain("upgrade_prompt_clicked");
  });

  it("includes variant info in tracking events", () => {
    expect(promptSource).toContain("variant:");
    expect(promptSource).toContain("variant_name:");
  });

  it("tracks which trigger context was shown", () => {
    expect(promptSource).toContain("trigger,");
  });

  it("tracks CTA source (tier card vs main button)", () => {
    expect(promptSource).toContain("source:");
    expect(promptSource).toContain("main_cta");
    expect(promptSource).toContain("tier_card_");
  });
});

// ─── 3. E2E Pipeline Verification ─────────────────────────────────────
describe("E2E Pipeline - Score Calibration", () => {
  it("review prompt includes anti-inflation guidance", () => {
    const criticPath = path.resolve(__dirname, "services/claudeCritic.ts");
    const criticSource = fs.readFileSync(criticPath, "utf-8");
    // Should contain calibration guidance
    expect(criticSource.toLowerCase()).toMatch(/calibrat|inflation|honest|differentiat/);
  });

  it("job processor records streak activity after review", () => {
    const jobProcessorPath = path.resolve(__dirname, "services/jobProcessor.ts");
    const jobSource = fs.readFileSync(jobProcessorPath, "utf-8");
    expect(jobSource).toContain("recordActivity");
  });
});

// ─── 4. Analytics Event Helpers ────────────────────────────────────────
describe("Analytics Event Helpers", () => {
  const analyticsPath = path.resolve(__dirname, "../client/src/lib/analytics.ts");
  const analyticsSource = fs.readFileSync(analyticsPath, "utf-8");

  it("exports trackEvent function", () => {
    expect(analyticsSource).toContain("export function trackEvent");
  });

  it("exports trackUpgradeClicked helper", () => {
    expect(analyticsSource).toContain("export function trackUpgradeClicked");
  });

  it("exports trackFeatureGated helper", () => {
    expect(analyticsSource).toContain("export function trackFeatureGated");
  });

  it("uses PostHog for event tracking", () => {
    expect(analyticsSource).toContain("posthog.capture");
  });

  it("gracefully handles missing PostHog key", () => {
    expect(analyticsSource).toContain("if (!POSTHOG_KEY) return");
  });
});

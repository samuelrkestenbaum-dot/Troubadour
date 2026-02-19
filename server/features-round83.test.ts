import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─── 1. Free Tier Limit: 1 Review Per Month ───

describe("Free Tier - 1 Review Per Month", () => {
  const productsPath = path.resolve(__dirname, "stripe/products.ts");
  const productsSource = fs.readFileSync(productsPath, "utf-8");

  it("free tier monthlyReviewLimit is set to 1", () => {
    // Match the free tier block and its monthlyReviewLimit
    const freeBlock = productsSource.match(/free:\s*\{[\s\S]*?monthlyReviewLimit:\s*(\d+)/);
    expect(freeBlock).not.toBeNull();
    expect(freeBlock![1]).toBe("1");
  });

  it("paid tiers have higher review limits", () => {
    // Artist and Pro should have much higher limits
    const artistBlock = productsSource.match(/artist:\s*\{[\s\S]*?monthlyReviewLimit:\s*(\d+)/);
    const proBlock = productsSource.match(/pro:\s*\{[\s\S]*?monthlyReviewLimit:\s*(\d+)/);
    expect(artistBlock).not.toBeNull();
    expect(proBlock).not.toBeNull();
    expect(Number(artistBlock![1])).toBeGreaterThan(1);
    expect(Number(proBlock![1])).toBeGreaterThan(1);
  });
});

// ─── 2. Settings Page: Shows 1/month for Free Tier ───

describe("Settings Page - Free Tier Display", () => {
  const settingsPath = path.resolve(__dirname, "../client/src/pages/Settings.tsx");
  const settingsSource = fs.readFileSync(settingsPath, "utf-8");

  it("displays '1/month' for free tier reviews", () => {
    expect(settingsSource).toContain('1/month');
  });

  it("does not display outdated '3/month' text", () => {
    expect(settingsSource).not.toContain('3/month');
  });

  it("displays 'Unlimited' for paid tiers", () => {
    expect(settingsSource).toContain("Unlimited");
  });
});

// ─── 3. Upgrade Prompt Component ───

describe("UpgradePrompt Component", () => {
  const promptPath = path.resolve(__dirname, "../client/src/components/UpgradePrompt.tsx");
  const promptSource = fs.readFileSync(promptPath, "utf-8");

  it("exports UpgradePrompt component", () => {
    expect(promptSource).toContain("export function UpgradePrompt");
  });

  it("exports useUpgradePrompt hook", () => {
    expect(promptSource).toContain("export function useUpgradePrompt");
  });

  it("has trigger types for review, feature, and upload", () => {
    expect(promptSource).toContain('"review"');
    expect(promptSource).toContain('"feature"');
    expect(promptSource).toContain('"upload"');
  });

  it("shows contextual headlines based on trigger type via A/B variants", () => {
    // Each variant has review, feature, upload copy sets
    expect(promptSource).toContain("review:");
    expect(promptSource).toContain("feature:");
    expect(promptSource).toContain("upload:");
    // Headlines are dynamic via copy.headline
    expect(promptSource).toContain("copy.headline");
  });

  it("includes Artist and Pro tier options", () => {
    expect(promptSource).toContain("Artist");
    expect(promptSource).toContain("Pro");
  });

  it("navigates to pricing page on plan selection", () => {
    expect(promptSource).toContain('navigate("/pricing")');
  });

  it("has dismiss functionality", () => {
    expect(promptSource).toContain("onDismiss");
    expect(promptSource).toContain("handleDismiss");
    expect(promptSource).toContain("Maybe later");
  });

  it("shows Intelligence Suite features in tier highlights", () => {
    expect(promptSource).toContain("Skill Progression");
    expect(promptSource).toContain("Competitive Benchmarking");
    expect(promptSource).toContain("Release Readiness");
    expect(promptSource).toContain("Artist DNA");
  });
});

// ─── 4. UpgradePrompt Wired into ProjectView and TrackView ───

describe("UpgradePrompt Integration", () => {
  const projectViewPath = path.resolve(__dirname, "../client/src/pages/ProjectView.tsx");
  const trackViewPath = path.resolve(__dirname, "../client/src/pages/TrackView.tsx");
  const projectViewSource = fs.readFileSync(projectViewPath, "utf-8");
  const trackViewSource = fs.readFileSync(trackViewPath, "utf-8");

  it("ProjectView imports UpgradePrompt and useUpgradePrompt", () => {
    expect(projectViewSource).toContain("UpgradePrompt");
    expect(projectViewSource).toContain("useUpgradePrompt");
  });

  it("ProjectView renders UpgradePrompt conditionally", () => {
    expect(projectViewSource).toContain("upgradeProps && <UpgradePrompt");
  });

  it("TrackView imports UpgradePrompt and useUpgradePrompt", () => {
    expect(trackViewSource).toContain("UpgradePrompt");
    expect(trackViewSource).toContain("useUpgradePrompt");
  });

  it("TrackView renders UpgradePrompt conditionally", () => {
    expect(trackViewSource).toContain("upgradeProps && <UpgradePrompt");
  });
});

// ─── 5. Digest Preview Procedure ───

describe("Digest Preview Procedure", () => {
  const routersPath = path.resolve(__dirname, "routers.ts");
  const routersSource = fs.readFileSync(routersPath, "utf-8");

  it("has a preview procedure in the digest router", () => {
    expect(routersSource).toContain("preview: protectedProcedure");
  });

  it("preview procedure returns htmlContent", () => {
    // The preview procedure should return an object with htmlContent
    expect(routersSource).toContain("return { htmlContent");
  });

  it("preview procedure includes streak data section", () => {
    expect(routersSource).toContain("getStreakInfo");
    expect(routersSource).toContain("Day Streak");
  });

  it("preview procedure includes skill progression data", () => {
    expect(routersSource).toContain("getSkillProgressionOverview");
    expect(routersSource).toContain("Skill Growth");
  });

  it("preview procedure generates HTML without sending email", () => {
    // The preview procedure should NOT call sendDigestEmail
    const previewBlock = routersSource.match(/preview:\s*protectedProcedure[\s\S]*?return \{ htmlContent/);
    expect(previewBlock).not.toBeNull();
    expect(previewBlock![0]).not.toContain("sendDigestEmail");
  });

  it("preview procedure is a query (not mutation)", () => {
    // Preview should be a query since it doesn't modify state
    expect(routersSource).toContain("preview: protectedProcedure\n      .query");
  });
});

// ─── 6. Digest Preview UI in Settings Page ───

describe("Digest Preview UI - Settings Page", () => {
  const settingsPath = path.resolve(__dirname, "../client/src/pages/Settings.tsx");
  const settingsSource = fs.readFileSync(settingsPath, "utf-8");

  it("has a Preview button in the digest section", () => {
    expect(settingsSource).toContain("Preview");
    expect(settingsSource).toContain("Eye");
  });

  it("imports Eye icon from lucide-react", () => {
    expect(settingsSource).toMatch(/import.*Eye.*from "lucide-react"/);
  });

  it("uses trpc.digest.preview query", () => {
    expect(settingsSource).toContain("trpc.digest.preview.useQuery");
  });

  it("has a preview modal with iframe for HTML rendering", () => {
    expect(settingsSource).toContain("srcDoc={previewQuery.data.htmlContent}");
    expect(settingsSource).toContain("Digest Preview");
  });

  it("preview modal has loading state", () => {
    expect(settingsSource).toContain("Generating preview...");
  });

  it("preview modal has error state", () => {
    expect(settingsSource).toContain("Failed to load preview");
  });

  it("preview modal has 'Send This to My Email' action", () => {
    expect(settingsSource).toContain("Send This to My Email");
  });

  it("preview query is only enabled when modal is open", () => {
    expect(settingsSource).toContain("enabled: showPreview");
  });
});

// ─── 7. Pricing Page Free Tier Display ───

describe("Pricing Page - Free Tier Limit", () => {
  const pricingPath = path.resolve(__dirname, "../client/src/pages/Pricing.tsx");
  
  it("pricing page exists", () => {
    expect(fs.existsSync(pricingPath)).toBe(true);
  });

  it("pricing page shows 1 review for free tier", () => {
    const pricingSource = fs.readFileSync(pricingPath, "utf-8");
    expect(pricingSource).toContain("1 AI review");
  });

  it("pricing page does not show outdated 3 reviews for free tier", () => {
    const pricingSource = fs.readFileSync(pricingPath, "utf-8");
    expect(pricingSource).not.toContain("3 AI review");
  });
});

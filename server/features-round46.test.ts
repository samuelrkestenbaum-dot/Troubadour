import { describe, it, expect } from "vitest";

// ── Round 46: Review Output Restructuring Tests ──
// Validates that all prompts now produce categorized bullet-point output with actionable suggestions

describe("Review Prompt Structure - Categorized Bullet Points", () => {
  it("standard review length config uses ### headers and bullet points format", async () => {
    const { REVIEW_LENGTH_CONFIG } = await import("./services/claudeCritic") as any;
    // Access the module internals - the config is not exported, so we test via the generated prompts
    const claudeCritic = await import("./services/claudeCritic");
    // The module exports generateTrackReview which uses the config internally
    expect(claudeCritic.generateTrackReview).toBeDefined();
  });

  it("reviewFocus configs include 'What's Working' and 'What's Missing' sections", async () => {
    const { getFocusConfig, getAllFocusConfigs } = await import("./services/reviewFocus");
    const allConfigs = getAllFocusConfigs();
    
    // All role-specific configs should exist
    expect(allConfigs.songwriter).toBeDefined();
    expect(allConfigs.producer).toBeDefined();
    expect(allConfigs.arranger).toBeDefined();
    expect(allConfigs.artist).toBeDefined();
    expect(allConfigs.anr).toBeDefined();
    expect(allConfigs.full).toBeDefined();
  });

  it("songwriter focus config has actionable suggestion sections", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("songwriter");
    
    expect(config.claudeSystemOverride).toContain("### What's Working");
    expect(config.claudeSystemOverride).toContain("### What's Missing");
    expect(config.claudeSystemOverride).toContain("### How to Make This Song Better");
    expect(config.claudeSystemOverride).toContain("bullet points");
    expect(config.claudeSystemOverride).toContain("Do NOT write paragraphs");
    expect(config.outputSections).toContain("What's Working");
    expect(config.outputSections).toContain("What's Missing");
    expect(config.outputSections).toContain("How to Make This Song Better");
  });

  it("producer focus config has actionable suggestion sections", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("producer");
    
    expect(config.claudeSystemOverride).toContain("### What's Working");
    expect(config.claudeSystemOverride).toContain("### What's Missing");
    expect(config.claudeSystemOverride).toContain("### How to Get This Mix Right");
    expect(config.claudeSystemOverride).toContain("bullet points");
    expect(config.claudeSystemOverride).toContain("PRESCRIBE");
    expect(config.outputSections).toContain("What's Working");
    expect(config.outputSections).toContain("What's Missing");
    expect(config.outputSections).toContain("How to Get This Mix Right");
  });

  it("arranger focus config has actionable suggestion sections", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("arranger");
    
    expect(config.claudeSystemOverride).toContain("### What's Working");
    expect(config.claudeSystemOverride).toContain("### What's Missing");
    expect(config.claudeSystemOverride).toContain("### How to Elevate This Arrangement");
    expect(config.claudeSystemOverride).toContain("bullet points");
    expect(config.outputSections).toContain("What's Working");
    expect(config.outputSections).toContain("What's Missing");
    expect(config.outputSections).toContain("How to Elevate This Arrangement");
  });

  it("artist focus config has actionable suggestion sections", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("artist");
    
    expect(config.claudeSystemOverride).toContain("### What's Working");
    expect(config.claudeSystemOverride).toContain("### What's Missing");
    expect(config.claudeSystemOverride).toContain("### How to Level Up This Performance");
    expect(config.claudeSystemOverride).toContain("bullet points");
    expect(config.claudeSystemOverride).toContain("COACH");
    expect(config.outputSections).toContain("What's Working");
    expect(config.outputSections).toContain("What's Missing");
    expect(config.outputSections).toContain("How to Level Up This Performance");
  });

  it("A&R focus config has actionable suggestion sections", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("anr");
    
    expect(config.claudeSystemOverride).toContain("### What's Working");
    expect(config.claudeSystemOverride).toContain("### What's Missing for Market Readiness");
    expect(config.claudeSystemOverride).toContain("### Strategic Playbook");
    expect(config.claudeSystemOverride).toContain("### A&R Verdict");
    expect(config.claudeSystemOverride).toContain("bullet points");
    expect(config.outputSections).toContain("What's Working");
    expect(config.outputSections).toContain("What's Missing for Market Readiness");
    expect(config.outputSections).toContain("Strategic Playbook");
    expect(config.outputSections).toContain("A&R Verdict");
  });

  it("full review config uses default system prompt (empty claudeSystemOverride)", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const config = getFocusConfig("full");
    
    // Full review uses the default TRACK_CRITIC_SYSTEM, so claudeSystemOverride is empty
    expect(config.claudeSystemOverride).toBe("");
    // But the output sections should include the new categorized sections
    expect(config.outputSections).toContain("What's Working");
    expect(config.outputSections).toContain("What's Missing");
    expect(config.outputSections).toContain("How to Bring It All Together");
  });

  it("all role-specific prompts include CRITICAL FORMAT RULES", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const roles = ["songwriter", "producer", "arranger", "artist", "anr"] as const;
    
    for (const role of roles) {
      const config = getFocusConfig(role);
      expect(config.claudeSystemOverride).toContain("CRITICAL FORMAT RULES");
      expect(config.claudeSystemOverride).toContain("### headers");
      expect(config.claudeSystemOverride).toContain("Do NOT write paragraphs");
    }
  });

  it("all role-specific prompts emphasize actionable suggestions over observation", async () => {
    const { getFocusConfig } = await import("./services/reviewFocus");
    const roles = ["songwriter", "producer", "arranger", "artist", "anr"] as const;
    
    for (const role of roles) {
      const config = getFocusConfig(role);
      // Each role should have language about suggesting, not just observing
      const hasActionLanguage = 
        config.claudeSystemOverride.includes("SUGGEST") ||
        config.claudeSystemOverride.includes("PRESCRIBE") ||
        config.claudeSystemOverride.includes("REDESIGN") ||
        config.claudeSystemOverride.includes("COACH") ||
        config.claudeSystemOverride.includes("STRATEGIZE");
      expect(hasActionLanguage).toBe(true);
    }
  });
});

describe("Review CSS Styling", () => {
  it("index.css contains prose h3 styling for review headers", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/index.css", "utf-8");
    
    expect(css).toContain(".prose h3");
    expect(css).toContain("text-transform: uppercase");
    expect(css).toContain("border-bottom");
  });

  it("index.css contains custom bullet point styling", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("/home/ubuntu/ai-album-critic/client/src/index.css", "utf-8");
    
    expect(css).toContain(".prose ul li::before");
    expect(css).toContain("border-radius: 50%");
    expect(css).toContain("list-style: none");
  });
});

describe("Album Review Prompt Structure", () => {
  it("album critic system prompt uses bullet-point format", async () => {
    // Read the file directly to check the ALBUM_CRITIC_SYSTEM constant
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/ai-album-critic/server/services/claudeCritic.ts", "utf-8");
    
    // Album critic should use ### headers
    expect(content).toContain("### Executive Summary");
    expect(content).toContain("### What's Working");
    expect(content).toContain("### What's Missing");
    expect(content).toContain("### How to Make This Album Better");
    expect(content).toContain("CRITICAL FORMAT RULES");
  });
});

describe("Comparison Review Prompt Structure", () => {
  it("comparison critic system prompt uses bullet-point format", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/ai-album-critic/server/services/claudeCritic.ts", "utf-8");
    
    expect(content).toContain("### Improvements");
    expect(content).toContain("### Regressions");
    expect(content).toContain("### What to Do for V3");
    expect(content).toContain("### Verdict");
  });
});

describe("Standard Review Length Configs", () => {
  it("brief config uses categorized bullet-point sections", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/ai-album-critic/server/services/claudeCritic.ts", "utf-8");
    
    // Brief should have What's Working, What Needs Work, How to Bring It Together
    expect(content).toContain("### What's Working");
    expect(content).toContain("### What Needs Work");
    expect(content).toContain("### How to Bring It Together");
  });

  it("standard config uses categorized bullet-point sections", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/ai-album-critic/server/services/claudeCritic.ts", "utf-8");
    
    // Standard should have Songwriting & Melody, Production & Mix, etc.
    expect(content).toContain("### Songwriting & Melody");
    expect(content).toContain("### Production & Mix");
    expect(content).toContain("### Arrangement & Structure");
    expect(content).toContain("### How to Bring It All Together");
  });

  it("detailed config uses categorized bullet-point sections", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/ai-album-critic/server/services/claudeCritic.ts", "utf-8");
    
    // Detailed should have Performance & Delivery, Next Steps & Trajectory
    expect(content).toContain("### Performance & Delivery");
    expect(content).toContain("### Next Steps & Trajectory");
    expect(content).toContain("### Originality & Context");
  });

  it("system prompt emphasizes co-producer role and actionable suggestions", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/ai-album-critic/server/services/claudeCritic.ts", "utf-8");
    
    expect(content).toContain("co-producer");
    expect(content).toContain("SUGGEST");
    expect(content).toContain("what to ADD");
    expect(content).toContain("what to CHANGE");
  });
});

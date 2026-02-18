import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Round 64 — Changelog, Action Mode Rename, Quality Pass", () => {
  describe("Changelog page", () => {
    const changelogPath = path.join(__dirname, "../client/src/pages/Changelog.tsx");

    it("Changelog.tsx exists", () => {
      expect(fs.existsSync(changelogPath)).toBe(true);
    });

    it("contains release version entries", () => {
      const content = fs.readFileSync(changelogPath, "utf-8");
      // Versions stored as "3.6", "2.5", "1.0" etc. and rendered with v prefix
      expect(content).toContain('"3.6"');
      expect(content).toContain('"2.0"');
      expect(content).toContain('"1.0"');
    });

    it("includes key feature descriptions", () => {
      const content = fs.readFileSync(changelogPath, "utf-8");
      expect(content).toContain("Action Mode");
      expect(content).toContain("Stripe");
    });

    it("has proper page structure with title", () => {
      const content = fs.readFileSync(changelogPath, "utf-8");
      expect(content).toMatch(/Changelog|What's New/);
      expect(content).toContain("export default");
    });
  });

  describe("Changelog route registration", () => {
    it("/changelog route is registered in App.tsx", () => {
      const appPath = path.join(__dirname, "../client/src/App.tsx");
      const content = fs.readFileSync(appPath, "utf-8");
      expect(content).toContain("/changelog");
      expect(content).toContain("Changelog");
    });
  });

  describe("Action Mode rename: Full Picture → Full Review", () => {
    it("ActionModeSelector uses 'Full Review' label", () => {
      const selectorPath = path.join(__dirname, "../client/src/components/ActionModeSelector.tsx");
      const content = fs.readFileSync(selectorPath, "utf-8");
      expect(content).toContain('"Full Review"');
      expect(content).toContain("Original comprehensive review");
    });

    it("uses clipboard icon instead of target icon", () => {
      const selectorPath = path.join(__dirname, "../client/src/components/ActionModeSelector.tsx");
      const content = fs.readFileSync(selectorPath, "utf-8");
      expect(content).toContain("📋");
    });
  });

  describe("Footer improvements", () => {
    it("Home.tsx footer includes changelog link", () => {
      const homePath = path.join(__dirname, "../client/src/pages/Home.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      expect(content).toContain("/changelog");
    });

    it("Home.tsx footer includes support link", () => {
      const homePath = path.join(__dirname, "../client/src/pages/Home.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      expect(content).toContain("/support");
    });
  });

  describe("Platform stats router", () => {
    it("routers.ts includes platform.stats procedure", () => {
      const routersPath = path.join(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      expect(content).toContain("platform:");
      expect(content).toContain("stats:");
    });
  });

  describe("Support router", () => {
    it("routers.ts includes support.sendMessage procedure", () => {
      const routersPath = path.join(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      expect(content).toContain("support:");
      expect(content).toContain("sendMessage:");
    });
  });

  describe("Gravito governance", () => {
    it("Gravito audit results file exists for Round 64", () => {
      const gravitoPath = path.join(__dirname, "../gravito-round64-results.md");
      expect(fs.existsSync(gravitoPath)).toBe(true);
    });

    it("Gravito audit results indicate PASS", () => {
      const gravitoPath = path.join(__dirname, "../gravito-round64-results.md");
      const content = fs.readFileSync(gravitoPath, "utf-8");
      expect(content).toContain("PASS");
    });
  });

  describe("Onboarding persistence", () => {
    it("OnboardingTour uses localStorage for persistence", () => {
      const tourPath = path.join(__dirname, "../client/src/components/OnboardingTour.tsx");
      const content = fs.readFileSync(tourPath, "utf-8");
      expect(content).toContain("localStorage");
      expect(content).toContain("TOUR_STORAGE_KEY");
    });
  });

  describe("AI disclaimer in ReviewView", () => {
    it("ReviewView.tsx contains AI-generated disclaimer", () => {
      const reviewPath = path.join(__dirname, "../client/src/pages/ReviewView.tsx");
      const content = fs.readFileSync(reviewPath, "utf-8");
      expect(content).toMatch(/AI|artificial intelligence/i);
      expect(content).toMatch(/generated|disclaimer/i);
    });
  });

  describe("PDF export disclaimer", () => {
    it("pdfExport.ts contains AI-generated disclaimer", () => {
      const pdfPath = path.join(__dirname, "services/pdfExport.ts");
      const content = fs.readFileSync(pdfPath, "utf-8");
      expect(content).toMatch(/AI|artificial intelligence/i);
    });
  });
});

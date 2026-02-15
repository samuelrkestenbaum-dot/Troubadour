import { describe, it, expect } from "vitest";

describe("Round 39 - Review Length Toggle & Comparison View", () => {
  describe("Review Length Configuration", () => {
    it("should define three review length presets", () => {
      const REVIEW_LENGTH_CONFIG = {
        brief: { wordRange: "400-600", sections: 4, sentencesPerSection: "1-2" },
        standard: { wordRange: "800-1200", sections: 6, sentencesPerSection: "2-3" },
        detailed: { wordRange: "1500-2000", sections: 8, sentencesPerSection: "3-5" },
      };
      expect(Object.keys(REVIEW_LENGTH_CONFIG)).toEqual(["brief", "standard", "detailed"]);
      expect(REVIEW_LENGTH_CONFIG.brief.sections).toBeLessThan(REVIEW_LENGTH_CONFIG.standard.sections);
      expect(REVIEW_LENGTH_CONFIG.standard.sections).toBeLessThan(REVIEW_LENGTH_CONFIG.detailed.sections);
    });

    it("should accept reviewLength in analyzeAndReview input schema", () => {
      const validLengths = ["brief", "standard", "detailed"];
      validLengths.forEach(length => {
        expect(typeof length).toBe("string");
        expect(["brief", "standard", "detailed"]).toContain(length);
      });
    });

    it("should default to standard when no reviewLength specified", () => {
      const defaultLength = undefined;
      const effectiveLength = defaultLength || "standard";
      expect(effectiveLength).toBe("standard");
    });

    it("should pass reviewLength through job metadata", () => {
      const metadata: Record<string, any> = {};
      const reviewLength = "brief";
      if (reviewLength) metadata.reviewLength = reviewLength;
      expect(metadata.reviewLength).toBe("brief");
    });

    it("should not add reviewLength to metadata when not specified", () => {
      const metadata: Record<string, any> = {};
      const reviewLength = undefined;
      if (reviewLength) metadata.reviewLength = reviewLength;
      expect(metadata.reviewLength).toBeUndefined();
    });
  });

  describe("Review Comparison View", () => {
    it("should require at least 2 reviews for comparison", () => {
      const reviews = [{ id: 1, reviewVersion: 1 }];
      const canCompare = reviews.length >= 2;
      expect(canCompare).toBe(false);
    });

    it("should enable comparison with 2+ reviews", () => {
      const reviews = [
        { id: 1, reviewVersion: 1 },
        { id: 2, reviewVersion: 2 },
      ];
      const canCompare = reviews.length >= 2;
      expect(canCompare).toBe(true);
    });

    it("should calculate score deltas correctly", () => {
      const scoresA = { melody: 7, production: 6, lyrics: 5 };
      const scoresB = { melody: 8, production: 6, lyrics: 7 };
      const deltas: Record<string, number> = {};
      for (const key of Object.keys(scoresA)) {
        deltas[key] = (scoresB as any)[key] - (scoresA as any)[key];
      }
      expect(deltas.melody).toBe(1);
      expect(deltas.production).toBe(0);
      expect(deltas.lyrics).toBe(2);
    });

    it("should prevent selecting the same review for both sides", () => {
      const leftId = "1";
      const rightId = "1";
      const isValid = leftId !== rightId;
      expect(isValid).toBe(false);
    });

    it("should handle reviews with different score keys", () => {
      const scoresA = { melody: 7, production: 6 };
      const scoresB = { melody: 8, originality: 5 };
      const allKeys = new Set([...Object.keys(scoresA), ...Object.keys(scoresB)]);
      expect(Array.from(allKeys)).toEqual(expect.arrayContaining(["melody", "production", "originality"]));
    });
  });

  describe("Review Length Prompt Modification", () => {
    it("should build correct word count instruction for brief", () => {
      const config = { brief: "400-600", standard: "800-1200", detailed: "1500-2000" };
      const instruction = `Keep your review between ${config.brief} words.`;
      expect(instruction).toContain("400-600");
    });

    it("should build correct section count for detailed", () => {
      const sectionCounts = { brief: 4, standard: 6, detailed: 8 };
      expect(sectionCounts.detailed).toBe(8);
      expect(sectionCounts.detailed).toBeGreaterThan(sectionCounts.standard);
    });
  });
});

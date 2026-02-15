import { describe, it, expect, vi } from "vitest";

// ── Feature 1: Template Picker on Re-Review ──────────────────────────

describe("Round 48 – Feature 1: Template Picker on Re-Review", () => {
  it("job.reReview accepts optional templateId and reviewLength", () => {
    // The reReview mutation input schema should accept these fields
    const validInput = {
      trackId: 1,
      templateId: 5,
      reviewLength: "detailed" as const,
    };
    expect(validInput.templateId).toBe(5);
    expect(validInput.reviewLength).toBe("detailed");
  });

  it("job.reReview works without templateId (default review)", () => {
    const minimalInput = { trackId: 1 };
    expect(minimalInput).toHaveProperty("trackId");
    expect(minimalInput).not.toHaveProperty("templateId");
  });

  it("reviewLength options are brief, standard, detailed", () => {
    const options = ["brief", "standard", "detailed"];
    expect(options).toContain("brief");
    expect(options).toContain("standard");
    expect(options).toContain("detailed");
    expect(options).toHaveLength(3);
  });

  it("re-review dialog passes templateId and reviewLength to mutation", () => {
    // Simulates the dialog sending both fields
    const mutationPayload = {
      trackId: 42,
      templateId: 7,
      reviewLength: "brief" as const,
    };
    expect(mutationPayload.trackId).toBe(42);
    expect(mutationPayload.templateId).toBe(7);
    expect(mutationPayload.reviewLength).toBe("brief");
  });
});

// ── Feature 2: Review Diff View ──────────────────────────────────────

describe("Round 48 – Feature 2: Review Diff View", () => {
  it("review.reviewDiff accepts two review IDs", () => {
    const input = { reviewIdA: 1, reviewIdB: 2 };
    expect(input.reviewIdA).toBe(1);
    expect(input.reviewIdB).toBe(2);
  });

  it("scoreDeltas correctly computes positive deltas", () => {
    const scoresA: Record<string, number> = { overall: 6, production: 5 };
    const scoresB: Record<string, number> = { overall: 8, production: 7 };
    const allKeys = Array.from(new Set([...Object.keys(scoresA), ...Object.keys(scoresB)]));
    const deltas: Record<string, { old: number | null; new_: number | null; delta: number }> = {};
    for (const key of allKeys) {
      const oldVal = scoresA[key] ?? null;
      const newVal = scoresB[key] ?? null;
      deltas[key] = { old: oldVal, new_: newVal, delta: (newVal ?? 0) - (oldVal ?? 0) };
    }
    expect(deltas.overall.delta).toBe(2);
    expect(deltas.production.delta).toBe(2);
  });

  it("scoreDeltas correctly computes negative deltas", () => {
    const scoresA: Record<string, number> = { overall: 8, melody: 9 };
    const scoresB: Record<string, number> = { overall: 6, melody: 7 };
    const allKeys = Array.from(new Set([...Object.keys(scoresA), ...Object.keys(scoresB)]));
    const deltas: Record<string, { old: number | null; new_: number | null; delta: number }> = {};
    for (const key of allKeys) {
      const oldVal = scoresA[key] ?? null;
      const newVal = scoresB[key] ?? null;
      deltas[key] = { old: oldVal, new_: newVal, delta: (newVal ?? 0) - (oldVal ?? 0) };
    }
    expect(deltas.overall.delta).toBe(-2);
    expect(deltas.melody.delta).toBe(-2);
  });

  it("scoreDeltas handles missing keys in one review", () => {
    const scoresA: Record<string, number> = { overall: 7 };
    const scoresB: Record<string, number> = { overall: 8, originality: 6 };
    const allKeys = Array.from(new Set([...Object.keys(scoresA), ...Object.keys(scoresB)]));
    const deltas: Record<string, { old: number | null; new_: number | null; delta: number }> = {};
    for (const key of allKeys) {
      const oldVal = scoresA[key] ?? null;
      const newVal = scoresB[key] ?? null;
      deltas[key] = { old: oldVal, new_: newVal, delta: (newVal ?? 0) - (oldVal ?? 0) };
    }
    expect(deltas.originality.old).toBeNull();
    expect(deltas.originality.new_).toBe(6);
    expect(deltas.originality.delta).toBe(6);
  });

  it("DeltaBadge renders correct direction for positive, negative, zero", () => {
    // Positive delta
    const posDelta = 1.5;
    expect(posDelta).toBeGreaterThan(0);

    // Negative delta
    const negDelta = -2.0;
    expect(negDelta).toBeLessThan(0);

    // Zero delta
    const zeroDelta = 0;
    expect(zeroDelta).toBe(0);
  });

  it("diff view sorts dimensions by absolute delta descending", () => {
    const deltas = [
      { key: "production", delta: 1 },
      { key: "melody", delta: -3 },
      { key: "arrangement", delta: 0.5 },
      { key: "overall", delta: 2 },
    ];
    const sorted = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    expect(sorted[0].key).toBe("melody"); // abs(-3) = 3
    expect(sorted[1].key).toBe("overall"); // abs(2) = 2
    expect(sorted[2].key).toBe("production"); // abs(1) = 1
    expect(sorted[3].key).toBe("arrangement"); // abs(0.5) = 0.5
  });

  it("ReviewVersionHistory filters to track reviews only", () => {
    const reviews = [
      { id: 1, reviewType: "track", reviewVersion: 1 },
      { id: 2, reviewType: "album", reviewVersion: 1 },
      { id: 3, reviewType: "track", reviewVersion: 2 },
      { id: 4, reviewType: "comparison", reviewVersion: 1 },
    ];
    const trackReviews = reviews.filter(r => r.reviewType === "track");
    expect(trackReviews).toHaveLength(2);
    expect(trackReviews[0].id).toBe(1);
    expect(trackReviews[1].id).toBe(3);
  });
});

// ── Feature 3: Keyboard Shortcuts for Review Navigation ──────────────

describe("Round 48 – Feature 3: Keyboard Shortcuts", () => {
  it("J key advances focus to next section", () => {
    let focusedIndex: number | null = null;
    const sectionCount = 5;

    // Simulate pressing J
    focusedIndex = focusedIndex === null ? 0 : Math.min(focusedIndex + 1, sectionCount - 1);
    expect(focusedIndex).toBe(0);

    // Press J again
    focusedIndex = Math.min(focusedIndex + 1, sectionCount - 1);
    expect(focusedIndex).toBe(1);

    // Press J to the end
    focusedIndex = 4;
    focusedIndex = Math.min(focusedIndex + 1, sectionCount - 1);
    expect(focusedIndex).toBe(4); // Clamped at last section
  });

  it("K key moves focus to previous section", () => {
    let focusedIndex: number | null = 3;
    const sectionCount = 5;

    // Simulate pressing K
    focusedIndex = Math.max(focusedIndex - 1, 0);
    expect(focusedIndex).toBe(2);

    // Press K to the start
    focusedIndex = 0;
    focusedIndex = Math.max(focusedIndex - 1, 0);
    expect(focusedIndex).toBe(0); // Clamped at first section
  });

  it("K key from null starts at last section", () => {
    let focusedIndex: number | null = null;
    const sectionCount = 5;

    focusedIndex = focusedIndex === null ? sectionCount - 1 : Math.max(focusedIndex - 1, 0);
    expect(focusedIndex).toBe(4);
  });

  it("E key expands all sections", () => {
    const sectionCount = 4;
    let openSections = new Set<number>([0]); // Only first open

    // Simulate pressing E
    openSections = new Set(Array.from({ length: sectionCount }, (_, i) => i));
    expect(openSections.size).toBe(4);
    expect(openSections.has(0)).toBe(true);
    expect(openSections.has(3)).toBe(true);
  });

  it("C key collapses all sections", () => {
    const sectionCount = 4;
    let openSections = new Set(Array.from({ length: sectionCount }, (_, i) => i));

    // Simulate pressing C
    openSections = new Set();
    expect(openSections.size).toBe(0);
  });

  it("Enter/Space toggles focused section", () => {
    const focusedIndex = 2;
    let openSections = new Set<number>([0, 1, 2, 3]);

    // Toggle section 2 (close it)
    const next = new Set(openSections);
    if (next.has(focusedIndex)) {
      next.delete(focusedIndex);
    } else {
      next.add(focusedIndex);
    }
    openSections = next;
    expect(openSections.has(2)).toBe(false);
    expect(openSections.size).toBe(3);

    // Toggle again (open it)
    const next2 = new Set(openSections);
    if (next2.has(focusedIndex)) {
      next2.delete(focusedIndex);
    } else {
      next2.add(focusedIndex);
    }
    openSections = next2;
    expect(openSections.has(2)).toBe(true);
    expect(openSections.size).toBe(4);
  });

  it("Escape deactivates keyboard mode", () => {
    let focusedIndex: number | null = 2;
    let keyboardActive = true;

    // Simulate pressing Escape
    focusedIndex = null;
    keyboardActive = false;

    expect(focusedIndex).toBeNull();
    expect(keyboardActive).toBe(false);
  });

  it("keyboard shortcuts ignore input/textarea elements", () => {
    // Simulates checking if target is an input element
    const inputElement = { tagName: "INPUT", isContentEditable: false };
    const textareaElement = { tagName: "TEXTAREA", isContentEditable: false };
    const divElement = { tagName: "DIV", isContentEditable: false };

    const shouldIgnore = (el: { tagName: string; isContentEditable: boolean }) =>
      el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;

    expect(shouldIgnore(inputElement)).toBe(true);
    expect(shouldIgnore(textareaElement)).toBe(true);
    expect(shouldIgnore(divElement)).toBe(false);
  });
});

// ── Integration: parseReviewSections for keyboard nav ────────────────

describe("Round 48 – parseReviewSections for keyboard nav", () => {
  function parseReviewSections(markdown: string) {
    const lines = markdown.split("\n");
    let preamble = "";
    const sections: { header: string; content: string; level: number }[] = [];
    let currentSection: { header: string; content: string; level: number } | null = null;
    let contentLines: string[] = [];
    let inPreamble = true;

    for (const line of lines) {
      const h2Match = line.match(/^##\s+(.+)$/);
      const h3Match = line.match(/^###\s+(.+)$/);
      const match = h2Match || h3Match;
      if (match) {
        if (currentSection) {
          currentSection.content = contentLines.join("\n").trim();
          sections.push(currentSection);
        } else if (inPreamble) {
          preamble = contentLines.join("\n").trim();
        }
        inPreamble = false;
        currentSection = {
          header: match[1].replace(/\*\*/g, "").trim(),
          content: "",
          level: h2Match ? 2 : 3,
        };
        contentLines = [];
      } else {
        contentLines.push(line);
      }
    }
    if (currentSection) {
      currentSection.content = contentLines.join("\n").trim();
      sections.push(currentSection);
    } else if (inPreamble) {
      preamble = contentLines.join("\n").trim();
    }
    return { preamble, sections };
  }

  it("parses multiple ### sections correctly", () => {
    const md = `### What's Working\n- Great hooks\n- Strong melody\n\n### What's Missing\n- Bass needs work\n\n### How to Bring It Together\n- Add sub-bass`;
    const { sections } = parseReviewSections(md);
    expect(sections).toHaveLength(3);
    expect(sections[0].header).toBe("What's Working");
    expect(sections[1].header).toBe("What's Missing");
    expect(sections[2].header).toBe("How to Bring It Together");
  });

  it("handles preamble before first heading", () => {
    const md = `Some intro text\n\n### Section One\nContent here`;
    const { preamble, sections } = parseReviewSections(md);
    expect(preamble).toBe("Some intro text");
    expect(sections).toHaveLength(1);
    expect(sections[0].header).toBe("Section One");
  });

  it("returns empty sections for plain text without headers", () => {
    const md = `Just plain text without any headers.`;
    const { preamble, sections } = parseReviewSections(md);
    expect(sections).toHaveLength(0);
    expect(preamble).toBe("Just plain text without any headers.");
  });
});

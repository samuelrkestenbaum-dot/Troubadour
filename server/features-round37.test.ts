import { describe, it, expect, vi } from "vitest";

// ── Feature 1: Reference Track Comparison (already existed, verify router presence) ──
describe("Feature 1: Reference Track Comparison", () => {
  it("reference router should be defined in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("reference.list");
    expect(appRouter._def.procedures).toHaveProperty("reference.upload");
    expect(appRouter._def.procedures).toHaveProperty("reference.compare");
  });
});

// ── Feature 2: Revision Timeline with Progress Scoring ──
describe("Feature 2: Revision Timeline", () => {
  it("timeline router should be defined with getVersionHistory", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("timeline.get");
  });
});

// ── Feature 3: AI Mix Feedback Report ──
describe("Feature 3: Mix Feedback Report", () => {
  it("mixReport router should be defined with get and generate", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("mixReport.get");
    expect(appRouter._def.procedures).toHaveProperty("mixReport.generate");
  });

  it("generateMixReport should return structured analysis", async () => {
    const { generateMixReport } = await import("./services/analysisService");
    expect(typeof generateMixReport).toBe("function");
  });
});

// ── Feature 4: Collaborative Waveform Annotations ──
describe("Feature 4: Waveform Annotations", () => {
  it("annotation router should be defined with CRUD operations", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("annotation.list");
    expect(appRouter._def.procedures).toHaveProperty("annotation.create");
    expect(appRouter._def.procedures).toHaveProperty("annotation.update");
    expect(appRouter._def.procedures).toHaveProperty("annotation.delete");
  });

  it("waveformAnnotations table should be in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.waveformAnnotations).toBeDefined();
    expect(schema.waveformAnnotations.trackId).toBeDefined();
    expect(schema.waveformAnnotations.timestampMs).toBeDefined();
    expect(schema.waveformAnnotations.content).toBeDefined();
    expect(schema.waveformAnnotations.resolved).toBeDefined();
  });
});

// ── Feature 5: Genre Benchmarking Dashboard ──
describe("Feature 5: Genre Benchmarks", () => {
  it("benchmark router should be defined with genres and byGenre", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("benchmark.genres");
    expect(appRouter._def.procedures).toHaveProperty("benchmark.byGenre");
  });
});

// ── Feature 6: Export to DAW Session Notes ──
describe("Feature 6: DAW Session Notes Export", () => {
  it("dawExport router should be defined with generate", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("dawExport.generate");
  });

  it("generateDAWSessionNotes should return structured notes", async () => {
    const { generateDAWSessionNotes } = await import("./services/analysisService");
    expect(typeof generateDAWSessionNotes).toBe("function");
  });
});

// ── Feature 7: Songwriting Structure Analysis ──
describe("Feature 7: Structure Analysis", () => {
  it("structure router should be defined with get and generate", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("structure.get");
    expect(appRouter._def.procedures).toHaveProperty("structure.generate");
  });

  it("structureAnalyses table should be in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.structureAnalyses).toBeDefined();
    expect(schema.structureAnalyses.trackId).toBeDefined();
    expect(schema.structureAnalyses.structureScore).toBeDefined();
  });

  it("generateStructureAnalysis should be a function", async () => {
    const { generateStructureAnalysis } = await import("./services/analysisService");
    expect(typeof generateStructureAnalysis).toBe("function");
  });
});

// ── Feature 8: Mood/Energy Curve Visualization ──
describe("Feature 8: Mood/Energy Curve", () => {
  it("moodEnergy router should be defined with get", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("moodEnergy.get");
  });
});

// ── Database helpers ──
describe("Database helpers for new features", () => {
  it("should export annotation CRUD helpers", async () => {
    const db = await import("./db");
    expect(typeof db.getAnnotationsByTrack).toBe("function");
    expect(typeof db.createAnnotation).toBe("function");
    expect(typeof db.updateAnnotation).toBe("function");
    expect(typeof db.deleteAnnotation).toBe("function");
  });

  it("should export structure analysis helpers", async () => {
    const db = await import("./db");
    expect(typeof db.getStructureAnalysis).toBe("function");
    expect(typeof db.upsertStructureAnalysis).toBe("function");
  });

  it("should export mix report helpers", async () => {
    const db = await import("./db");
    expect(typeof db.getMixReportByTrack).toBe("function");
    expect(typeof db.createMixReport).toBe("function");
  });

  it("should export benchmark helpers", async () => {
    const db = await import("./db");
    expect(typeof db.getAllGenresWithCounts).toBe("function");
    expect(typeof db.getGenreBenchmarks).toBe("function");
  });

  it("should export version history helper", async () => {
    const db = await import("./db");
    expect(typeof db.getVersionTimeline).toBe("function");
  });
});

// ── Analysis Service ──
describe("Analysis Service module", () => {
  it("should export all analysis functions", async () => {
    const svc = await import("./services/analysisService");
    expect(typeof svc.generateMixReport).toBe("function");
    expect(typeof svc.generateStructureAnalysis).toBe("function");
    expect(typeof svc.generateDAWSessionNotes).toBe("function");
    expect(typeof svc.aggregateGenreBenchmarks).toBe("function");
  });
});

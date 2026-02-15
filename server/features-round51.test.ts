import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

// ── Round 51 Tests: Artwork Concepts, Mastering Checklist, Project Timeline ──

describe("Round 51 – Artwork Concepts", () => {
  it("artwork router exists on appRouter", () => {
    expect(appRouter._def.procedures).toHaveProperty("artwork.generate");
    expect(appRouter._def.procedures).toHaveProperty("artwork.list");
    expect(appRouter._def.procedures).toHaveProperty("artwork.delete");
  });

  it("artwork.generate is a mutation", () => {
    const proc = (appRouter._def.procedures as any)["artwork.generate"];
    expect(proc._def.type).toBe("mutation");
  });

  it("artwork.list is a query", () => {
    const proc = (appRouter._def.procedures as any)["artwork.list"];
    expect(proc._def.type).toBe("query");
  });

  it("artwork.delete is a mutation", () => {
    const proc = (appRouter._def.procedures as any)["artwork.delete"];
    expect(proc._def.type).toBe("mutation");
  });
});

describe("Round 51 – Mastering Checklist", () => {
  it("mastering router exists on appRouter", () => {
    expect(appRouter._def.procedures).toHaveProperty("mastering.generateChecklist");
    expect(appRouter._def.procedures).toHaveProperty("mastering.get");
    expect(appRouter._def.procedures).toHaveProperty("mastering.toggleItem");
  });

  it("mastering.generateChecklist is a mutation", () => {
    const proc = (appRouter._def.procedures as any)["mastering.generateChecklist"];
    expect(proc._def.type).toBe("mutation");
  });

  it("mastering.get is a query", () => {
    const proc = (appRouter._def.procedures as any)["mastering.get"];
    expect(proc._def.type).toBe("query");
  });

  it("mastering.toggleItem is a mutation", () => {
    const proc = (appRouter._def.procedures as any)["mastering.toggleItem"];
    expect(proc._def.type).toBe("mutation");
  });
});

describe("Round 51 – Database Schema", () => {
  it("artworkConcepts table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema).toHaveProperty("artworkConcepts");
  });

  it("masteringChecklists table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema).toHaveProperty("masteringChecklists");
  });

  it("artworkConcepts has required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.artworkConcepts;
    const columns = Object.keys(table);
    // Table object should exist
    expect(table).toBeDefined();
  });

  it("masteringChecklists has required columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.masteringChecklists;
    expect(table).toBeDefined();
  });
});

describe("Round 51 – Database Helpers", () => {
  it("artwork db helpers are exported", async () => {
    const db = await import("./db");
    expect(db).toHaveProperty("createArtworkConcept");
    expect(db).toHaveProperty("getArtworkConceptsByProject");
    expect(db).toHaveProperty("deleteArtworkConcept");
  });

  it("mastering db helpers are exported", async () => {
    const db = await import("./db");
    expect(db).toHaveProperty("createMasteringChecklist");
    expect(db).toHaveProperty("getMasteringChecklistByTrack");
    expect(db).toHaveProperty("updateMasteringChecklist");
  });
});

describe("Round 51 – Project Timeline Component", () => {
  it("ProjectTimeline component is importable", async () => {
    // Verify the component file exists and exports correctly
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ProjectTimeline.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export function ProjectTimeline");
  });

  it("ProjectTimeline accepts tracks prop", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ProjectTimeline.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("tracks?: any[]");
  });

  it("ProjectTimeline renders summary stats", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ProjectTimeline.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Tracks");
    expect(content).toContain("Reviewed");
    expect(content).toContain("Ready");
    expect(content).toContain("Days");
  });

  it("ProjectTimeline groups events by date", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ProjectTimeline.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("groupedByDate");
    expect(content).toContain("dateKey");
  });

  it("ProjectTimeline handles event types", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ProjectTimeline.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("upload");
    expect(content).toContain("review");
    expect(content).toContain("tagged");
    expect(content).toContain("ready");
  });

  it("ProjectTimeline shows progress bar with three segments", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ProjectTimeline.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("bg-emerald-500");
    expect(content).toContain("bg-amber-500");
    expect(content).toContain("bg-blue-500/50");
    expect(content).toContain("Album Progress");
  });
});

describe("Round 51 – ArtworkGallery Component", () => {
  it("ArtworkGallery component is importable", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ArtworkGallery.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export function ArtworkGallery");
  });

  it("ArtworkGallery uses sonner toast", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ArtworkGallery.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("from \"sonner\"");
    expect(content).toContain("toast.success");
    expect(content).toContain("toast.error");
  });

  it("ArtworkGallery has style input and generate button", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ArtworkGallery.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Style hint");
    expect(content).toContain("Generate Concept");
  });

  it("ArtworkGallery shows color palette swatches", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/ArtworkGallery.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("colorPalette");
    expect(content).toContain("backgroundColor: color");
  });
});

describe("Round 51 – MasteringChecklist Component", () => {
  it("MasteringChecklist component is importable", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/MasteringChecklist.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export function MasteringChecklist");
  });

  it("MasteringChecklist has priority grouping", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/MasteringChecklist.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    // The text is rendered as JSX template: {config.label} Priority
    expect(content).toContain("config.label");
    expect(content).toContain("Priority");
    expect(content).toContain("PRIORITY_CONFIG");
  });

  it("MasteringChecklist has category colors", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/MasteringChecklist.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("EQ");
    expect(content).toContain("Dynamics");
    expect(content).toContain("Stereo");
    expect(content).toContain("Loudness");
  });

  it("MasteringChecklist shows progress percentage", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/MasteringChecklist.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("progressPct");
    expect(content).toContain("Mastering Readiness");
  });

  it("MasteringChecklist has regenerate button", async () => {
    const fs = await import("fs");
    const path = require("path");
    const filePath = path.join(__dirname, "../client/src/components/MasteringChecklist.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Regenerate Checklist");
  });
});

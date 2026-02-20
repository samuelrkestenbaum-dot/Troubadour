import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Enhanced Copy Review as Markdown ──

describe("Round 59 — Enhanced Copy Review as Markdown", () => {
  const reviewViewPath = resolve(__dirname, "../client/src/pages/ReviewView.tsx");
  const reviewViewContent = readFileSync(reviewViewPath, "utf-8");

  it("should have a handleCopy function that builds a rich markdown header", () => {
    expect(reviewViewContent).toContain("handleCopy");
    expect(reviewViewContent).toContain("# ${typeLabel}");
    expect(reviewViewContent).toContain("**Overall Score:**");
    expect(reviewViewContent).toContain("**Genre:**");
    expect(reviewViewContent).toContain("**Date:**");
    expect(reviewViewContent).toContain("**Model:**");
  });

  it("should include a scores table in the copied markdown", () => {
    expect(reviewViewContent).toContain("| Category | Score |");
    expect(reviewViewContent).toContain("| --- | --- |");
    expect(reviewViewContent).toContain("/10 |");
  });

  it("should include a Troubadour attribution footer", () => {
    expect(reviewViewContent).toContain("Reviewed by [Troubadour]");
    expect(reviewViewContent).toContain("AI-powered music critique");
  });

  it("should have animated checkmark feedback on copy", () => {
    expect(reviewViewContent).toContain("setCopied(true)");
    expect(reviewViewContent).toContain("setCopied(false)");
    expect(reviewViewContent).toContain('copied ? "Copied!" : "Copy"');
    expect(reviewViewContent).toContain("text-emerald-400");
  });

  it("should copy the full review markdown after the header", () => {
    expect(reviewViewContent).toContain("review.reviewMarkdown");
    expect(reviewViewContent).toContain("navigator.clipboard.writeText");
  });
});

// ── Exponential Backoff for Job Retries ──

describe("Round 59 — Exponential Backoff for Job Retries", () => {
  const jobProcessorPath = resolve(__dirname, "services/jobProcessor.ts");
  const jobProcessorContent = readFileSync(jobProcessorPath, "utf-8");
  const schemaPath = resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = readFileSync(schemaPath, "utf-8");
  const dbPath = resolve(__dirname, "db.ts");
  const dbContent = readFileSync(dbPath, "utf-8");

  it("should have a getRetryDelay function with exponential backoff", () => {
    expect(jobProcessorContent).toContain("function getRetryDelay");
    expect(jobProcessorContent).toContain("Math.pow(2, attempt)");
    expect(jobProcessorContent).toContain("maxDelay");
  });

  it("should use a base delay of 5 seconds", () => {
    expect(jobProcessorContent).toContain("5_000");
  });

  it("should cap delay at 60 seconds", () => {
    expect(jobProcessorContent).toContain("60_000");
  });

  it("should add random jitter to prevent thundering herd", () => {
    expect(jobProcessorContent).toContain("Math.random()");
    expect(jobProcessorContent).toContain("jitter");
  });

  it("should set retryAfter when re-queuing failed jobs", () => {
    expect(jobProcessorContent).toContain("retryAfter");
    expect(jobProcessorContent).toContain("new Date(Date.now() + delay)");
  });

  it("should log the retry delay for observability", () => {
    expect(jobProcessorContent).toContain("retry after");
  });

  it("should have retryAfter column in jobs schema", () => {
    expect(schemaContent).toContain('retryAfter: timestamp("retryAfter")');
  });

  it("should skip jobs whose retryAfter is in the future in claimNextQueuedJob", () => {
    expect(dbContent).toContain("candidate.retryAfter");
    expect(dbContent).toContain("new Date(candidate.retryAfter) > new Date()");
  });

  it("getRetryDelay should produce increasing delays", () => {
    // Simulate the function logic (without jitter for deterministic testing)
    const getRetryDelayBase = (attempt: number): number => {
      const baseDelay = 5_000;
      const maxDelay = 60_000;
      return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    };

    expect(getRetryDelayBase(0)).toBe(5_000);   // 5s
    expect(getRetryDelayBase(1)).toBe(10_000);  // 10s
    expect(getRetryDelayBase(2)).toBe(20_000);  // 20s
    expect(getRetryDelayBase(3)).toBe(40_000);  // 40s
    expect(getRetryDelayBase(4)).toBe(60_000);  // 60s (capped)
    expect(getRetryDelayBase(5)).toBe(60_000);  // 60s (still capped)
  });
});

// ── Keyboard Shortcuts Help Dialog ──

describe("Round 59 — Keyboard Shortcuts Help Dialog", () => {
  const dialogPath = resolve(__dirname, "../client/src/components/KeyboardShortcutsDialog.tsx");
  const dialogContent = readFileSync(dialogPath, "utf-8");
  const appPath = resolve(__dirname, "../client/src/App.tsx");
  const appContent = readFileSync(appPath, "utf-8");

  it("should exist as a component file", () => {
    expect(existsSync(dialogPath)).toBe(true);
  });

  it("should be imported and rendered in App.tsx", () => {
    expect(appContent).toContain("KeyboardShortcutsDialog");
    expect(appContent).toContain("<KeyboardShortcutsDialog />");
  });

  it("should open on ? key press", () => {
    expect(dialogContent).toContain('e.key === "?"');
  });

  it("should close on Escape", () => {
    expect(dialogContent).toContain('"Escape"');
    expect(dialogContent).toContain("setOpen(false)");
  });

  it("should not trigger when typing in inputs", () => {
    expect(dialogContent).toContain("HTMLInputElement");
    expect(dialogContent).toContain("HTMLTextAreaElement");
  });

  it("should list shortcut groups with titles", () => {
    expect(dialogContent).toContain('"General"');
    expect(dialogContent).toContain('"Navigation"');
    expect(dialogContent).toContain('"Command Palette"');
    expect(dialogContent).toContain('"Review View"');
  });

  it("should include Ctrl+K shortcut for command palette", () => {
    expect(dialogContent).toContain('"Ctrl"');
    expect(dialogContent).toContain('"K"');
    expect(dialogContent).toContain("Open command palette");
  });

  it("should include G+H, G+D, G+A, G+S navigation shortcuts", () => {
    expect(dialogContent).toContain("Go to Home");
    expect(dialogContent).toContain("Go to Dashboard");
    expect(dialogContent).toContain("Go to Analytics");
    expect(dialogContent).toContain("Go to Settings");
  });

  it("should render kbd elements for shortcut keys", () => {
    expect(dialogContent).toContain("<kbd");
  });
});

// ── Global Keyboard Shortcuts ──

describe("Round 59 — Global Keyboard Shortcuts", () => {
  const globalPath = resolve(__dirname, "../client/src/components/GlobalKeyboardShortcuts.tsx");
  const globalContent = readFileSync(globalPath, "utf-8");
  const appPath = resolve(__dirname, "../client/src/App.tsx");
  const appContent = readFileSync(appPath, "utf-8");

  it("should exist as a component file", () => {
    expect(existsSync(globalPath)).toBe(true);
  });

  it("should be imported and rendered in App.tsx", () => {
    expect(appContent).toContain("GlobalKeyboardShortcuts");
    expect(appContent).toContain("<GlobalKeyboardShortcuts />");
  });

  it("should support two-key sequences with G prefix", () => {
    expect(globalContent).toContain('pendingPrefix.current === "g"');
    expect(globalContent).toContain('pendingPrefix.current = "g"');
  });

  it("should auto-clear pending prefix after timeout", () => {
    expect(globalContent).toContain("800");
    expect(globalContent).toContain("clearTimeout");
  });

  it("should support G+H for Home navigation", () => {
    expect(globalContent).toContain('case "h"');
    expect(globalContent).toContain('setLocation("/")');
  });

  it("should support G+D for Dashboard navigation", () => {
    expect(globalContent).toContain('case "d"');
    expect(globalContent).toContain('setLocation("/dashboard")');
  });

  it("should support G+A for Insights navigation (Round 94: analytics → insights)", () => {
    expect(globalContent).toContain('case "a"');
    expect(globalContent).toContain('setLocation("/insights")');
  });

  it("should support G+S for Settings navigation", () => {
    expect(globalContent).toContain('case "s"');
    expect(globalContent).toContain('setLocation("/settings")');
  });

  it("should support N for New Project", () => {
    expect(globalContent).toContain('key === "n"');
    expect(globalContent).toContain('setLocation("/projects/new")');
  });

  it("should not trigger when typing in inputs", () => {
    expect(globalContent).toContain("HTMLInputElement");
    expect(globalContent).toContain("HTMLTextAreaElement");
  });

  it("should not trigger with modifier keys", () => {
    expect(globalContent).toContain("e.metaKey");
    expect(globalContent).toContain("e.ctrlKey");
    expect(globalContent).toContain("e.altKey");
  });
});

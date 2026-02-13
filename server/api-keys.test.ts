import { describe, expect, it } from "vitest";

describe("API Key validation", () => {
  it("ANTHROPIC_API_KEY is set and has correct format", () => {
    const key = process.env.ANTHROPIC_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key!.startsWith("sk-ant-")).toBe(true);
  });

  it("GEMINI_API_KEY is set and has correct format", () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
  });
});

import { describe, expect, it } from "vitest";

describe("Gemini API Key Validation", () => {
  it("should have a valid Gemini API key that can list models", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key).toBeTruthy();
    
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.models).toBeDefined();
    expect(data.models.length).toBeGreaterThan(0);
  });
});

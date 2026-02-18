import { describe, it, expect } from "vitest";

describe("PostHog API Key Validation", () => {
  it("VITE_POSTHOG_KEY is set and has correct format", () => {
    const key = process.env.VITE_POSTHOG_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^phc_/);
  });

  it("PostHog project responds to decide endpoint", async () => {
    const key = process.env.VITE_POSTHOG_KEY;
    if (!key) {
      console.warn("VITE_POSTHOG_KEY not set, skipping API validation");
      return;
    }
    const res = await fetch("https://us.i.posthog.com/decide?v=3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        distinct_id: "test-validation",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // The decide endpoint returns feature flags and config
    expect(data).toHaveProperty("featureFlags");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ── Round 86: Landing Page Conversion Optimization Tests ──

const homePage = readFileSync(
  join(__dirname, "../client/src/pages/Home.tsx"),
  "utf-8"
);

const dashboardLayout = readFileSync(
  join(__dirname, "../client/src/components/DashboardLayout.tsx"),
  "utf-8"
);

describe("Testimonials Section", () => {
  it("should define testimonial data array with 4 entries", () => {
    expect(homePage).toContain("const testimonials = [");
    const testimonialMatches = homePage.match(/name:\s*"[A-Z][a-z]+ [A-Z]\."/g);
    expect(testimonialMatches).not.toBeNull();
    expect(testimonialMatches!.length).toBeGreaterThanOrEqual(4);
  });

  it("should include diverse music roles in testimonials", () => {
    expect(homePage).toContain("Indie Producer");
    expect(homePage).toContain("Singer-Songwriter");
    expect(homePage).toContain("Bedroom Pop Artist");
    expect(homePage).toContain("Hip-Hop Producer");
  });

  it("should have avatar initials for each testimonial", () => {
    expect(homePage).toContain('initials: "MR"');
    expect(homePage).toContain('initials: "LP"');
    expect(homePage).toContain('initials: "CS"');
    expect(homePage).toContain('initials: "DK"');
  });

  it("should have gradient colors for avatar backgrounds", () => {
    expect(homePage).toContain("from-amber-500 to-orange-500");
    expect(homePage).toContain("from-sky-500 to-blue-500");
    expect(homePage).toContain("from-emerald-500 to-teal-500");
    expect(homePage).toContain("from-violet-500 to-purple-500");
  });

  it("should render TestimonialsSection component", () => {
    expect(homePage).toContain("function TestimonialsSection()");
    expect(homePage).toContain("<TestimonialsSection />");
  });

  it("should have 'What Artists Are Saying' badge", () => {
    expect(homePage).toContain("What Artists Are Saying");
  });

  it("should have 'Get Better' gradient headline", () => {
    expect(homePage).toContain("Built for Musicians Who Want to");
    expect(homePage).toContain("Get Better");
  });

  it("should use Quote icon from lucide-react", () => {
    expect(homePage).toMatch(/import\s*\{[^}]*Quote[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  it("should reference actual product features in quotes", () => {
    expect(homePage).toContain("section-by-section analysis");
    expect(homePage).toContain("version comparison");
    expect(homePage).toContain("score calibration");
    expect(homePage).toContain("skill progression");
  });

  it("should render testimonials in a 2-column grid", () => {
    expect(homePage).toContain("grid md:grid-cols-2 gap-6");
  });

  it("should use motion animations for staggered reveal", () => {
    expect(homePage).toContain("delay: 0.1 * i");
  });
});

describe("Demo Audio Player Section", () => {
  it("should define demo scores array", () => {
    expect(homePage).toContain("const demoScores = [");
  });

  it("should include 5 review dimensions in demo", () => {
    expect(homePage).toContain('"Melody & Hooks"');
    expect(homePage).toContain('"Songwriting"');
    expect(homePage).toContain('"Production & Mix"');
    expect(homePage).toContain('"Performance"');
    expect(homePage).toContain('"Originality"');
  });

  it("should have calibrated demo scores (not inflated)", () => {
    const scoreMatches = homePage.match(/score:\s*(\d+)/g);
    expect(scoreMatches).not.toBeNull();
    const scores = scoreMatches!.map((s) => parseInt(s.replace("score: ", "")));
    // Filter to just the demo scores (6-8 range)
    const demoScores = scores.filter((s) => s >= 6 && s <= 8);
    expect(demoScores.length).toBeGreaterThanOrEqual(5);
    const avg = demoScores.reduce((a, b) => a + b, 0) / demoScores.length;
    expect(avg).toBeLessThan(8); // Anti-inflation check
  });

  it("should render DemoReviewSection component", () => {
    expect(homePage).toContain("function DemoReviewSection");
    expect(homePage).toContain("<DemoReviewSection");
  });

  it("should have 'See It in Action' badge", () => {
    expect(homePage).toContain("See It in Action");
  });

  it("should have 'Actionable Feedback' gradient headline", () => {
    expect(homePage).toContain("From Upload to");
    expect(homePage).toContain("Actionable Feedback");
  });

  it("should have play/pause button with state management", () => {
    expect(homePage).toContain("isPlaying");
    expect(homePage).toContain("setIsPlaying");
    expect(homePage).toContain("<Play");
    expect(homePage).toContain("<Pause");
  });

  it("should have waveform visualization with 60 bars", () => {
    expect(homePage).toContain("waveformBars");
    expect(homePage).toContain("Array.from({ length: 60 }");
  });

  it("should have progress bar for playback simulation", () => {
    expect(homePage).toContain("progress");
    expect(homePage).toContain("setProgress");
  });

  it("should have staggered score reveal animation", () => {
    expect(homePage).toContain("revealedScores");
    expect(homePage).toContain("setRevealedScores");
    expect(homePage).toContain("showScores");
  });

  it("should show Quick Take after all scores revealed", () => {
    expect(homePage).toContain("Quick Take");
    expect(homePage).toContain("Solid core with a genuinely strong chorus melody");
  });

  it("should show CTA button after scores revealed", () => {
    expect(homePage).toContain("Review Your Own Track");
    expect(homePage).toContain("Get Your Free Review");
  });

  it("should show demo track metadata", () => {
    expect(homePage).toContain("Demo Track");
    expect(homePage).toContain("Indie Pop");
    expect(homePage).toContain("122 BPM");
    expect(homePage).toContain("2:38");
  });

  it("should have pre-play prompt text", () => {
    expect(homePage).toContain("Press play to watch the AI analyze this track in real time");
  });

  it("should have analyzing indicator during playback", () => {
    expect(homePage).toContain("Analyzing audio waveform");
  });

  it("should have reset functionality when replaying", () => {
    expect(homePage).toContain("setShowScores(false)");
    expect(homePage).toContain("setRevealedScores(0)");
    expect(homePage).toContain("setProgress(0)");
  });
});

describe("Notification Badges on Sidebar", () => {
  it("should import useNavBadges hook in DashboardLayout", () => {
    expect(dashboardLayout).toContain("useNavBadges");
  });

  it("should render badge indicators for sidebar items", () => {
    expect(dashboardLayout).toContain("badge");
  });
});

describe("Landing Page Section Order", () => {
  it("should place testimonials before demo player", () => {
    const testimonialsIdx = homePage.indexOf("<TestimonialsSection");
    const demoIdx = homePage.indexOf("<DemoReviewSection");
    expect(testimonialsIdx).toBeGreaterThan(-1);
    expect(demoIdx).toBeGreaterThan(-1);
    expect(testimonialsIdx).toBeLessThan(demoIdx);
  });

  it("should place both sections after StrategicFeaturesSection", () => {
    const strategicIdx = homePage.indexOf("<StrategicFeaturesSection");
    const testimonialsIdx = homePage.indexOf("<TestimonialsSection");
    expect(strategicIdx).toBeGreaterThan(-1);
    expect(strategicIdx).toBeLessThan(testimonialsIdx);
  });

  it("should place both sections before the final CTA", () => {
    const demoIdx = homePage.indexOf("<DemoReviewSection");
    const ctaIdx = homePage.indexOf("Get Your Track Reviewed");
    expect(demoIdx).toBeLessThan(ctaIdx);
  });
});

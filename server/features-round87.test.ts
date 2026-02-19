import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ── Round 87: SEO Meta Tags + Mobile UX Audit Tests ──
const indexHtml = readFileSync(
  join(__dirname, "../client/index.html"),
  "utf-8"
);
const homePage = readFileSync(
  join(__dirname, "../client/src/pages/Home.tsx"),
  "utf-8"
);

describe("SEO Meta Tags & Open Graph", () => {
  it("should have comprehensive meta description", () => {
    expect(indexHtml).toMatch(/meta\s+name="description"/);
    expect(indexHtml).toContain("AI-powered music review");
  });

  it("should have Open Graph title tag", () => {
    expect(indexHtml).toMatch(/meta\s+property="og:title"/);
  });

  it("should have Open Graph description tag", () => {
    expect(indexHtml).toMatch(/meta\s+property="og:description"/);
  });

  it("should have Open Graph image with dimensions", () => {
    expect(indexHtml).toMatch(/meta\s+property="og:image"/);
    expect(indexHtml).toMatch(/meta\s+property="og:image:width"/);
    expect(indexHtml).toMatch(/meta\s+property="og:image:height"/);
  });

  it("should have og:type set to website", () => {
    expect(indexHtml).toMatch(/meta\s+property="og:type"\s+content="website"/);
  });

  it("should have og:locale set", () => {
    expect(indexHtml).toMatch(/meta\s+property="og:locale"/);
  });

  it("should have Twitter Card set to summary_large_image", () => {
    expect(indexHtml).toMatch(/meta\s+name="twitter:card"\s+content="summary_large_image"/);
  });

  it("should have Twitter title and description", () => {
    expect(indexHtml).toMatch(/meta\s+name="twitter:title"/);
    expect(indexHtml).toMatch(/meta\s+name="twitter:description"/);
  });

  it("should have Twitter image with alt text", () => {
    expect(indexHtml).toMatch(/meta\s+name="twitter:image"/);
    expect(indexHtml).toMatch(/meta\s+name="twitter:image:alt"/);
  });

  it("should have JSON-LD structured data for SoftwareApplication", () => {
    expect(indexHtml).toContain("application/ld+json");
    expect(indexHtml).toContain("SoftwareApplication");
  });

  it("should include pricing info in JSON-LD", () => {
    expect(indexHtml).toContain("AggregateOffer");
  });

  it("should include aggregate rating in JSON-LD", () => {
    expect(indexHtml).toContain("AggregateRating");
  });

  it("should have robots meta tag", () => {
    expect(indexHtml).toMatch(/meta\s+name="robots"/);
  });

  it("should have keywords meta tag", () => {
    expect(indexHtml).toMatch(/meta\s+name="keywords"/);
  });
});

describe("Mobile UX - Testimonials Section", () => {
  it("should use responsive padding on testimonial cards", () => {
    // p-4 sm:p-6 pattern for mobile-first padding
    expect(homePage).toContain('className="p-4 sm:p-6 rounded-2xl border border-border/40');
  });

  it("should use responsive section padding", () => {
    // py-16 sm:py-24 for testimonials section
    const testimonialSection = homePage.match(/py-16 sm:py-24 border-t border-border\/30 relative overflow-hidden/g);
    expect(testimonialSection).not.toBeNull();
    expect(testimonialSection!.length).toBeGreaterThanOrEqual(2); // Both testimonials and demo sections
  });

  it("should use responsive heading sizes", () => {
    // text-2xl sm:text-3xl md:text-4xl pattern
    const responsiveHeadings = homePage.match(/text-2xl sm:text-3xl md:text-4xl/g);
    expect(responsiveHeadings).not.toBeNull();
    expect(responsiveHeadings!.length).toBeGreaterThanOrEqual(2);
  });

  it("should use responsive quote icon sizes", () => {
    expect(homePage).toContain("h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/20");
  });

  it("should use responsive text sizes for quotes", () => {
    expect(homePage).toContain("text-sm sm:text-base text-foreground leading-relaxed");
  });

  it("should use responsive grid gap", () => {
    expect(homePage).toContain("grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6");
  });

  it("should add container padding for mobile", () => {
    // px-4 sm:px-6 for container padding
    const containerPadding = homePage.match(/container max-w-5xl mx-auto px-4 sm:px-6/g);
    expect(containerPadding).not.toBeNull();
    expect(containerPadding!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Mobile UX - Demo Audio Player", () => {
  it("should use responsive track header padding", () => {
    expect(homePage).toContain("p-4 sm:p-6 border-b border-border/30");
  });

  it("should use responsive track icon size", () => {
    expect(homePage).toContain("h-11 w-11 sm:h-14 sm:w-14 rounded-xl");
  });

  it("should use responsive music icon size", () => {
    expect(homePage).toContain("h-5 w-5 sm:h-7 sm:w-7 text-primary");
  });

  it("should hide AI Analysis label on mobile", () => {
    expect(homePage).toContain('className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground"');
  });

  it("should use responsive play button with touch feedback", () => {
    expect(homePage).toContain("h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-primary");
    expect(homePage).toContain("active:scale-95");
  });

  it("should use responsive waveform bar spacing and height", () => {
    expect(homePage).toContain('gap-[1px] sm:gap-[2px] h-10 sm:h-12');
  });

  it("should use responsive score dimension label width", () => {
    expect(homePage).toContain("w-24 sm:w-36 shrink-0");
  });

  it("should use responsive score text size", () => {
    expect(homePage).toContain("text-xs sm:text-sm text-muted-foreground w-24");
  });

  it("should use responsive score value width", () => {
    expect(homePage).toContain("text-xs sm:text-sm font-bold tabular-nums w-8 sm:w-10");
  });

  it("should use responsive gap in score rows", () => {
    expect(homePage).toContain('className="flex items-center gap-2 sm:gap-4"');
  });

  it("should use responsive player area padding", () => {
    expect(homePage).toContain("p-4 sm:p-6");
  });

  it("should use responsive description text", () => {
    expect(homePage).toContain("text-base sm:text-lg");
  });
});

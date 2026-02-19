import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── robots.txt ──────────────────────────────────────────────────────
describe("robots.txt", () => {
  const robotsTxt = readFileSync(
    resolve(__dirname, "../client/public/robots.txt"),
    "utf-8"
  );

  it("should exist and have content", () => {
    expect(robotsTxt.length).toBeGreaterThan(50);
  });

  it("should allow public pages", () => {
    expect(robotsTxt).toContain("Allow: /");
    expect(robotsTxt).toContain("Allow: /pricing");
    expect(robotsTxt).toContain("Allow: /terms");
    expect(robotsTxt).toContain("Allow: /privacy");
    expect(robotsTxt).toContain("Allow: /support");
    expect(robotsTxt).toContain("Allow: /shared/");
  });

  it("should block authenticated routes", () => {
    const blockedRoutes = [
      "/dashboard",
      "/projects",
      "/reviews/",
      "/tracks/",
      "/analytics",
      "/usage",
      "/settings",
      "/templates",
      "/benchmarks",
      "/tags",
      "/digest",
      "/skill-progression",
      "/competitive-benchmarks",
      "/release-readiness",
      "/streak",
      "/artist-dna",
      "/flywheel",
      "/admin",
    ];
    for (const route of blockedRoutes) {
      expect(robotsTxt).toContain(`Disallow: ${route}`);
    }
  });

  it("should block API endpoints", () => {
    expect(robotsTxt).toContain("Disallow: /api/");
  });

  it("should reference sitemap", () => {
    expect(robotsTxt).toContain("Sitemap:");
    expect(robotsTxt).toContain("sitemap.xml");
  });

  it("should have User-agent directive", () => {
    expect(robotsTxt).toContain("User-agent: *");
  });
});

// ── sitemap.xml ─────────────────────────────────────────────────────
describe("sitemap.xml", () => {
  const sitemapXml = readFileSync(
    resolve(__dirname, "../client/public/sitemap.xml"),
    "utf-8"
  );

  it("should exist and be valid XML", () => {
    expect(sitemapXml).toContain('<?xml version="1.0"');
    expect(sitemapXml).toContain("<urlset");
    expect(sitemapXml).toContain("</urlset>");
  });

  it("should include all public routes", () => {
    const publicRoutes = ["/", "/pricing", "/terms", "/privacy", "/support"];
    for (const route of publicRoutes) {
      expect(sitemapXml).toContain(`<loc>${route}</loc>`);
    }
  });

  it("should have priority values", () => {
    expect(sitemapXml).toContain("<priority>1.0</priority>"); // homepage
    expect(sitemapXml).toContain("<priority>0.9</priority>"); // pricing
    expect(sitemapXml).toContain("<priority>0.3</priority>"); // legal pages
  });

  it("should have changefreq values", () => {
    expect(sitemapXml).toContain("<changefreq>weekly</changefreq>");
    expect(sitemapXml).toContain("<changefreq>monthly</changefreq>");
    expect(sitemapXml).toContain("<changefreq>yearly</changefreq>");
  });

  it("should NOT include authenticated routes", () => {
    expect(sitemapXml).not.toContain("/dashboard");
    expect(sitemapXml).not.toContain("/projects");
    expect(sitemapXml).not.toContain("/settings");
    expect(sitemapXml).not.toContain("/admin");
    expect(sitemapXml).not.toContain("/analytics");
  });
});

// ── Stripe Products Configuration ───────────────────────────────────
describe("Stripe products configuration", () => {
  it("should have Artist price ID configured", async () => {
    const { PLANS } = await import("../server/stripe/products");
    expect(PLANS.artist.stripePriceId).toBeTruthy();
    expect(typeof PLANS.artist.stripePriceId).toBe("string");
    expect(PLANS.artist.stripePriceId.length).toBeGreaterThan(5);
  });

  it("should have Pro price ID configured", async () => {
    const { PLANS } = await import("../server/stripe/products");
    expect(PLANS.pro.stripePriceId).toBeTruthy();
    expect(typeof PLANS.pro.stripePriceId).toBe("string");
    expect(PLANS.pro.stripePriceId.length).toBeGreaterThan(5);
  });

  it("should have correct pricing in cents", async () => {
    const { PLANS } = await import("../server/stripe/products");
    expect(PLANS.artist.priceMonthly).toBe(1900); // $19
    expect(PLANS.pro.priceMonthly).toBe(4900); // $49
    expect(PLANS.free.priceMonthly).toBe(0);
  });

  it("should have correct tier names", async () => {
    const { PLANS } = await import("../server/stripe/products");
    expect(PLANS.free.tier).toBe("free");
    expect(PLANS.artist.tier).toBe("artist");
    expect(PLANS.pro.tier).toBe("pro");
  });

  it("should have review limits", async () => {
    const { PLANS } = await import("../server/stripe/products");
    expect(PLANS.free.monthlyReviewLimit).toBe(1);
    expect(PLANS.artist.monthlyReviewLimit).toBe(999);
    expect(PLANS.pro.monthlyReviewLimit).toBe(999);
  });

  it("should have feature gating logic", async () => {
    const { isFeatureGated } = await import("../server/stripe/products");
    // Free users are gated from artist features
    expect(isFeatureGated("free", "analytics")).toBe(true);
    expect(isFeatureGated("free", "chat")).toBe(true);
    // Artist users are gated from pro features
    expect(isFeatureGated("artist", "batch_review")).toBe(true);
    expect(isFeatureGated("artist", "export")).toBe(true);
    // Artist users have access to artist features
    expect(isFeatureGated("artist", "analytics")).toBe(false);
    expect(isFeatureGated("artist", "chat")).toBe(false);
    // Pro users have access to everything
    expect(isFeatureGated("pro", "analytics")).toBe(false);
    expect(isFeatureGated("pro", "batch_review")).toBe(false);
  });
});

// ── SEO Meta Tags ───────────────────────────────────────────────────
describe("SEO meta tags in index.html", () => {
  const indexHtml = readFileSync(
    resolve(__dirname, "../client/index.html"),
    "utf-8"
  );

  it("should have Open Graph tags", () => {
    expect(indexHtml).toContain('property="og:type"');
    expect(indexHtml).toContain('property="og:title"');
    expect(indexHtml).toContain('property="og:description"');
    expect(indexHtml).toContain('property="og:image"');
    expect(indexHtml).toContain('property="og:image:width"');
    expect(indexHtml).toContain('property="og:image:height"');
  });

  it("should have Twitter Card tags", () => {
    expect(indexHtml).toContain('name="twitter:card"');
    expect(indexHtml).toContain("summary_large_image");
    expect(indexHtml).toContain('name="twitter:title"');
    expect(indexHtml).toContain('name="twitter:image"');
  });

  it("should have JSON-LD structured data", () => {
    expect(indexHtml).toContain("application/ld+json");
    expect(indexHtml).toContain("SoftwareApplication");
    expect(indexHtml).toContain("Troubadour");
  });

  it("should have robots meta tag", () => {
    expect(indexHtml).toContain('name="robots"');
    expect(indexHtml).toContain("index, follow");
  });

  it("should have theme color", () => {
    expect(indexHtml).toContain('name="theme-color"');
  });
});

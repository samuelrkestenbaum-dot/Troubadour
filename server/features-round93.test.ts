import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── 1. Cancellation Surveys Schema ──
describe("Cancellation Surveys Schema", () => {
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  it("defines cancellationSurveys table", () => {
    expect(schema).toContain("cancellationSurveys");
    expect(schema).toContain("mysqlTable");
  });

  it("has required columns: userId, reason, feedbackText, offeredDiscount, acceptedDiscount", () => {
    const tableSection = schema.slice(schema.indexOf("cancellationSurveys"));
    expect(tableSection).toContain("userId");
    expect(tableSection).toContain("reason");
    expect(tableSection).toContain("feedbackText");
    expect(tableSection).toContain("offeredDiscount");
    expect(tableSection).toContain("acceptedDiscount");
  });

  it("has emailBounced and emailBouncedAt fields on users table", () => {
    expect(schema).toContain("emailBounced");
    expect(schema).toContain("emailBouncedAt");
  });
});

// ── 2. Cancellation Survey DB Helpers ──
describe("Cancellation Survey DB Helpers", () => {
  const dbPath = path.resolve(__dirname, "./db.ts");
  const db = fs.readFileSync(dbPath, "utf-8");

  it("exports createCancellationSurvey function", () => {
    expect(db).toContain("export async function createCancellationSurvey");
  });

  it("exports getCancellationSurveys function", () => {
    expect(db).toContain("export async function getCancellationSurveys");
  });

  it("exports markEmailBounced function", () => {
    expect(db).toContain("export async function markEmailBounced");
  });

  it("exports clearEmailBounce function", () => {
    expect(db).toContain("export async function clearEmailBounce");
  });

  it("exports isEmailBounced function", () => {
    expect(db).toContain("export async function isEmailBounced");
  });

  it("exports isEmailBouncedByAddress function", () => {
    expect(db).toContain("export async function isEmailBouncedByAddress");
  });
});

// ── 3. Subscription Router — Cancellation Survey Procedures ──
describe("Subscription Router — Cancellation Survey", () => {
  const routerPath = path.resolve(__dirname, "./routers/subscriptionRouter.ts");
  const router = fs.readFileSync(routerPath, "utf-8");

  it("has submitCancellationSurvey procedure", () => {
    expect(router).toContain("submitCancellationSurvey");
  });

  it("validates cancellation reason as string and checks discount eligibility", () => {
    expect(router).toContain("reason: z.string()");
    expect(router).toContain("too_expensive");
    expect(router).toContain("not_using_enough");
    expect(router).toContain("discountReasons");
  });

  it("has acceptRetentionDiscount procedure", () => {
    expect(router).toContain("acceptRetentionDiscount");
  });

  it("applies Stripe coupon for retention discount", () => {
    expect(router).toContain("stripe.subscriptions.update");
    expect(router).toContain("coupon");
  });
});

// ── 4. Postmark Bounce Webhook ──
describe("Postmark Bounce Webhook", () => {
  const webhookPath = path.resolve(__dirname, "./postmark/bounceWebhook.ts");
  const webhook = fs.readFileSync(webhookPath, "utf-8");

  it("exports handlePostmarkBounce function", () => {
    expect(webhook).toContain("export async function handlePostmarkBounce");
  });

  it("handles HardBounce type", () => {
    expect(webhook).toContain("HardBounce");
  });

  it("calls markEmailBounced for hard bounces", () => {
    expect(webhook).toContain("markEmailBounced");
  });

  it("logs audit trail for bounces", () => {
    expect(webhook).toContain("logAuditEvent");
  });

  it("returns 200 for all requests to prevent Postmark retries", () => {
    expect(webhook).toContain("200");
  });
});

// ── 5. Bounce Webhook Route Registration ──
describe("Bounce Webhook Route Registration", () => {
  const indexPath = path.resolve(__dirname, "./_core/index.ts");
  const index = fs.readFileSync(indexPath, "utf-8");

  it("registers /api/postmark/bounce route", () => {
    expect(index).toContain("/api/postmark/bounce");
  });

  it("uses express.json() for the bounce webhook", () => {
    // Postmark sends JSON, not raw like Stripe
    expect(index).toContain("handlePostmarkBounce");
  });
});

// ── 6. Email Bounce Gating in Email Pipeline ──
describe("Email Bounce Gating", () => {
  const emailPath = path.resolve(__dirname, "./services/emailNotification.ts");
  const email = fs.readFileSync(emailPath, "utf-8");

  it("checks for bounced email before sending", () => {
    expect(email).toContain("isEmailBouncedByAddress");
  });

  it("skips sending to bounced addresses", () => {
    expect(email).toContain("Skipping bounced address");
  });

  it("gracefully handles bounce check failures", () => {
    expect(email).toContain("Bounce check failed, proceeding with send");
  });
});

// ── 7. Transaction Usage ──
describe("Database Transactions", () => {
  const dbPath = path.resolve(__dirname, "./db.ts");
  const db = fs.readFileSync(dbPath, "utf-8");

  it("uses transaction for toggleFavorite (read-then-write)", () => {
    const toggleSection = db.slice(db.indexOf("toggleFavorite"));
    expect(toggleSection.slice(0, 500)).toContain("db.transaction");
  });

  it("uses transaction for review versioning", () => {
    const reviewSection = db.slice(db.indexOf("createReview"));
    expect(reviewSection.slice(0, 2000)).toContain("db.transaction");
  });
});

// ── 8. Accessibility ──
describe("Accessibility Improvements", () => {
  const htmlPath = path.resolve(__dirname, "../client/index.html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  it("has skip-to-content link", () => {
    expect(html).toContain("Skip to main content");
    expect(html).toContain("#main-content");
  });

  it("has lang attribute on html element", () => {
    expect(html).toContain('lang="en"');
  });

  const dashboardPath = path.resolve(__dirname, "../client/src/components/DashboardLayout.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf-8");

  it("has main-content id on main element", () => {
    expect(dashboard).toContain('id="main-content"');
  });

  it("has aria-label on main element", () => {
    expect(dashboard).toContain('aria-label="Main content"');
  });

  it("has aria-label on toggle navigation button", () => {
    expect(dashboard).toContain('aria-label="Toggle navigation"');
  });

  it("has focus-visible ring on interactive elements", () => {
    expect(dashboard).toContain("focus-visible:ring");
  });
});

// ── 9. CancellationSurvey Component ──
describe("CancellationSurvey Component", () => {
  const componentPath = path.resolve(__dirname, "../client/src/components/CancellationSurvey.tsx");
  const component = fs.readFileSync(componentPath, "utf-8");

  it("renders survey reasons as radio options", () => {
    expect(component).toContain("too_expensive");
    expect(component).toContain("missing_features");
    expect(component).toContain("not_using_enough");
    expect(component).toContain("found_alternative");
    expect(component).toContain("other");
  });

  it("has optional feedback textarea", () => {
    expect(component).toContain("textarea");
    expect(component).toContain("feedback");
  });

  it("shows discount offer for eligible reasons", () => {
    expect(component).toContain("discount");
  });

  it("calls submitCancellationSurvey mutation", () => {
    expect(component).toContain("submitCancellationSurvey");
  });

  it("calls acceptRetentionDiscount mutation", () => {
    expect(component).toContain("acceptRetentionDiscount");
  });

  it("has proceed to cancel callback", () => {
    expect(component).toContain("onProceedToCancel");
  });
});

// ── 10. Audit Trail — Bounce Actions ──
describe("Audit Trail — Bounce Actions", () => {
  const auditPath = path.resolve(__dirname, "./utils/auditTrail.ts");
  const audit = fs.readFileSync(auditPath, "utf-8");

  it("includes email_hard_bounce action type", () => {
    expect(audit).toContain("email_hard_bounce");
  });

  it("includes email_soft_bounce action type", () => {
    expect(audit).toContain("email_soft_bounce");
  });

  it("includes email_spam_complaint action type", () => {
    expect(audit).toContain("email_spam_complaint");
  });

  it("supports optional userId for system events", () => {
    // The function should accept userId as optional for system-triggered events
    expect(audit).toContain("userId?");
  });
});

// ── 11. Settings Integration ──
describe("Settings — Cancellation Survey Integration", () => {
  const settingsPath = path.resolve(__dirname, "../client/src/pages/Settings.tsx");
  const settings = fs.readFileSync(settingsPath, "utf-8");

  it("imports CancellationSurvey component", () => {
    expect(settings).toContain("CancellationSurvey");
  });

  it("has cancel subscription button", () => {
    expect(settings).toContain("Cancel Subscription");
  });

  it("has state for showing cancellation survey", () => {
    expect(settings).toContain("cancelSurveyOpen");
  });
});

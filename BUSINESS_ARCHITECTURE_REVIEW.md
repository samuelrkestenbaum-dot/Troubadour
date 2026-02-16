# Troubadour — Business Architecture Review

**Production Readiness Assessment & Launch Checklist**
**Date:** February 15, 2026 | **Prepared by:** Manus AI | **Version:** 1.0

---

## Executive Summary

Troubadour is a full-stack SaaS platform providing AI-powered music reviews and A&R intelligence. This document audits every API integration, payment flow, authentication mechanism, data pipeline, operational dependency, and infrastructure component to identify what is production-ready, what requires configuration before launch, and what gaps exist that could impact revenue, reliability, or user experience once the product goes live.

The platform is architecturally sound with a well-structured codebase (~31,000+ lines across server, client, components, and tests), 495 passing tests, zero TypeScript errors, and a comprehensive feature set spanning 45+ tRPC router groups. However, several critical operational items require attention before accepting real money and real users at scale.

---

## 1. API Integrations Inventory

The following table catalogs every external API dependency in the system, its purpose, current status, and what must be configured before launch.

| # | Service | Purpose | Env Variable(s) | Server-Side Only? | Current Status | Launch Action Required |
|---|---------|---------|-----------------|-------------------|----------------|----------------------|
| 1 | **Manus OAuth** | User authentication & identity | `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | Both | Auto-configured by platform | None — works out of the box |
| 2 | **Manus Built-in LLM** (via `invokeLLM`) | Claude-powered review generation, chat, album reviews, A/B comparisons | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server | Auto-configured | None — managed by platform |
| 3 | **Anthropic Claude API** (direct) | Claude Sonnet 4.5 for music criticism via `claudeCritic.ts` | `ANTHROPIC_API_KEY` | Server | Configured via BYOK | **Verify key is active and has sufficient quota for production volume** |
| 4 | **Google Gemini API** | Audio analysis (genre detection, audio features, structure analysis) | `GEMINI_API_KEY` | Server | Configured via BYOK | **Verify key is active; check quota limits for audio processing** |
| 5 | **Stripe** | Payment processing, subscriptions, billing portal | `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Both | Test sandbox (unclaimed) | **CRITICAL: Claim sandbox, complete KYC, switch to live keys** |
| 6 | **AWS S3** | Audio file storage, artwork storage, exports | Managed by platform (`storagePut`/`storageGet`) | Server | Auto-configured | None — managed by platform |
| 7 | **PostHog** | Product analytics, user identification, event tracking | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | Client | Scaffold ready, **not activated** | **Set `VITE_POSTHOG_KEY` to enable analytics** |
| 8 | **Umami Analytics** | Page view tracking | `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | Client | Script tag in HTML | Verify endpoint is active |
| 9 | **Manus Image Generation** | AI artwork concept generation | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server | Auto-configured | None |
| 10 | **Manus Notification API** | Owner notifications (new signups, errors) | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server | Auto-configured | **Enable in Settings → Notifications in Management UI** |
| 11 | **Whisper API** (via Manus) | Voice transcription for audio notes | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server | Available but not actively used in UI | Optional — enable if voice features are desired |

---

## 2. Payment & Subscription Architecture

### 2.1 Tier Structure

Troubadour operates a three-tier freemium model:

| Tier | Price | Monthly Reviews | Audio Minutes | Key Gated Features |
|------|-------|----------------|---------------|-------------------|
| **Free** | $0 | 3 | Limited | Basic review, genre detection, score breakdown |
| **Artist** | $19/mo | Unlimited | Higher limit | Version comparison, re-review, AI chat, reference tracks, share links, analytics |
| **Pro** | $49/mo | Unlimited | Highest limit | Album reviews, batch review, export, tag system, mix reports, structure analysis, DAW export, artwork generation |

### 2.2 Stripe Integration Status

The Stripe integration is **architecturally complete** but requires operational activation:

**What is built and working:**
- Checkout session creation with proper `client_reference_id` and metadata for user linking
- Webhook handler at `/api/stripe/webhook` registered before `express.json()` for raw body access
- Signature verification via `stripe.webhooks.constructEvent()`
- Idempotent webhook processing with `processedWebhookEvents` table (prevents duplicate processing)
- Test event detection (`evt_test_` prefix) with proper verification response
- Handled events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Billing portal access via `stripe.billingPortal.sessions.create()`
- Promotion code support (`allow_promotion_codes: true`)
- Proper user-to-customer linking via `stripeCustomerId` on user table

**What must be done before accepting real payments:**

1. **Claim the Stripe sandbox** at the provided URL before April 14, 2026
2. **Complete Stripe KYC verification** (business details, bank account, identity)
3. **Create live products and prices** in Stripe Dashboard matching the tier structure
4. **Switch to live API keys** in Settings → Payment
5. **Verify webhook endpoint** receives events in live mode (Stripe Dashboard → Developers → Webhooks)
6. **Test the full payment flow** with Stripe test card `4242 4242 4242 4242` before going live
7. **Set up a 99% discount promo code** for live-mode testing (minimum $0.50 charge)

### 2.3 Subscription Lifecycle

The subscription lifecycle is properly handled:

- **Creation:** Checkout → webhook `checkout.session.completed` → user tier upgrade + `stripeCustomerId` + `stripeSubscriptionId` stored
- **Renewal:** `invoice.payment_succeeded` → no action needed (subscription continues)
- **Cancellation:** `customer.subscription.deleted` → user downgraded to free tier, limits reset
- **Failed payment:** `invoice.payment_failed` → logged (consider adding user notification)
- **Monthly reset:** `resetMonthlyUsageIfNeeded()` auto-resets counters on the 1st of each month

### 2.4 Payment Architecture Gaps

| Gap | Severity | Recommendation |
|-----|----------|---------------|
| No email notification on failed payment | Medium | Add email/in-app notification when `invoice.payment_failed` fires |
| No grace period for failed payments | Medium | Consider keeping tier active for 3-7 days after payment failure before downgrade |
| No annual billing option | Low | Add yearly pricing at ~20% discount to improve LTV |
| No trial period | Low | Consider 7-day Artist trial for new users to drive conversion |
| Proration not explicitly configured | Low | Stripe handles this by default, but verify behavior for mid-cycle upgrades/downgrades |

---

## 3. Authentication & Security Architecture

### 3.1 Authentication Flow

Authentication uses Manus OAuth with JWT session cookies:

- **Login:** Frontend generates login URL with `window.location.origin` (no hardcoded domains) → Manus OAuth portal → callback at `/api/oauth/callback` → JWT session cookie set
- **Session:** `httpOnly` cookie with `sameSite: "none"` and `secure` flag (when HTTPS detected)
- **Context:** Every tRPC request builds context via `createContext()` → `sdk.authenticateRequest()` → `ctx.user` available
- **Protected routes:** `protectedProcedure` enforces authentication; `publicProcedure` allows anonymous access
- **Logout:** `trpc.auth.logout.useMutation()` clears session cookie

### 3.2 Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| **Authentication** | Strong | Manus OAuth with JWT, httpOnly cookies, secure flag |
| **Authorization** | Strong | `protectedProcedure` + `assertFeatureAllowed()` + ownership checks on every resource |
| **Rate limiting** | Strong | 4-tier rate limiting (global 200/min, uploads 10/min, jobs 20/min, chat 30/min) |
| **Input validation** | Strong | Zod schemas on every tRPC procedure input |
| **File upload validation** | Strong | MIME type whitelist + 50MB size limit enforced server-side |
| **Webhook security** | Strong | Stripe signature verification + idempotency table |
| **SQL injection** | Protected | Drizzle ORM parameterized queries throughout |
| **XSS protection** | Moderate | React's built-in escaping; no explicit DOMPurify for user-generated content in reviews |
| **CSRF protection** | Moderate | `sameSite: "none"` is less restrictive; mitigated by tRPC's non-standard content type |
| **Security headers** | **Missing** | No `helmet`, no CSP, no `X-Frame-Options`, no `X-Content-Type-Options` |
| **API key exposure** | Low risk | Gemini API key passed as URL query parameter (standard for Google APIs but logged in server logs) |
| **Soft delete** | Present | User deletion is soft-delete with `deletedAt` timestamp |

### 3.3 Security Action Items

1. **Add `helmet` middleware** for security headers (CSP, X-Frame-Options, HSTS, etc.)
2. **Add DOMPurify** for rendering user-generated content (review comments, annotations, track notes)
3. **Consider `sameSite: "lax"`** if cross-origin cookie sharing is not required
4. **Audit server logs** to ensure API keys are not logged in production
5. **Add account lockout** after repeated failed authentication attempts (if applicable)

---

## 4. AI Pipeline Architecture

### 4.1 Dual-Model Pipeline

Troubadour uses a sophisticated dual-model AI pipeline:

**Stage 1 — Gemini 2.5 Flash (Audio Analysis):**
- Accepts raw audio files via URL
- Performs: genre detection, sub-genre classification, influence mapping, audio feature extraction (BPM, key, energy, danceability), structure analysis, mix quality assessment
- Output: structured JSON with detected attributes

**Stage 2 — Claude Sonnet 4.5 (Written Critique):**
- Receives Gemini's analysis + user-selected focus mode
- 7 focus modes: A&R Executive, Songwriter, Producer, Mixing Engineer, Music Journalist, Fan Perspective, Full Review
- Each mode has custom system prompts, scoring dimensions, and output sections
- Output: structured markdown review with scores, sections, and actionable feedback

### 4.2 Job Queue Architecture

The job queue is well-designed for reliability:

- **Polling:** 3-second interval checking for queued jobs
- **Atomic claiming:** `UPDATE ... WHERE status = 'queued'` prevents race conditions
- **Heartbeat:** Running jobs send heartbeats every 30 seconds
- **Stale recovery:** Jobs with no heartbeat for 5+ minutes are reset to queued on server restart
- **Max attempts:** 3 attempts per job before permanent failure
- **Dependency chains:** Jobs can depend on other jobs (e.g., review depends on analysis)
- **Batch support:** Batch IDs for reviewing all tracks in a project

### 4.3 AI Pipeline Risks & Mitigations

| Risk | Severity | Current Mitigation | Recommended Additional Action |
|------|----------|-------------------|------------------------------|
| Gemini API quota exhaustion | High | Error handling in job processor | Add quota monitoring; alert owner when approaching limits |
| Claude API rate limits | High | Sequential processing | Consider implementing request queuing with backoff |
| Audio file too large for Gemini | Medium | 50MB upload limit | Gemini has its own limits; add server-side audio duration check |
| LLM hallucination in scores | Medium | Structured JSON schema enforcement | Add score range validation (1-10) post-generation |
| API key rotation | Medium | Keys in env vars | Document key rotation procedure; use short-lived tokens if available |
| Model deprecation | Low | Hardcoded model strings | Centralize model identifiers for easy updates |

---

## 5. Database Architecture

### 5.1 Schema Overview

The database uses MySQL/TiDB via Drizzle ORM with 28 migration files and the following tables:

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts & subscription state | `openId`, `tier`, `stripeCustomerId`, `stripeSubscriptionId`, `audioMinutesUsed`, `audioMinutesLimit`, `monthlyReviewCount`, `monthlyResetAt` |
| `projects` | Album/EP containers | `userId`, `name`, `status`, `coverImageUrl` |
| `tracks` | Individual audio files | `projectId`, `userId`, `storageUrl`, `storageKey`, `status`, `detectedGenre`, `parentTrackId`, `versionNumber` |
| `reviews` | AI-generated reviews | `trackId`, `projectId`, `focusMode`, `quickTake`, `fullReview`, `scoresJson`, `shareToken` |
| `jobs` | Async job queue | `type`, `status`, `trackId`, `projectId`, `progress`, `heartbeatAt`, `attempts`, `maxAttempts`, `dependsOnJobId`, `batchId` |
| `audio_features` | Extracted audio attributes | `trackId`, `bpm`, `key`, `energy`, `danceability`, etc. |
| `favorites` | User track favorites | `userId`, `trackId` |
| `conversation_messages` | Review follow-up chat | `reviewId`, `role`, `content` |
| `reference_tracks` | Reference track comparisons | `trackId`, `storageUrl`, `comparisonResult` |
| `chat_sessions` / `chat_messages` | AI chat sessions | `userId`, `projectId`, `trackId` |
| `review_templates` | Custom review templates | `userId`, `name`, `config` |
| `project_collaborators` | Shared project access | `projectId`, `userId`, `role`, `inviteToken` |
| `waveform_annotations` | Timestamped track annotations | `trackId`, `userId`, `timestamp`, `content` |
| `mix_reports` | Detailed mix analysis | `trackId`, `reportJson` |
| `structure_analyses` | Song structure breakdown | `trackId`, `analysisJson` |
| `project_insights` | AI-generated project summaries | `projectId`, `insightJson` |
| `notifications` | In-app notification system | `userId`, `type`, `title`, `content`, `read` |
| `processed_webhook_events` | Stripe webhook idempotency | `eventId`, `eventType` |
| `artwork_concepts` | AI-generated album art | `projectId`, `imageUrl`, `status` |
| `mastering_checklists` | Pre-mastering readiness | `trackId`, `itemsJson`, `overallReadiness` |
| `track_notes` | User journal entries per track | `trackId`, `userId`, `content`, `pinned` |
| `review_comments` | Collaborative review comments | `reviewId`, `userId`, `content` |

### 5.2 Database Production Readiness

| Area | Status | Notes |
|------|--------|-------|
| **Schema migrations** | 28 migrations applied | All tracked via Drizzle Kit |
| **Indexes** | Present on foreign keys | Verify composite indexes for common query patterns |
| **Connection pooling** | Managed by platform | TiDB handles connection management |
| **Soft deletes** | Users only | Consider soft deletes for projects/tracks for data recovery |
| **Backup strategy** | Platform-managed | Verify backup frequency and retention with Manus |
| **Data retention policy** | Not defined | Define how long to keep deleted user data, old reviews, job logs |
| **GDPR compliance** | Partial | Soft delete exists; need data export and full purge capabilities |

### 5.3 Database Action Items

1. **Add composite indexes** on frequently queried combinations (e.g., `(userId, projectId)` on tracks, `(trackId, status)` on jobs)
2. **Define data retention policy** — how long to keep job records, old reviews, deleted user data
3. **Add data export endpoint** for GDPR compliance (user can download all their data)
4. **Consider archiving** old job records after 90 days to keep the jobs table performant
5. **Verify TiDB SSL** is enabled for production database connections

---

## 6. Frontend Architecture

### 6.1 Tech Stack

- **React 19** with TypeScript 5.9 (strict mode)
- **Tailwind CSS 4** with shadcn/ui component library
- **tRPC 11** for end-to-end type-safe API calls
- **wouter** for client-side routing
- **Recharts** for data visualization
- **Framer Motion** for animations
- **Sonner** for toast notifications

### 6.2 Frontend Production Readiness

| Area | Status | Notes |
|------|--------|-------|
| **SEO** | Good | OG meta tags, dynamic OG for shared reviews, robots.txt |
| **Sitemap** | **Missing** | `robots.txt` references `https://firstspin.ai/sitemap.xml` but no sitemap.xml exists |
| **Error boundary** | Present | Global ErrorBoundary component wraps the app |
| **Loading states** | Present | Skeleton components and loading spinners throughout |
| **Empty states** | Present | Handled in dashboard, project view, track view |
| **Responsive design** | Good | Mobile-first with Tailwind breakpoints |
| **Accessibility** | Moderate | shadcn/ui provides ARIA attributes; custom components may need audit |
| **PWA support** | Not present | No service worker, no manifest.json |
| **Offline support** | Not present | App requires internet connection |
| **Browser support** | Good | Note: Safari Private Browsing, Firefox Strict ETP, Brave Aggressive Shields may block auth cookies |

### 6.3 Frontend Action Items

1. **Create `sitemap.xml`** with public routes (`/`, `/pricing`, `/shared/:token`)
2. **Update `robots.txt`** to reference correct domain (currently references `firstspin.ai`)
3. **Add `manifest.json`** for PWA-like experience (app icon, theme color)
4. **Add favicon variants** — verify all sizes are present in `/public`
5. **Audit keyboard navigation** across all interactive components
6. **Add `<noscript>` fallback** in `index.html`

---

## 7. Operational Infrastructure

### 7.1 Health Monitoring

The `/health` endpoint checks:
- Database connectivity (SELECT 1)
- Job queue status (queued/running/errored counts)

**Missing health checks:**
- Gemini API reachability
- Claude/Anthropic API reachability
- S3 storage connectivity
- Stripe API connectivity

### 7.2 Logging & Observability

| Component | Status | Notes |
|-----------|--------|-------|
| **Server logs** | Console output | Captured in `devserver.log` |
| **Browser logs** | Captured | `browserConsole.log`, `networkRequests.log`, `sessionReplay.log` |
| **Error tracking (Sentry)** | **Not integrated** | `SENTRY_AUTH_TOKEN` is available but not wired into the app |
| **Product analytics (PostHog)** | Scaffold only | Code exists but `VITE_POSTHOG_KEY` not set |
| **Structured logging** | Not present | Console.log/error only; no structured JSON logging |
| **Log aggregation** | Platform-managed | Manus handles log collection |
| **Alerting** | Not present | No automated alerts for errors, API failures, or quota exhaustion |

### 7.3 Observability Action Items

1. **Integrate Sentry** for error tracking — the auth token is already available as `SENTRY_AUTH_TOKEN`
2. **Activate PostHog** by setting `VITE_POSTHOG_KEY` — the scaffold is complete with user identification, event tracking, and pre-defined event helpers
3. **Add structured logging** with JSON format for production log parsing
4. **Set up alerts** for: job queue errors > threshold, API quota approaching limits, payment failures, server errors
5. **Add Gemini/Claude health checks** to the `/health` endpoint

---

## 8. Content & Marketing Infrastructure

### 8.1 SEO & Discovery

| Element | Status | Action |
|---------|--------|--------|
| Page title & meta description | Present | Good — "Troubadour — AI-Powered Music Review & A&R Intelligence" |
| OG tags (static) | Present | Title, description, image all set |
| OG tags (dynamic) | Present | Shared review pages generate custom OG tags for social sharing |
| Twitter Card | Present | Summary card with title, description, image |
| Structured data (JSON-LD) | **Missing** | Add SoftwareApplication schema for search engines |
| Canonical URLs | **Missing** | Add `<link rel="canonical">` to prevent duplicate content |
| Google Search Console | **Not configured** | Verify ownership and submit sitemap |

### 8.2 Landing Page & Conversion

The landing page features:
- Role-based value propositions (A&R, Songwriter, Producer, Mixing Engineer, Journalist, Fan)
- Feature showcase with icons and descriptions
- Clear CTA to sign up or try free
- Pricing link in navigation

**Conversion optimization opportunities:**
- Add social proof (testimonials, user count, review count)
- Add a demo/sample review that visitors can see without signing up
- Add a "How it works" section with 3-step flow
- Consider adding a free review without signup (email-gated) to capture leads

### 8.3 Domain & Branding

| Item | Current State | Action |
|------|--------------|--------|
| Domain | `*.manus.space` (auto-generated) | Purchase and configure custom domain (e.g., `troubadour.ai` or `firstspin.ai`) |
| `robots.txt` Sitemap URL | References `firstspin.ai` | Update to match actual domain |
| Brand name | "Troubadour" | Consistent across app, meta tags, and OG images |
| Favicon | Present | Verify all sizes render correctly |
| App logo | Set via `VITE_APP_LOGO` | Verify it displays correctly in all contexts |

---

## 9. User Lifecycle & Retention

### 9.1 Onboarding

| Element | Status |
|---------|--------|
| Onboarding tour | Present (`OnboardingTour.tsx`) — guides new users through key features |
| Empty state guidance | Present — dashboard shows helpful prompts when no projects exist |
| First-run experience | User can create project and upload track immediately |
| Email onboarding sequence | **Not built** — no automated welcome or drip emails |

### 9.2 Engagement & Retention

| Element | Status |
|---------|--------|
| In-app notifications | Present — bell icon with unread count |
| What's New changelog | Present — shows new features on version update |
| Weekly digest page | Present — in-app digest view at `/digest` |
| Email digest | **Not built** — no scheduled email summaries |
| Command palette | Present — keyboard shortcut for power users |
| Global search | Present — search across projects, tracks, reviews |
| Collaboration | Present — invite collaborators to projects |

### 9.3 Churn Prevention

| Element | Status | Recommendation |
|---------|--------|---------------|
| Usage tracking | Present | Monthly review count and audio minutes tracked |
| Upgrade prompts | Present | Feature gates show upgrade toast with link to pricing |
| Cancellation flow | Stripe-managed | Consider adding exit survey before cancellation |
| Win-back campaigns | Not present | Add email sequence for churned users |
| Usage alerts | Not present | Notify users when approaching plan limits |

---

## 10. Launch Checklist

### 10.1 Critical (Must Do Before Launch)

| # | Item | Category | Effort |
|---|------|----------|--------|
| 1 | **Claim Stripe sandbox** at provided URL | Payment | 5 min |
| 2 | **Complete Stripe KYC** (business details, bank account) | Payment | 1-2 days |
| 3 | **Create live Stripe products/prices** matching Free/Artist/Pro tiers | Payment | 30 min |
| 4 | **Switch to live Stripe keys** in Settings → Payment | Payment | 5 min |
| 5 | **Test full payment flow** with test card in live mode | Payment | 30 min |
| 6 | **Verify Anthropic API key** has sufficient quota for production | AI | 15 min |
| 7 | **Verify Gemini API key** has sufficient quota for audio processing | AI | 15 min |
| 8 | **Purchase and configure custom domain** | Infrastructure | 1 hour |
| 9 | **Update `robots.txt`** sitemap URL to match actual domain | SEO | 5 min |
| 10 | **Create `sitemap.xml`** with public routes | SEO | 15 min |
| 11 | **Enable notifications** in Management UI Settings → Notifications | Operations | 5 min |

### 10.2 High Priority (First Week After Launch)

| # | Item | Category | Effort |
|---|------|----------|--------|
| 12 | **Integrate Sentry** for error tracking | Observability | 2 hours |
| 13 | **Activate PostHog** analytics | Analytics | 30 min |
| 14 | **Add `helmet` security headers** | Security | 1 hour |
| 15 | **Add health checks** for Gemini, Claude, and Stripe APIs | Operations | 2 hours |
| 16 | **Set up monitoring alerts** for job failures and API errors | Operations | 2 hours |
| 17 | **Add failed payment notification** to users | Payment | 1 hour |
| 18 | **Add structured JSON logging** for production | Operations | 2 hours |
| 19 | **Verify database SSL** is enabled | Security | 15 min |
| 20 | **Submit sitemap to Google Search Console** | SEO | 30 min |

### 10.3 Medium Priority (First Month)

| # | Item | Category | Effort |
|---|------|----------|--------|
| 21 | Add JSON-LD structured data for search engines | SEO | 1 hour |
| 22 | Add canonical URLs to prevent duplicate content | SEO | 30 min |
| 23 | Add annual billing option | Payment | 2 hours |
| 24 | Add 7-day free trial for Artist tier | Payment | 2 hours |
| 25 | Build email onboarding sequence (welcome, tips, upgrade) | Marketing | 4 hours |
| 26 | Build weekly email digest (scheduled) | Retention | 4 hours |
| 27 | Add exit survey on subscription cancellation | Retention | 2 hours |
| 28 | Add data export endpoint for GDPR compliance | Legal | 3 hours |
| 29 | Add social proof to landing page (testimonials, stats) | Conversion | 2 hours |
| 30 | Add public demo review (no signup required) | Conversion | 3 hours |
| 31 | Define and implement data retention policy | Operations | 2 hours |
| 32 | Add composite database indexes for performance | Database | 1 hour |
| 33 | Add DOMPurify for user-generated content rendering | Security | 1 hour |
| 34 | Accessibility audit across all interactive components | UX | 4 hours |
| 35 | Add `manifest.json` for PWA-like experience | UX | 1 hour |

---

## 11. Revenue Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                              │
│                                                                  │
│  Landing Page → Sign Up (Manus OAuth) → Free Tier (3 reviews)   │
│       │                                                          │
│       ▼                                                          │
│  Feature Gate Hit → Upgrade Prompt → Stripe Checkout             │
│       │                                                          │
│       ▼                                                          │
│  Artist ($19/mo) or Pro ($49/mo) → Unlimited Reviews             │
│       │                                                          │
│       ▼                                                          │
│  Monthly Renewal → invoice.payment_succeeded → Continue          │
│       │                                                          │
│       ▼ (if payment fails)                                       │
│  invoice.payment_failed → [TODO: Notify user] → Retry           │
│       │                                                          │
│       ▼ (if cancelled)                                           │
│  customer.subscription.deleted → Downgrade to Free               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. API Cost Estimation

Understanding API costs is critical for pricing sustainability:

| API | Cost Per Unit | Estimated Usage Per Review | Cost Per Review |
|-----|--------------|--------------------------|----------------|
| **Gemini 2.5 Flash** (audio analysis) | ~$0.01-0.05 per audio minute | 3-5 min audio | ~$0.03-0.25 |
| **Claude Sonnet 4.5** (written review) | ~$0.003/1K input, $0.015/1K output | ~2K input, ~1.5K output tokens | ~$0.03-0.05 |
| **S3 Storage** | ~$0.023/GB/month | ~5-10MB per track | Negligible |
| **Total per review** | | | **~$0.06-0.30** |

At the **Artist tier ($19/mo)**, if a user generates 20 reviews/month, the API cost is approximately $1.20-$6.00, yielding a **68-94% gross margin**. At the **Pro tier ($49/mo)** with heavier usage (50 reviews), costs are $3.00-$15.00, yielding a **69-94% gross margin**. The pricing model is sustainable.

**Key risk:** A single power user on the Artist plan generating 100+ reviews/month could cost $6-$30 in API fees. The `audioMinutesLimit` on each tier provides a natural cost ceiling.

---

## 13. Disaster Recovery & Business Continuity

| Scenario | Current Handling | Recommended Improvement |
|----------|-----------------|------------------------|
| **Server crash** | Job queue recovers stale jobs on restart | Add monitoring alert for server restarts |
| **Database outage** | Health check returns 503 | Add automatic retry with exponential backoff |
| **Gemini API outage** | Job fails, user sees error | Add fallback: skip audio analysis, proceed with basic review |
| **Claude API outage** | Job fails, user sees error | Add fallback: use Manus built-in LLM as backup |
| **Stripe outage** | Checkout fails | Users see error; subscriptions continue (Stripe handles retries) |
| **S3 outage** | Upload fails | Display clear error message; retry button |
| **DDoS attack** | Rate limiting (200 req/min) | Consider adding Cloudflare WAF (API token available) |

---

## 14. Compliance & Legal

| Requirement | Status | Action |
|-------------|--------|--------|
| **Terms of Service** | **Not present** | Draft and add ToS page |
| **Privacy Policy** | **Not present** | Draft and add Privacy Policy page (required for Stripe, GDPR) |
| **Cookie consent** | **Not present** | Add cookie consent banner (required in EU) |
| **GDPR data export** | Not built | Add user data export endpoint |
| **GDPR right to deletion** | Partial | Soft delete exists; need full data purge option |
| **CCPA compliance** | Not assessed | Review California privacy requirements |
| **Music copyright notice** | Not present | Add disclaimer that uploaded audio is user's own work |
| **AI-generated content disclaimer** | Not present | Add notice that reviews are AI-generated, not human opinions |

---

## 15. Summary of Findings

### Production-Ready Components (No Action Needed)

- Manus OAuth authentication
- tRPC API architecture with full type safety
- Job queue with atomic claiming, heartbeat, and stale recovery
- Dual-model AI pipeline (Gemini + Claude)
- S3 file storage
- Rate limiting (4 tiers)
- Input validation (Zod on every endpoint)
- Webhook idempotency
- Monthly usage reset
- Feature gating (server + client)
- 495 passing tests, 0 TypeScript errors

### Requires Configuration (No Code Changes)

- Stripe sandbox claim + KYC + live keys
- PostHog activation (set env var)
- Sentry activation (set env var)
- Custom domain purchase
- Notification enablement
- Google Search Console setup

### Requires Development

- Security headers (helmet)
- Sitemap.xml generation
- Terms of Service / Privacy Policy pages
- Cookie consent banner
- Email notification system (payment failures, onboarding, digest)
- Structured logging
- Extended health checks
- GDPR data export
- AI-generated content disclaimer

---

*This review covers the complete Troubadour architecture as of Round 53 (February 15, 2026). The platform is architecturally mature and feature-rich. The primary gaps are operational configuration (Stripe, analytics, monitoring) and legal compliance (ToS, Privacy Policy) — both of which are standard pre-launch items for any SaaS product.*

# Troubadour - Project TODO

## Database & Schema
- [x] Design and implement full database schema (projects, tracks, lyrics, audio_features, reviews, jobs, track_versions)
- [x] Push migrations

## Backend - Core Infrastructure
- [x] File upload to S3 with signed URLs
- [x] Job queue system for async processing
- [x] tRPC routers for projects, tracks, reviews, jobs

## Backend - AI Integration
- [x] Gemini API integration for audio analysis (the "listening" engine)
- [x] Claude API integration for critique generation
- [x] Critic persona prompt system
- [x] Album-level A&R memo generation
- [x] Version comparison analysis

## Backend - Features
- [x] Track-level review with multi-dimension scoring
- [x] Album-level analysis (sequencing, cohesion, arc)
- [x] Lyrics upload and integration
- [x] Version comparison feature (v1 vs v2)
- [x] Review history and iteration tracking
- [x] Export functionality (markdown/PDF)
- [x] Email notifications when analysis completes
- [x] Usage metering (audio minutes processed)

## Frontend - Landing & Auth
- [x] Landing page with product description and CTA
- [x] Auth flow with login/logout
- [x] Dashboard with project listing

## Frontend - Project Management
- [x] Project creation (single track / album)
- [x] Audio file upload UI with progress
- [x] Track list with status chips
- [x] HTML5 audio playback controls

## Frontend - Review & Analysis
- [x] Review viewer with anchored sections
- [x] Score display (radar chart / table)
- [x] Album-level review viewer
- [x] Version comparison viewer
- [x] Review history timeline

## Frontend - Polish
- [x] Export/share reviews
- [x] Job status with progress indicators
- [x] Empty states and loading skeletons
- [x] Mobile responsive design
- [x] Dark theme with music-industry aesthetic
- [x] Rebrand from "AI Album Critic" to "Troubadour" across all pages, nav, footer, and title

## Testing
- [x] Vitest tests for auth, project CRUD, input validation, service exports
- [x] API key validation tests

## Branding - Hide AI Engine Details
- [x] Remove all references to Gemini, Claude, and specific AI model names from user-facing frontend
- [x] Replace model-specific language with generic "AI" or "Troubadour" branding
- [x] Audit landing page, dashboard, project view, track view, review view, usage page, and new project form

## Role-Based Critique System
- [x] Design critique focus areas for each role: Songwriter, Producer/Mixer, Arranger, Artist/Performer, A&R/Label
- [x] Add reviewFocus field to projects schema and push migration
- [x] Create role-specific Claude critique prompts that prioritize what each role cares about
- [x] Update Gemini analysis prompts to extract role-relevant audio features
- [x] Add role selection UI to project creation flow
- [x] Update landing page with user story-driven value propositions per role
- [x] Update review display to highlight role-relevant sections
- [x] Tests for new role-based functionality

## Feedback Improvements - Round 2
- [x] Contextual follow-up conversation after critiques (ask Claude 4.5 follow-up questions about the review)
- [x] Conversation history stored in DB with review context
- [x] Reference track comparison (upload your track + a reference, get comparative Gemini analysis)
- [x] Reference track upload UI and comparison view
- [x] Visual progress tracking across versions (improvement trajectory chart)
- [x] Score history timeline showing dimension changes across versions
- [x] Elevate A&R role prominence in landing page marketing
- [x] Tests for follow-up conversation, reference comparison, and progress tracking

## Persistent AI Chatbot Sidebar
- [x] Create chat_sessions and chat_messages DB tables for persistent conversations per project/track
- [x] Backend: Claude 4.5 contextual chat API that receives project/track/review context
- [x] Backend: Chat session CRUD (create, list messages, send message with AI response)
- [x] Frontend: Right-side collapsible chatbot toolbar component
- [x] Frontend: Chat UI with message history, streaming-style display, input box
- [x] Frontend: Context awareness - chatbot knows which project/track/review you're viewing
- [x] Frontend: Integrate chatbot into ProjectView, TrackView, and ReviewView pages
- [x] Frontend: Toggle button to open/close the chatbot panel
- [x] Tests for chat session management and message validation
## Bug Fixes - End-to-End Testing
- [x] Fix TEXT column size limits (65KB) → MEDIUMTEXT (16MB) for reviews, jobs, chat, conversation tables
- [x] Fix Claude prompt to summarize Gemini analysis before sending (248KB → compact summary)
- [x] Add max_tokens constraint to Claude API calls to prevent bloated output
- [x] Fix Quick Take extraction to handle ### headings from Claude output
- [x] Fix ReviewView to strip Quick Take and Scores sections from full review body (deduplication)
- [x] Fix score extraction regex to handle markdown table format from Claude
- [x] Update schema.ts to use mediumtext import from drizzle-orm
- [x] Validate full end-to-end pipeline: Upload → Gemini Analysis → Claude Critique → Review Display

## Automatic Genre Detection
- [x] Update Gemini prompt to explicitly detect genre/subgenre from audio (already returns genre.primary/secondary/influences)
- [x] Store detected genre in tracks table (detectedGenre, detectedSubgenres, detectedInfluences columns)
- [x] Pass detected genre to Claude so critique uses genre-appropriate vocabulary and references
- [x] Remove user-facing genre input field from NewProject form
- [x] Display detected genre as an insight badge on track/project views ("We hear: Indie Rock / Alternative")
- [x] Show genre detection in the review as contextual framing
- [x] Update Claude critique prompt to reference genre conventions and comparable artists naturally
- [x] Tests for genre detection and integration (7 tests passing)

## Round 3 - Bug Fixes & Polish
- [x] Fix Data Too Long error: truncate error messages in job processor catch block
- [x] Add retry/re-run capability for failed or stuck jobs
- [x] Add radar chart visualization for review scores
- [x] Improve score display visual hierarchy (overall score prominent, color-coded)
- [x] Polish landing page copy and visual refinements
- [x] Add "Analyze & Review" one-click flow (auto-chain analyze → review)
- [x] Improve empty states and onboarding hints
- [x] Update Claude model to claude-sonnet-4-5-20250929 (Claude Sonnet 4.5)
- [x] Update tests for new features (60 tests passing)

## Round 4 - Audit Findings Implementation (Claude 4.5)
- [x] P0: Implement database-backed persistent job queue (replace in-memory queue)
- [x] P0: Implement in-app audio player on TrackView and ReviewView
- [x] P1: Implement structured JSON score extraction from Claude (replace regex)
- [x] P1: Implement drag-and-drop file upload for tracks
- [x] P1: Add onboarding flow for new users
- [x] P1: Mobile responsiveness audit and fixes
- [x] P1: Markdown export for reviews (server-side with scores table and genre)
- [x] P1: Batch processing for multiple tracks (implemented: batchReviewAll endpoint + UI)
- [x] Cleanup: Remove unused Map.tsx component (removed in Round 19)
- [x] Update tests for all new features (69 tests passing)

## Round 5 - Strategic Features (Claude 4.5)
- [x] Batch processing: "Review All Tracks" button on ProjectView to queue Full Review on all unreviewed tracks
- [x] Batch processing: Progress indicator showing how many tracks are processing vs complete
- [x] Version diff view: Side-by-side score comparison between track versions
- [x] Version diff view: Visual delta indicators (arrows up/down with color) for each dimension
- [x] Version diff view: Claude-generated summary of what improved/regressed between versions
- [x] Shareable review links: Add shareToken column to reviews table
- [x] Shareable review links: Public read-only endpoint that doesn't require auth
- [x] Shareable review links: Share button on ReviewView that generates/copies the public URL
- [x] Shareable review links: Public review page with clean, branded layout
- [x] Update tests for all new features (82 tests passing)

## Round 6 - Strategic Features (Claude 4.5)
- [x] Progress tracking timeline: Score evolution chart showing how scores change across track versions
- [x] Progress tracking timeline: SVG line chart component with interactive hover, tooltips, and legend
- [x] Progress tracking timeline: Integrated into TrackView Progress tab with summary stats
- [x] Email notifications: Notify project owner when batch review completes
- [x] Email notifications: Use built-in notifyOwner helper for notification delivery
- [x] Email notifications: Track batch completion status via batchId in job processor
- [x] Reference track comparison: Upload reference tracks alongside original tracks (already built)
- [x] Reference track comparison: Claude-powered comparative analysis against reference (already built)
- [x] Reference track comparison: Side-by-side display of reference vs original analysis (already built)
- [x] Update tests for all new features (88 tests passing)

## Round 7 - Strategic Features (Claude 4.5)
- [x] Album-level summary report: Enhanced Claude prompt with thematic threads, sequencing, and album arc (already built)
- [x] Album-level summary report: Store album review in DB and display on ProjectView (already built)
- [x] Waveform visualization: Replace progress bar in audio player with rendered waveform
- [x] Waveform visualization: Generate waveform data from audio using Web Audio API
- [x] Waveform visualization: Interactive playback position on waveform with click-to-seek
- [x] Review history: Keep previous reviews with auto-incrementing reviewVersion
- [x] Review history: Display review history timeline on TrackView with version badges and score deltas
- [x] Review history: Navigate to any historical review version
- [x] Update tests for all new features (95 tests passing)

## Round 8 - Smart Features & Analytics (Claude 4.5)
- [x] Smart re-review: Pass previous review to Claude when re-reviewing a track so it comments on changes
- [x] Smart re-review: Claude highlights what improved, what regressed, and whether prior suggestions were addressed
- [x] Smart re-review: Visual indicator on review showing it's a follow-up review with context
- [x] Tag/label system: Add tags column to tracks table and push migration
- [x] Tag/label system: Backend CRUD for adding/removing tags on tracks
- [x] Tag/label system: Tag input UI on TrackView with preset suggestions (needs mixing, ready for mastering, single candidate, etc.)
- [x] Tag/label system: Tag filter/display on ProjectView track list
- [x] Dashboard analytics: Aggregate stats (average scores, total tracks, total audio minutes)
- [x] Dashboard analytics: Top rated tracks across all projects
- [x] Dashboard analytics: Score distribution visualization
- [x] Dashboard analytics: Recent activity feed
- [x] Update tests for all new features (121 tests passing)

## Round 9 - Narrow & Polish (Claude 4.5)
- [x] Fix "1 tracks" grammar → "1 track" (singular) on Dashboard project cards
- [x] Fix project card status: show "Reviewed" or "In Progress" based on actual track status instead of always "Pending"
- [x] Analytics "Recent Reviews" shows track filename instead of generic "Track" badge
- [x] Simplified sidebar: removed redundant "New Project" nav item (already a button on Dashboard)
- [x] Analytics empty state now guides user to create a project and upload first track
- [x] Consistent loading states and error handling across pages

## Round 10 - GPT-5 Audit Fixes (P0 + P1)

### P0 - Database Integrity
- [x] Add foreign key constraints with ON DELETE CASCADE for all relationship columns
- [x] Add missing indexes for all frequent query patterns (userId, projectId, trackId, status, batchId)
- [x] Add UNIQUE constraints (reviews.shareToken, lyrics trackId+source, audioFeatures trackId)
- [x] Fix deleteProject to rely on FK cascades (simplified from manual multi-table delete)
- [x] Wrap createReview versioning in a transaction with row locking

### P0 - Job Queue Safety
- [x] Implement atomic job claiming with UPDATE...WHERE status=queued (atomic swap)
- [x] Add heartbeat/lease fields to jobs table (heartbeatAt, maxAttempts, attempts columns)
- [x] Add job dependency handling (dependsOnJobId column, skip jobs whose dependency isn't complete)
- [x] Add stale job recovery (resetStaleRunningJobs checks heartbeatAt)

### P0 - Usage Enforcement
- [x] Gate job creation (analyze, review, compare, analyzeAndReview) with assertUsageAllowed check
- [x] Block operations when over limit with clear message showing used/limit

### P0 - Security
- [x] Add server-side file validation (MIME allowlist of 11 audio types, 50MB size cap)
- [x] Add LLM call timeouts (Claude: 120s, Gemini: 180s) and retry with exponential backoff (2 retries)
- [x] Server-side version numbering (compute next version on server, ignore client-sent value)

### P1 - Frontend Quality
- [x] Normalize score keys server-side (camelCase) to eliminate overall/Overall duality
- [x] Add keyboard accessibility to clickable cards (Dashboard project cards, ProjectView track names)
- [x] Add aria-labels to icon-only buttons (back arrow, file inputs)
- [x] Surface job error messages in UI (TrackView shows error banner with job errorMessage)
- [x] Extract shared score color/glow utility to avoid duplication across files (Round 19: client/src/lib/scoreColor.ts)

### P1 - Test Coverage
- [x] Add tests for usage gating on job creation (4 tests: blocks analyze/review/analyzeAndReview over limit, allows under limit)
- [x] Add tests for server-side file validation (4 tests: rejects bad MIME, rejects >50MB, accepts MP3, accepts WAV)
- [x] Add tests for server-side version numbering, job error surfacing, score normalization, new db helpers (10 tests)
- [x] All 137 tests passing

## Round 11 - UI Redesign (Fun & Vibrant)
- [x] Replace dark/black theme with warm indigo-to-slate palette + coral/amber accents
- [x] Add Space Grotesk display font for all headings across every page
- [x] Reworked CSS variables in index.css with OKLCH warm color system
- [x] Restyled Dashboard: gradient cards, onboarding steps, warmer status badges
- [x] Restyled ProjectView and TrackView with Space Grotesk headers
- [x] Restyled Analytics page with emerald/sky/amber/rose chart colors
- [x] Redesigned landing page: vibrant hero, role carousel, A&R callout section
- [x] Updated sidebar/navigation with Space Grotesk branding
- [x] Unified score colors across all pages (emerald/sky/amber/rose), updated RadarChart
- [x] Batch-updated all color references across 9+ component files for consistency

## Round 12 - Tier 1 Business-Critical (Claude 4.5 Audit)
- [x] Stripe payment integration (checkout, subscription management, webhook handling)
- [x] Pricing page with clear free/Artist/Pro tiers and CTAs
- [x] Free tier limits enforced (assertUsageAllowed on all job endpoints with tier-aware messaging)
- [x] Upgrade prompts when free users hit limits (toast with Upgrade button → /pricing)
- [x] Onboarding flow (3-step How It Works cards on empty Dashboard, AI engine branding fixed)
- [ ] PostHog analytics tracking (DEFERRED - user to provide API key later)
- [x] Tests for payment and tier enforcement (137 tests passing)

## Round 13 - Infrastructure Audit Fixes (Claude 4.5)

### P0 - Ship Blockers
- [x] assertFeatureAllowed helper: check user tier against gated features
- [x] Gate chat endpoints (conversation.sendMessage, chat.createSession, chat.sendMessage)
- [x] Gate version comparison (job.compare, review.versionDiff)
- [x] Gate reference comparison (reference.compare)
- [x] Gate share links (review.generateShareLink)
- [x] Gate analytics (analytics.dashboard, analytics.topTracks, analytics.recentActivity)
- [x] Gate album review (job.albumReview)
- [x] Gate batch review (job.batchReviewAll)
- [x] Gate export (review.exportMarkdown)
- [x] Monthly review count: add column, increment on review jobs, enforce limit for free users
- [x] Usage counter monthly reset: add monthlyResetAt column, reset logic
- [x] Webhook idempotency: processedWebhookEvents table, check before processing
- [x] Stripe price ID persistence: save created price IDs for tier mapping
- [x] tierFromPriceId: smart lookup via Stripe API price amount instead of hardcoded IDs

### P1 - Launch Risks
- [x] Add invoice.payment_failed handler with user notification and attempt tracking
- [x] Add invoice.payment_succeeded handler for recurring payment confirmation
- [x] Job retry: add assertUsageAllowed check
- [x] Lyrics transcribe: add assertUsageAllowed check
- [x] Rate limiting on sensitive endpoints (upload, job creation, chat)
- [x] OG tags for shared review pages (bot-friendly meta tags with review preview)
- [x] Health check endpoint (/health)
- [x] Tests for feature gating, monthly limits, webhook idempotency, OG tags (169 tests passing)

## Round 14 - Final P1 Launch Risks (Claude 4.5)
- [x] Rate limiting: express-rate-limit on upload (10/min), job creation (20/min), chat (30/min), global (200/min)
- [x] Health check endpoint: /health returning DB connectivity and job queue status
- [x] Tests for rate limiting and health check (180 tests passing)

## Round 15 - User Story Simulations (Claude 4.5)
- [x] US1: New visitor landing page — hero, value prop, pricing, CTA flow (verified)
- [x] US2: Free tier user — signup → upload → analyze → review full pipeline (verified)
- [x] US3: Free tier limit enforcement — monthly review cap, usage cap, upgrade prompts (verified)
- [x] US4: Artist tier — chat, share, analytics, export gating verified with upgrade prompts
- [x] US5: Pro tier — album review, batch processing, version comparison (gating verified)
- [x] US6: Stripe checkout — pricing page has navigation, CTAs work
- [x] US7: Shared review link — OG meta tags verified
- [x] US8: Mobile responsiveness — reviewed layout structure

### Issues Found & Fixed
- [x] FIX: Pricing page had no navigation — added Back button + Troubadour logo header
- [x] FIX: Usage page missing monthly review count — added Monthly Reviews card with progress bar
- [x] FIX: Usage page missing billing cycle reset date — added Billing Cycle Reset card
- [x] FIX: Usage engine cards showed no data — now show Active status for all engines
- [x] FIX: Analytics page infinite skeleton for free users — now shows "Unlock Analytics" upgrade prompt
- [x] FIX: Chat panel showed input for free users → 403 toast at top of page — replaced with inline upgrade CTA with lock icon
- [x] FIX: conversation.list fired 403 for free users — disabled query when tier is free
- [x] FIX: Export .md button had no visual hint for gated feature — added Lock icon for non-pro users
- [x] FIX: Share button had no visual hint for gated feature — added Lock icon for free users
- [x] All 180 tests passing after fixes

## Round 16 - Full Site Sweep (Claude 4.5)
- [x] Audit all console errors and network failures
- [x] Audit Dashboard page
- [x] Audit Dashboard and sidebar navigation
- [x] Audit ProjectView / TrackView pages
- [x] Audit ReviewView page (review content, chat, export, share)
- [x] Audit Usage page
- [x] Audit Analytics page
- [x] Audit Pricing page
- [x] Audit Landing page (unauthenticated)
- [x] Audit shared review page
- [x] Fix all identified issues

### Issues Found & Fixed
- [x] FIX: Pricing page missing "Analytics dashboard" in Artist tier feature list
- [x] FIX: Removed redundant xForwardedForHeader:false validate overrides (trust proxy already set)
- [x] FIX: Added Pricing link to sidebar navigation (Crown icon)
- [x] VERIFIED: conversation.list query properly disabled for free users
- [x] VERIFIED: JSX fragment error was transient HMR issue, now resolved
- [x] VERIFIED: X-Forwarded-For trust proxy error resolved (no new occurrences since fix)
- [x] VERIFIED: Shared review page shows clean error state for invalid tokens
- [x] All 180 tests passing
## Round 17 - Settings Page & Stripe Safety (Claude 4.5)
- [x] Audit Stripe webhook handlers — CONFIRMED: only touches user subscription fields, never projects/tracks/reviews
- [x] Build Settings page: Account info, Subscription management, Notifications, Danger Zone
- [x] Add Settings link to sidebar navigation (gear icon)
- [x] Wire Settings page to existing tRPC endpoints (auth.me, subscription.status, subscription.checkout, subscription.manageBilling)
- [x] Verify Stripe checkout flow doesn't touch existing data — CONFIRMED SAFE
- [x] All 180 tests passing

## Round 18 - Delete Account Flow (Claude 4.5)
- [x] Add deletedAt column to users table for soft-delete
- [x] Backend: subscription.deleteAccount endpoint (cancel Stripe subscription, soft-delete user, clear session)
- [x] Backend: Exclude soft-deleted users from auth context (getUserById/getUserByOpenId filter isNull(deletedAt))
- [x] Frontend: Confirmation dialog with "type DELETE to confirm" safety check
- [x] Frontend: Wire Delete Account button in Settings Danger Zone
- [x] Tests for delete account flow (6 tests: auth, confirmation, soft-delete, Stripe cancel, Stripe failure resilience, user not found)
- [x] All 186 tests passing

## Round 19 - Production Readiness & Cleanup (Claude 4.5)
- [x] Extract shared scoreColor utility to client/src/lib/scoreColor.ts (replaced in ReviewView, TrackView, SharedReview, Analytics, RadarChart)
- [x] Remove unused Map.tsx component
- [x] Remove unused ComponentShowcase.tsx page
- [x] Add SEO meta tags to index.html (description, og:title, og:description, og:image, twitter:card)
- [x] Add robots.txt for search engine crawling
- [x] Add favicon (vinyl record icon — favicon.ico + apple-touch-icon)
- [x] Final visual sweep: all pages render clean, zero console errors, zero TSC errors, JobQueue errors resolved
- [x] All 186 tests passing

## Round 20 - PostHog Analytics & Final Polish (Claude 4.5)
- [x] Install posthog-js and wire PostHog client-side analytics
- [x] Track key events: review_completed, upgrade_clicked, feature_gated, project_created, track_uploaded
- [x] Identify users on login with tier, email, name
- [x] Verify Stripe checkout flow end-to-end (redirect fixed: window.open → window.location.href)
- [x] Add upgrade success toast on Dashboard when returning from Stripe checkout
- [x] Fix any remaining edge cases from final sweep
- [x] All 186 tests passing


## Round 21 - Rebrand to "Troubadour" (Troubadour LA venue color scheme)
- [x] Research Troubadour venue visual identity and color palette
- [ ] Update VITE_APP_TITLE to Troubadour (user must update in Settings → Secrets)
- [x] Replace all "FirstSpin.ai" text references across codebase with "Troubadour" (13+ files)
- [x] Update CSS theme colors to match Troubadour venue aesthetic (crimson red, dark brown, indigo, amber)
- [x] Update landing page copy and visual elements for new brand
- [x] Update sidebar/nav branding (UnifrakturMaguntia blackletter font)
- [x] Verify all pages render correctly with new branding
- [x] All 186 tests passing after rebrand

## Round 22 - Comprehensive Claude 4.5 Code Audit
- [x] Collect and analyze all error logs (devserver, browser console, network)
- [x] Audit backend: schema integrity, routers, services, job processor, Stripe webhooks
- [x] Audit frontend: all pages, components, routing, state management, hooks ordering
- [x] Fix BUG 1: Job dependency race condition - analyzeAndReview/batchReviewAll now set dependsOnJobId
- [x] Fix BUG 2: deleteAccount cookie clearing - use COOKIE_NAME + getSessionCookieOptions (was hardcoded "session")
- [x] Fix BUG 3: Remove redundant customer ID save in checkout (webhook already handles it)
- [x] Run full test suite and visual verification
- [x] All 186 tests passing, zero TypeScript errors

## Round 23 - Comprehensive User Story Walkthrough (Claude 4.5)
- [x] Story 1: Landing page — hero, features, pricing, testimonials, CTA all coherent and branded
- [x] Story 2: Onboarding — project creation form with type/genre/focus/notes, proper validation
- [x] Story 3: Track upload — drag-and-drop, analyze & review flow, job queue integration
- [x] Story 4: Review consumption — scores, radar chart, audio player, markdown rendering all working
- [x] Story 5: Advanced features — Analysis/Reviews/Lyrics/Reference tabs, chat sidebar, tags. FIXED: model name leak
- [x] Story 6: Sharing/export — branded public review page, copy/export buttons, proper gating
- [x] Story 7: Billing — pricing matches actual gating logic, usage page accurate, Stripe checkout working
- [x] Story 8: Settings — account info, subscription, notifications, danger zone all clean
- [x] Fix: replaced raw model name "claude-sonnet-4-5-20250929" with "Troubadour" in TrackView review cards
- [x] All 186 tests passing

## Round 24 - GPT-5 Comprehensive End-to-End Audit
- [x] Gathered full codebase inventory (59 source files, 14,500+ lines)
- [x] GPT-5 audit: Backend — schema, routers, services, jobs, Stripe, security
- [x] GPT-5 audit: Frontend — all pages, components, state management, UX
- [x] GPT-5 audit: Infrastructure — database, S3, auth, webhooks, rate limiting
- [x] GPT-5 audit: Business readiness — billing, onboarding, analytics, compliance
- [x] GPT-5 audit: Every site page and surface — visual and functional walkthrough
- [x] P0 FIX: Added FK constraints (jobs.dependsOnJobId, reviews.comparedTrackId, tracks.parentTrackId)
- [x] P0 FIX: Added parentTrack ownership check in track.getVersions (authorization bypass)
- [x] P1 FIX: Added unique indexes on stripeCustomerId and stripeSubscriptionId
- [x] P1 FIX: Added track ownership verification in job.retry
- [x] P1 FIX: Added error state handling to Dashboard
- [x] P1 FIX: Clarified fallback export toast in ReviewView
- [x] P1 FIX: Rewrote NotFound page with Go Back button and dark theme
- [x] P2 FIX: Added file validation (audio type + 50MB) to version upload in TrackView
- [x] P2 FIX: Extracted shared formatLabel utility to lib/utils.ts
- [x] P2 FIX: Added link to main site in SharedReview footer, removed model name
- [x] All 186 tests passing, zero TypeScript errors

## Round 25 - Execute GPT-5 Audit Findings with Claude 4.5
- [x] P1: Stripe webhook lifecycle handlers — already implemented (customer.subscription.updated/deleted, invoice.payment_failed/paid)
- [x] P1: Fix pricing page downgrade button logic for free users
- [x] P1: Fix pricing page button text for logged-out users on paid plans
- [x] P1: Add proper ARIA tab semantics to landing page role selector
- [x] P1: Create centralized useFeatureGate hook (client/src/hooks/useFeatureGate.ts)
- [x] P1: Better lyrics transcription error messages
- [x] P1: Format audio features display (timeSignature as "4/4", instrument badges, no JSON.stringify)
- [x] P2: Memoize Waveform component with React.memo
- [x] P2: Add ARIA attributes and keyboard support to both DropZone variants (min-h-[44px], focus ring)
- [x] P2: Improved Analytics empty state with CTA
- [x] P2: Track failed files in multi-upload batch (per-file error handling + summary toast)
- [x] All 186 tests passing, zero TypeScript errors
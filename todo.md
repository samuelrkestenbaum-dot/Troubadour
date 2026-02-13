# FirstSpin.ai - Project TODO

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
- [x] Rebrand from "AI Album Critic" to "FirstSpin.ai" across all pages, nav, footer, and title

## Testing
- [x] Vitest tests for auth, project CRUD, input validation, service exports
- [x] API key validation tests

## Branding - Hide AI Engine Details
- [x] Remove all references to Gemini, Claude, and specific AI model names from user-facing frontend
- [x] Replace model-specific language with generic "AI" or "FirstSpin" branding
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
- [ ] P1: Batch processing for multiple tracks
- [ ] Cleanup: Remove unused Map.tsx component
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

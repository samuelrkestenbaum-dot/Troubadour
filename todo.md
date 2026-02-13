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

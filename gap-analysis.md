# Troubadour Gap Analysis — Round 74

## Outstanding [ ] Items from todo.md

### Infrastructure (from Round 73.5)
1. [ ] Sentry DSN Setup — Create Sentry project, inject SENTRY_DSN + VITE_SENTRY_DSN
2. [ ] Slack notification toggle in admin settings UI
3. [ ] Provide SLACK_WEBHOOK_URL when workspace ready
4. [ ] HubSpot sync toggle in admin settings UI
5. [ ] Provide HUBSPOT_ACCESS_TOKEN when Private App created

### From Round 55
6. [ ] Request Sentry DSN via webdev_request_secrets (duplicate of #1)
7. [ ] Request Postmark API token (DONE in 73.5)
8. [ ] Request Postmark sender email (DONE in 73.5)

### From Round 58 Polish
9. [ ] Add keyboard shortcuts help dialog (? key) — DONE in Round 59
10. [ ] Add "Copy review as Markdown" — DONE in Round 59
11. [ ] Add retry with exponential backoff — DONE in Round 59

### From Round 63 User Story Testing
12. [ ] Test landing page and onboarding tour flow
13. [ ] Test auth login/logout flow
14. [ ] Test Dashboard navigation, quick stats, activity feed
15. [ ] Test project creation and project view
16. [ ] Test track upload and track view
17. [ ] Test review request and review view
18. [ ] Test review sharing and public shared review page
19. [ ] Test Settings page (profile, digest, notifications)
20. [ ] Test Tags management page
21. [ ] Test Templates page and template selector
22. [ ] Test Analytics page
23. [ ] Test Pricing/Usage page
24. [ ] Test Benchmarks page
25. [ ] Test keyboard shortcuts (?, Ctrl+K, G+D, etc.)

### From Round 65 Admin Dashboard
26. [ ] Create admin.getUsers tRPC procedure — DONE in Round 65+
27. [ ] Create admin.getStats tRPC procedure — DONE in Round 65+
28. [ ] Create AdminDashboard.tsx page — DONE in Round 65+
29. [ ] Register /admin route — DONE in Round 65+
30. [ ] Add Admin nav item — DONE in Round 65+
31. [ ] VITE_POSTHOG_KEY not yet provided — DONE in Round 68

### From Round 34
32. [ ] Send notification email when review completes on shared project (needs Postmark — NOW AVAILABLE)

## Actionable Items for Round 74

### Must Do (Code Changes)
- A. Wire Slack + HubSpot toggles into AdminSettingsTab
- B. Send review-complete email to collaborators (Postmark now configured)
- C. Sentry DSN setup via MCP
- D. Mark stale [ ] items as [x] where already completed

### Should Do (Quality)
- E. Run Gravito governance on all Round 73.5 changes
- F. Write vitest tests for new admin toggles and collaborator email
- G. Full test suite run + TypeScript check

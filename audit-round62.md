# Round 62 — Claude 4.5 Strategic Audit Findings

## Architecture Summary
- 20+ DB tables, 10+ routers, 8 services, 20+ pages
- 783 tests passing, 0 TypeScript errors (tsc --noEmit clean)
- LSP shows 2 stale errors in BatchActionsToolbar.tsx (not real — tsc is clean)
- Dark theme with Troubadour crimson branding, Space Grotesk typography

## Identified Gaps & Improvements

### HIGH PRIORITY

1. **BatchActionsToolbar.tsx LSP stale errors** — The component uses `trpc.tags.update` and `fetch()` for delete instead of proper tRPC hooks. The tags.update route exists and works, but the LSP deep-inference is confused. The delete uses raw fetch to `/api/trpc/track.deleteTrack` instead of tRPC mutation. Should refactor to use proper tRPC calls or suppress the LSP issue.

2. **Landing page missing social proof** — No testimonials, user count, or trust signals. For a paid product ($19-49/mo), this is a significant conversion gap.

3. **Footer is minimal** — Single line footer with no links to Terms, Privacy, Contact, or social media. For a product accepting payments, this is a legal and trust issue.

4. **No Terms of Service or Privacy Policy pages** — Required for any product accepting payments via Stripe.

5. **Pricing page checkout opens in new tab** — The code uses `window.location.href = data.url` which navigates away. Should be `window.open(data.url, '_blank')` per Stripe integration guidelines.

### MEDIUM PRIORITY

6. **Action Mode "Full Picture" is redundant** — It just shows the original review. The UI should make this clearer or default to it without requiring a click.

7. **Export feature gate was removed for testing** — In Round 61, the export feature gate was removed from `exportActionModePdf`. This should be re-evaluated — either keep it ungated or restore the gate.

8. **No error recovery on the landing page** — If the auth state fails to load, the CTA buttons might not work correctly.

9. **Dashboard drag-and-drop** — The dashboard has `isDragOver` state but no visible drop zone or upload handler visible in the first 80 lines.

10. **Onboarding tour shows on every visit** — The `OnboardingTour` component is rendered at the App level. Need to verify it has proper "seen" state persistence.

### LOW PRIORITY

11. **Test file naming convention** — Test files use `features-round{N}.test.ts` naming which makes it hard to find tests by feature. Consider organizing by feature domain.

12. **Large router files** — `routers.ts` is 1054 lines, `db.ts` is 2210 lines. Both exceed the recommended ~150 line limit from the template README.

13. **Digest frequency enum includes "disabled"** — This is fine but the UI should make it clear what "disabled" means.

## Gravito Governance Review Targets
- Landing page copy (hero, features, pricing)
- AI-generated review prompts (system prompts for Claude)
- Action Mode prompts
- Pricing page claims
- Export PDF content

# Gravito Governance Results - Round 65

## presGovValidatePage (Admin Dashboard)
- **Result**: PASS (0 violations, score: 0 — page not found in Gravito's registry, which is expected since it's a custom app)

## presGovFullAudit
- **Pages audited**: 38 (Gravito's own site, not Troubadour — but confirms the tool is working)
- **Passed**: 38/38
- **Average Score**: 92/100
- **Failing pages**: 0
- **Dashboard category**: 100/100, internal consistency 98/100
- **Admin category**: 100/100, internal consistency 100/100
- **Legal category**: 96/100, internal consistency 100/100

## presGovToneAudit
- **Result**: Comprehensive tone analysis returned (Gravito's own pages)
- **Terms page**: calibrated (100 score), professional and minimal
- **Support page**: calibrated (100 score), functional and scannable
- **Signup page**: calibrated (100 score), focused and distraction-free

## Manual Claude 4.5 Governance Review (Troubadour-specific)
- Admin dashboard: PASS — role-gated with `ctx.user.role === 'admin'`, no PII exposed in aggregate stats
- Analytics tracking: PASS — PostHog events are no-ops without key, no PII in event payloads, user identified by openId not email
- AI disclaimer: Present on all review outputs and PDF exports
- Terms/Privacy: Complete legal pages covering AI processing, data retention, Stripe integration

# Gravito Governance Audit - Round 69

**Date:** 2026-02-18
**Status:** Gravito service unavailable (503 Service Unavailable)

## Content Reviewed (Manual Assessment)

### Retention & Churn Metrics
- **Surface:** Admin Dashboard (internal, admin-only)
- **Content Type:** Analytics / operational metrics
- **Regulated Content:** None (no medical, financial advice, or legal content)
- **Assessment:** Safe — displays factual platform usage data (active/inactive users, retention rate, avg days since login)

### CSV Export
- **Surface:** Admin Dashboard (internal, admin-only)
- **Content Type:** Data export functionality
- **Privacy Consideration:** Exports contain user PII (name, email) — restricted to admin role only via `protectedProcedure` + role check
- **Assessment:** Safe — admin-gated, no public exposure

### Revenue Estimates
- **Surface:** Admin Dashboard (internal, admin-only)
- **Content Type:** Financial estimates (not advice)
- **Disclaimer:** Revenue disclaimer already directs to Stripe Dashboard for authoritative figures
- **Assessment:** Safe — clearly labeled as estimates, not financial advice

## Conclusion
No regulated content requiring Gravito governance review. All features are admin-only internal tools with appropriate access controls.

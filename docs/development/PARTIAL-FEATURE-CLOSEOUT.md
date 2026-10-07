# Partial feature closeout

User request: continue all six partial features without another approval round; preserve the zero-spend first launch. Original 41 now 32 Complete / 4 Partial / 5 Not picked. This does not certify charging customers.

Completed #33 plan-based entitlement enforcement and #38 admin suspension. Four externally dependent or paid-feature partials remain: #16 alerts, #30 free/paid plans, #34 reminders, #35 calendar sync. Production has no email API/sender or Google/Outlook calendar OAuth credentials. Connected Codex mail/calendar tools cannot supply JobPilot backend credentials or certify its OAuth flows. No fabricated credentials, receipt or subscriptions.

Implementation: native Auth suspension with immutable reasons, restore, stale-state protection, no self/admin suspension; native refresh sessions revoked and fresh restrictive RLS applied on public private tables plus Storage. Shared server getUser validates current account access. Background Autopilot and delivery/calendar claims reject suspended subjects; skipped delivery is not a provider failure.

Plans: free launch plus Candidate Pro and recruiter Starter/Growth/Enterprise complimentary tiers. Audited admin assignment, max 90 days, verified recruiter requirement, service-only mutations. Effective limits drive atomic daily attempts/search/interview quotas and active-posting caps. Expiry restores free limits without resetting already consumed usage. No checkout/card/renewal/pricing activation; public copy states these are complimentary pilots. Owned assignments included in export and Auth deletion cascade.

Relevant files: `lib/supabase/server.ts`, suspension/plan admin APIs and components, `lib/plans`, `app/(public)/plans/page.tsx`, common quota/delivery workers and account export. Two migrations `20261007083145_account_suspension_controls.sql`, `20261007083436_plan_entitlement_controls.sql` applied after isolated reconstruction and exact dry run. Read-only verification confirms two records, four tiers, browser write denials, 54 restrictive policies and zero live account modifications.

Production browser push configured using newly generated matching VAPID keys as secrets; temporary local key files deleted. Each recipient still needs browser permission/device registration and preferences. Existing daily workers perform consented delivery; real receipt not verified by mocked provider tests. Email remains disabled. Missing production OAuth client IDs/secrets prevent real Google/Outlook connection despite passing existing provider/route tests.

Validation: 219 Node tests, 26 SQL security files, lint, TypeScript/webpack build, database advisors with no issues; additional existing-calendar suspension and verified-recruiter posting-cap tests pass. Mobile forms exercised with local-only fetch fixtures; restored before final build. Public catalog verified against live database at 390px. Production backup/restore, signed-in real pilot, receipt, calendar round-trip, legal/hosting and monetization remain release gates.

Next work requires real email sender/API and Google/Outlook OAuth configuration, candidate/device consent and calendar round-trip, followed by the post-free-launch payment/billing scope. No further user permission question asked; missing setup remains explicit.

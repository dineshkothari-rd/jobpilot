# Launch phases 11–14 handoff

> Historical delivery evidence. Current pricing, activation, implementation status and provider limitations are defined by [Revenue operation](REVENUE-FOUNDATION.md), [current progress](../product/PRODUCTION-PROGRESS.md) and [implementation reference](../IMPLEMENTATION-REFERENCE.md).

Goal: continue the free first-launch roadmap, without paid dependencies. Business: JobPilot; authorized support: dineshkothari2021@gmail.com.

Implemented public `/plans`, atomic database usage consumption for common manual/scheduled Autopilot, candidate searches and interview AI, existing posting cap from the same public policy, private Profile usage dashboard, and immutable reasoned admin-role changes. Admin writes serialize and recheck native roles under lock; self changes and stale expected roles are blocked. Existing browser RLS uses a fresh database admin check, so a stale token cannot retain revoked privileges. No suspension/paid checkout introduced.

Relevant code: `lib/plans`, `app/(public)/plans`, `app/api/plans/usage`, `components/plan-usage.tsx`, `app/api/admin/roles`, `components/admin-role-control.tsx`, common Autopilot service and recruiter/interview routes. Usage included in account export and Auth cascade deletion.

Migrations `20261007080231_free_launch_allowances.sql` and `20261007080241_admin_role_controls.sql` applied after isolated reconstruction, 24 SQL security files and exact two-migration dry run. Production read-only checks confirm both records, four policies, service-only mutations and no stale JWT admin policies. No live role modifications or quota-consuming test calls.

Limits: 5 Autopilot attempts, 50 search page requests, 100 interview AI actions per UTC day; 100 nonclosed company postings. Reset 00:00 UTC / 05:30 IST. Admitted failures count; existing package/safety caps remain. Usage keeps roughly 35 days per account, pruning on successful consumption; no billing retention guarantee.

Validation: 216 Node tests, 24 SQL security files, lint, webpack production build including TypeScript, database advisors (no issues). Actual public page renders live policy; 390px local usage and role form checks pass without overflow. Private browser fixtures restored before final build.

Original 41: 30 Complete / 6 Partial / 5 Not picked. See product progress for feature names. Launch capabilities complete in implementation do not certify real signed-in user/provider delivery. Paid plans, entitlements, checkout, invoices, suspension, provider acceptance, production recovery drill, legal review and commercial hosting remain pending.

Next action after review: choose the next free-launch gap from remaining partials; no payment activation or hosting upgrade authorized merely by this implementation.

Implementation `027424a` is committed, pushed and deployed successfully. All 18 live read-only public/protected-route checks pass. Live `/plans` renders all allowances with the production canonical URL and no overflow at 390px. Local validation database stopped with data retained; temporary browser fixtures removed. Real authenticated role/usage/provider and recovery acceptance remain pending.

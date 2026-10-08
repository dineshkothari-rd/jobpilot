# Current implementation reference

Reconciled 2026-10-08. This inventory covers source locations, not a claim that every external provider or authenticated user journey has passed production acceptance. Detailed behavior remains in the linked domain references. Regenerate/reconcile when routes, migrations or settings change.

## Domain documentation map

| Domain | Behavior, setup and limits | Implementation |
|---|---|---|
| Authentication, account and privacy | [Authentication](flows/authentication.md), [security](security/README.md) | `app/auth`, `app/api/account`, `lib/supabase` |
| Resume, matching, applications, interviews, learning, portfolio and My Day | [Feature inventory](product/FEATURES.md), [user flows](README.md#user-flows), [AI](ai/README.md) | `lib/resume`, `lib/jobs`, `lib/applications`, `lib/interviews`, `lib/learning`, `lib/portfolio`, `lib/my-day` |
| Recruiter, verification, discovery, communications, branding and moderation | [Recruiter batch](development/RECRUITER-BATCH.md), [Phases 3–4](development/LAUNCH-PHASES-3-4.md), [Phases 7–10](development/LAUNCH-PHASES-7-10.md) | `app/api/recruiter`, `app/api/hiring-messages`, `app/api/admin`, `lib/recruiter` |
| Billing, paid plans, credit packages, refunds and disputes | [Revenue guide](development/REVENUE-FOUNDATION.md) | `app/api/billing`, `lib/billing`, `lib/plans` |
| Alerts and reminders | [Reminders](development/REMINDERS.md), [Phases 3–4](development/LAUNCH-PHASES-3-4.md) | `lib/notifications`, `app/api/cron`, `public/push-sw.js` |
| Calendar OAuth and two-way sync | [Calendar guide](development/CALENDAR-SYNC.md) | `app/api/calendars`, `lib/calendars` |
| Launch, deployment and recovery | [Deployment](../DEPLOYMENT.md), [operations](development/LAUNCH-OPERATIONS.md), [testing](development/TESTING.md) | `scripts`, `vercel.json`, `next.config.ts`, `proxy.ts` |
| Interface, interaction and accessibility | [UI review](ux-audit.md) | `app/page.tsx`, `components/career-preview.tsx`, `components/layout`, `app/globals.css` |

## Route handler inventory

Each row links directly to the authoritative request validation, response fields and error branches. Signed-in handlers must validate the current native account; privileged service calls additionally enforce owner/role/verification. Public callback, provider webhook and cron exceptions authenticate with their dedicated OAuth/signature/bearer mechanisms. JSON mutations use their existing size/origin validation helpers; do not assume every legacy handler has identical status codes. [Detailed API contracts](api/README.md), [billing contracts](development/REVENUE-FOUNDATION.md), [calendar contracts](development/CALENDAR-SYNC.md).

| Path | Methods | Source |
|---|---|---|
| `/api/account` | GET, DELETE | [Handler](../app/api/account/route.ts) |
| `/api/admin/company-verifications` | GET, PATCH | [Handler](../app/api/admin/company-verifications/route.ts) |
| `/api/admin/operations` | GET, PATCH | [Handler](../app/api/admin/operations/route.ts) |
| `/api/admin/plans` | GET, PATCH | [Handler](../app/api/admin/plans/route.ts) |
| `/api/admin/readiness` | GET | [Handler](../app/api/admin/readiness/route.ts) |
| `/api/admin/roles` | GET, PATCH | [Handler](../app/api/admin/roles/route.ts) |
| `/api/admin/suspensions` | GET, PATCH | [Handler](../app/api/admin/suspensions/route.ts) |
| `/api/ai/interview` | POST | [Handler](../app/api/ai/interview/route.ts) |
| `/api/applications/[id]/events` | GET | [Handler](../app/api/applications/[id]/events/route.ts) |
| `/api/applications/answers` | PUT | [Handler](../app/api/applications/answers/route.ts) |
| `/api/applications` | GET, POST, PATCH | [Handler](../app/api/applications/route.ts) |
| `/api/autopilot` | GET, PATCH, POST | [Handler](../app/api/autopilot/route.ts) |
| `/api/billing/checkout` | POST | [Handler](../app/api/billing/checkout/route.ts) |
| `/api/billing/receipts` | GET | [Handler](../app/api/billing/receipts/route.ts) |
| `/api/billing` | GET, PATCH | [Handler](../app/api/billing/route.ts) |
| `/api/billing/webhook` | POST | [Handler](../app/api/billing/webhook/route.ts) |
| `/api/calendars/callback` | GET | [Handler](../app/api/calendars/callback/route.ts) |
| `/api/calendars/connect` | POST | [Handler](../app/api/calendars/connect/route.ts) |
| `/api/calendars` | GET | [Handler](../app/api/calendars/route.ts) |
| `/api/candidate-visibility` | GET, PATCH | [Handler](../app/api/candidate-visibility/route.ts) |
| `/api/career/intelligence` | GET | [Handler](../app/api/career/intelligence/route.ts) |
| `/api/companies/[slug]/follow` | GET, POST, DELETE | [Handler](../app/api/companies/[slug]/follow/route.ts) |
| `/api/companies/[slug]/reviews` | GET, POST, DELETE | [Handler](../app/api/companies/[slug]/reviews/route.ts) |
| `/api/companies/[slug]` | GET | [Handler](../app/api/companies/[slug]/route.ts) |
| `/api/companies/following` | GET | [Handler](../app/api/companies/following/route.ts) |
| `/api/companies` | GET | [Handler](../app/api/companies/route.ts) |
| `/api/cron/autopilot` | GET | [Handler](../app/api/cron/autopilot/route.ts) |
| `/api/cron/job-alerts` | GET | [Handler](../app/api/cron/job-alerts/route.ts) |
| `/api/cron/reminders` | GET | [Handler](../app/api/cron/reminders/route.ts) |
| `/api/employers/[id]` | GET | [Handler](../app/api/employers/[id]/route.ts) |
| `/api/hiring-applications/history` | GET | [Handler](../app/api/hiring-applications/history/route.ts) |
| `/api/hiring-applications` | GET, POST, PATCH | [Handler](../app/api/hiring-applications/route.ts) |
| `/api/hiring-invitations` | POST, PATCH | [Handler](../app/api/hiring-invitations/route.ts) |
| `/api/hiring-messages` | GET, POST, PATCH | [Handler](../app/api/hiring-messages/route.ts) |
| `/api/hiring-notifications` | GET, PATCH | [Handler](../app/api/hiring-notifications/route.ts) |
| `/api/interviews` | GET, POST | [Handler](../app/api/interviews/route.ts) |
| `/api/job-alerts` | GET, PATCH | [Handler](../app/api/job-alerts/route.ts) |
| `/api/jobs/[id]/copilot` | GET | [Handler](../app/api/jobs/[id]/copilot/route.ts) |
| `/api/jobs/[id]/interview` | GET, POST | [Handler](../app/api/jobs/[id]/interview/route.ts) |
| `/api/jobs/[id]/prepare` | GET | [Handler](../app/api/jobs/[id]/prepare/route.ts) |
| `/api/jobs/[id]` | GET | [Handler](../app/api/jobs/[id]/route.ts) |
| `/api/jobs/manual` | POST, PATCH | [Handler](../app/api/jobs/manual/route.ts) |
| `/api/jobs/match` | GET | [Handler](../app/api/jobs/match/route.ts) |
| `/api/jobs/reports` | POST, GET, PATCH | [Handler](../app/api/jobs/reports/route.ts) |
| `/api/jobs/save` | POST | [Handler](../app/api/jobs/save/route.ts) |
| `/api/jobs/saved-searches` | GET, POST, DELETE | [Handler](../app/api/jobs/saved-searches/route.ts) |
| `/api/jobs/sync` | POST | [Handler](../app/api/jobs/sync/route.ts) |
| `/api/learn/certificate` | GET | [Handler](../app/api/learn/certificate/route.ts) |
| `/api/learn` | GET, POST | [Handler](../app/api/learn/route.ts) |
| `/api/my-day` | GET, POST | [Handler](../app/api/my-day/route.ts) |
| `/api/notifications/history` | GET | [Handler](../app/api/notifications/history/route.ts) |
| `/api/notifications` | GET | [Handler](../app/api/notifications/route.ts) |
| `/api/plans/usage` | GET | [Handler](../app/api/plans/usage/route.ts) |
| `/api/portfolio` | GET, POST, PATCH, DELETE | [Handler](../app/api/portfolio/route.ts) |
| `/api/practice` | GET, POST | [Handler](../app/api/practice/route.ts) |
| `/api/recruiter/applications` | GET, PATCH | [Handler](../app/api/recruiter/applications/route.ts) |
| `/api/recruiter/branding` | GET, PATCH | [Handler](../app/api/recruiter/branding/route.ts) |
| `/api/recruiter/candidates` | GET, PATCH | [Handler](../app/api/recruiter/candidates/route.ts) |
| `/api/recruiter/jobs` | POST | [Handler](../app/api/recruiter/jobs/route.ts) |
| `/api/recruiter` | GET, POST | [Handler](../app/api/recruiter/route.ts) |
| `/api/recruiter/verification` | POST | [Handler](../app/api/recruiter/verification/route.ts) |
| `/api/resources/interview` | GET | [Handler](../app/api/resources/interview/route.ts) |
| `/api/resume/parse` | POST | [Handler](../app/api/resume/parse/route.ts) |
| `/api/salaries` | GET | [Handler](../app/api/salaries/route.ts) |
| `/api/support` | GET | [Handler](../app/api/support/route.ts) |
| `/auth/callback` | GET | [Handler](../app/auth/callback/route.ts) |

## Database table and migration inventory

These are table creation locations in the reproducible migration chain; subsequent migrations refine constraints, grants, RLS, functions and triggers. Read the full chain and SQL tests when changing privileges. Application tables in `public` require RLS; privileged metadata/functions use the existing private schema. Native `auth`/`storage` schemas are platform-managed. [Database boundaries](database/README.md), [security model](security/README.md), [migration process](development/MIGRATIONS.md).

| Table | Creation migration |
|---|---|
| `public.profiles` | [20260913000000_initial_core_schema.sql](../supabase/migrations/20260913000000_initial_core_schema.sql) |
| `public.job_preferences` | [20260913000000_initial_core_schema.sql](../supabase/migrations/20260913000000_initial_core_schema.sql) |
| `public.resumes` | [20260913000000_initial_core_schema.sql](../supabase/migrations/20260913000000_initial_core_schema.sql) |
| `public.jobs` | [20260913000000_initial_core_schema.sql](../supabase/migrations/20260913000000_initial_core_schema.sql) |
| `public.saved_jobs` | [20260913000000_initial_core_schema.sql](../supabase/migrations/20260913000000_initial_core_schema.sql) |
| `public.applications` | [20260913000000_initial_core_schema.sql](../supabase/migrations/20260913000000_initial_core_schema.sql) |
| `public.autopilot_preferences` | [20260916101515_career_autopilot.sql](../supabase/migrations/20260916101515_career_autopilot.sql) |
| `public.automation_actions` | [20260916101515_career_autopilot.sql](../supabase/migrations/20260916101515_career_autopilot.sql) |
| `public.application_submissions` | [20260916101515_career_autopilot.sql](../supabase/migrations/20260916101515_career_autopilot.sql) |
| `public.skillpath_enrollments` | [20260917121452_skillpath_learning.sql](../supabase/migrations/20260917121452_skillpath_learning.sql) |
| `public.skillpath_attempts` | [20260917121452_skillpath_learning.sql](../supabase/migrations/20260917121452_skillpath_learning.sql) |
| `public.skillpath_credentials` | [20260917121452_skillpath_learning.sql](../supabase/migrations/20260917121452_skillpath_learning.sql) |
| `public.interview_practice_sessions` | [20260917142857_interview_practice.sql](../supabase/migrations/20260917142857_interview_practice.sql) |
| `public.my_day_preferences` | [20260917173728_my_day_planning.sql](../supabase/migrations/20260917173728_my_day_planning.sql) |
| `public.learning_catalog` | [20260917181201_dynamic_learning_catalog.sql](../supabase/migrations/20260917181201_dynamic_learning_catalog.sql) |
| `public.learning_answer_keys` | [20260917181201_dynamic_learning_catalog.sql](../supabase/migrations/20260917181201_dynamic_learning_catalog.sql) |
| `public.learning_goals` | [20260917181201_dynamic_learning_catalog.sql](../supabase/migrations/20260917181201_dynamic_learning_catalog.sql) |
| `public.application_interviews` | [20260917225748_interview_planner.sql](../supabase/migrations/20260917225748_interview_planner.sql) |
| `public.portfolio_evidence` | [20260921180025_evidence_portfolio.sql](../supabase/migrations/20260921180025_evidence_portfolio.sql) |
| `public.job_reports` | [20261005052036_job_scam_reporting.sql](../supabase/migrations/20261005052036_job_scam_reporting.sql) |
| `public.hidden_jobs` | [20261005052036_job_scam_reporting.sql](../supabase/migrations/20261005052036_job_scam_reporting.sql) |
| `public.saved_searches` | [20261005091500_saved_searches.sql](../supabase/migrations/20261005091500_saved_searches.sql) |
| `public.company_follows` | [20261005093500_company_follows.sql](../supabase/migrations/20261005093500_company_follows.sql) |
| `public.company_reviews` | [20261005094000_company_reviews.sql](../supabase/migrations/20261005094000_company_reviews.sql) |
| `public.application_events` | [20261005094938_application_activity_history.sql](../supabase/migrations/20261005094938_application_activity_history.sql) |
| `public.account_deletion_requests` | [20261005102031_account_data_controls.sql](../supabase/migrations/20261005102031_account_data_controls.sql) |
| `public.support_tickets` | [20261005104214_support_tickets.sql](../supabase/migrations/20261005104214_support_tickets.sql) |
| `public.notification_preferences` | [20261005144754_notification_reminders.sql](../supabase/migrations/20261005144754_notification_reminders.sql) |
| `public.push_subscriptions` | [20261005144754_notification_reminders.sql](../supabase/migrations/20261005144754_notification_reminders.sql) |
| `public.reminder_deliveries` | [20261005144754_notification_reminders.sql](../supabase/migrations/20261005144754_notification_reminders.sql) |
| `public.calendar_connections` | [20261005161114_calendar_connections.sql](../supabase/migrations/20261005161114_calendar_connections.sql) |
| `public.calendar_tokens` | [20261005161114_calendar_connections.sql](../supabase/migrations/20261005161114_calendar_connections.sql) |
| `public.calendar_event_links` | [20261005161114_calendar_connections.sql](../supabase/migrations/20261005161114_calendar_connections.sql) |
| `public.job_alert_preferences` | [20261005165535_job_alerts.sql](../supabase/migrations/20261005165535_job_alerts.sql) |
| `public.job_alert_runs` | [20261005165535_job_alerts.sql](../supabase/migrations/20261005165535_job_alerts.sql) |
| `public.job_alert_deliveries` | [20261005165535_job_alerts.sql](../supabase/migrations/20261005165535_job_alerts.sql) |
| `public.recruiter_companies` | [20261005165631_recruiter_platform.sql](../supabase/migrations/20261005165631_recruiter_platform.sql) |
| `public.company_verification_requests` | [20261005165631_recruiter_platform.sql](../supabase/migrations/20261005165631_recruiter_platform.sql) |
| `public.candidate_visibility` | [20261006100522_hiring_applications_privacy.sql](../supabase/migrations/20261006100522_hiring_applications_privacy.sql) |
| `public.employer_applications` | [20261006100522_hiring_applications_privacy.sql](../supabase/migrations/20261006100522_hiring_applications_privacy.sql) |
| `public.employer_application_events` | [20261006100522_hiring_applications_privacy.sql](../supabase/migrations/20261006100522_hiring_applications_privacy.sql) |
| `public.recruiter_shortlists` | [20261007022411_recruiter_discovery_communications.sql](../supabase/migrations/20261007022411_recruiter_discovery_communications.sql) |
| `public.hiring_threads` | [20261007022411_recruiter_discovery_communications.sql](../supabase/migrations/20261007022411_recruiter_discovery_communications.sql) |
| `public.hiring_messages` | [20261007022411_recruiter_discovery_communications.sql](../supabase/migrations/20261007022411_recruiter_discovery_communications.sql) |
| `public.hiring_invitations` | [20261007022411_recruiter_discovery_communications.sql](../supabase/migrations/20261007022411_recruiter_discovery_communications.sql) |
| `public.hiring_notifications` | [20261007022411_recruiter_discovery_communications.sql](../supabase/migrations/20261007022411_recruiter_discovery_communications.sql) |
| `public.employer_branding` | [20261007022625_employer_branding_admin_operations.sql](../supabase/migrations/20261007022625_employer_branding_admin_operations.sql) |
| `public.admin_account_cases` | [20261007022625_employer_branding_admin_operations.sql](../supabase/migrations/20261007022625_employer_branding_admin_operations.sql) |
| `public.admin_operation_events` | [20261007022625_employer_branding_admin_operations.sql](../supabase/migrations/20261007022625_employer_branding_admin_operations.sql) |
| `public.worker_runs` | [20261007073217_launch_operations_runs.sql](../supabase/migrations/20261007073217_launch_operations_runs.sql) |
| `public.launch_limits` | [20261007080231_free_launch_allowances.sql](../supabase/migrations/20261007080231_free_launch_allowances.sql) |
| `public.launch_usage` | [20261007080231_free_launch_allowances.sql](../supabase/migrations/20261007080231_free_launch_allowances.sql) |
| `public.launch_plans` | [20261007083436_plan_entitlement_controls.sql](../supabase/migrations/20261007083436_plan_entitlement_controls.sql) |
| `public.launch_plan_assignments` | [20261007083436_plan_entitlement_controls.sql](../supabase/migrations/20261007083436_plan_entitlement_controls.sql) |
| `public.billing_products` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.billing_policy` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.billing_intents` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.billing_payments` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.billing_entitlements` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.posting_credit_balance` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.posting_credit_spends` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.billing_events` | [20261007090851_revenue_foundation.sql](../supabase/migrations/20261007090851_revenue_foundation.sql) |
| `public.billing_disputes` | [20261008004447_billing_recovery_disputes.sql](../supabase/migrations/20261008004447_billing_recovery_disputes.sql) |

## Environment inventory

Never put values in this document. [Configuration semantics](development/ENVIRONMENT.md) and [.env.example](../.env.example) define setup. Provider plan names and OAuth credentials are selected dynamically and are included through the template. Platform-injected origins are fallback metadata, not credentials.

| Setting | Boundary |
|---|---|
| `AI_API_KEY` | Server-only / platform setting |
| `AI_BASE_URL` | Server-only / platform setting |
| `AI_MODEL` | Server-only / platform setting |
| `AI_PROVIDER` | Server-only / platform setting |
| `ALLOW_PAID_PROVIDERS` | Server-only / platform setting |
| `BILLING_LIVE_ENABLED` | Server-only / platform setting |
| `BILLING_MODE` | Server-only / platform setting |
| `CALENDAR_ENCRYPTION_KEY` | Server-only / platform setting |
| `CRON_SECRET` | Server-only / platform setting |
| `EMAIL_DELIVERY_ENABLED` | Server-only / platform setting |
| `GOOGLE_CALENDAR_CLIENT_ID` | Server-only / platform setting |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Server-only / platform setting |
| `NEXT_PUBLIC_SITE_URL` | Browser-visible |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible |
| `NEXT_PUBLIC_VERCEL_ENV` | Browser-visible |
| `NEXT_PUBLIC_VERCEL_URL` | Browser-visible |
| `NODE_ENV` | Server-only / platform setting |
| `OUTLOOK_CALENDAR_CLIENT_ID` | Server-only / platform setting |
| `OUTLOOK_CALENDAR_CLIENT_SECRET` | Server-only / platform setting |
| `RAZORPAY_KEY_ID` | Server-only / platform setting |
| `RAZORPAY_KEY_SECRET` | Server-only / platform setting |
| `RAZORPAY_PLAN_CANDIDATE_PRO` | Server-only / platform setting |
| `RAZORPAY_PLAN_RECRUITER_ENTERPRISE` | Server-only / platform setting |
| `RAZORPAY_PLAN_RECRUITER_GROWTH` | Server-only / platform setting |
| `RAZORPAY_PLAN_RECRUITER_STARTER` | Server-only / platform setting |
| `RAZORPAY_WEBHOOK_SECRET` | Server-only / platform setting |
| `REMINDER_FROM_EMAIL` | Server-only / platform setting |
| `RESEND_API_KEY` | Server-only / platform setting |
| `SUPABASE_SECRET_KEY` | Server-only / platform setting |
| `VAPID_PRIVATE_KEY` | Server-only / platform setting |
| `VAPID_PUBLIC_KEY` | Server-only / platform setting |
| `VERCEL_PROJECT_PRODUCTION_URL` | Server-only / platform setting |
| `VERCEL_URL` | Server-only / platform setting |
| `YOUTUBE_API_KEY` | Server-only / platform setting |

## Runnable verification inventory

Node uses its built-in test runner; SQL uses Supabase/pgTAP and rolled-back fixture accounts. Fixtures do not demonstrate real provider delivery. [Check commands and limits](development/TESTING.md).

| Check | Source |
|---|---|
| `account.test` | [Source](../lib/account.test.mjs) |
| `application-copilot.test` | [Source](../lib/ai/application-copilot.test.mjs) |
| `career-intelligence.test` | [Source](../lib/ai/career-intelligence.test.mjs) |
| `interview-engine.test` | [Source](../lib/ai/interview-engine.test.mjs) |
| `interview-learning.test` | [Source](../lib/ai/interview-learning.test.mjs) |
| `provider-factory.test` | [Source](../lib/ai/providers/provider-factory.test.mjs) |
| `autofill.test` | [Source](../lib/applications/autofill.test.mjs) |
| `connected-helper.test` | [Source](../lib/applications/connected-helper.test.mjs) |
| `facts.test` | [Source](../lib/applications/facts.test.mjs) |
| `follow-up.test` | [Source](../lib/applications/follow-up.test.mjs) |
| `history.test` | [Source](../lib/applications/history.test.mjs) |
| `interviews.test` | [Source](../lib/applications/interviews.test.mjs) |
| `lifecycle.test` | [Source](../lib/applications/lifecycle.test.mjs) |
| `tracking.test` | [Source](../lib/applications/tracking.test.mjs) |
| `auth-callback.test` | [Source](../lib/auth-callback.test.mjs) |
| `eligibility.test` | [Source](../lib/autopilot/eligibility.test.mjs) |
| `preferences.test` | [Source](../lib/autopilot/preferences.test.mjs) |
| `schedule.test` | [Source](../lib/autopilot/schedule.test.mjs) |
| `service.test` | [Source](../lib/autopilot/service.test.mjs) |
| `billing.test` | [Source](../lib/billing/billing.test.mjs) |
| `provider.test` | [Source](../lib/calendars/provider.test.mjs) |
| `routes.test` | [Source](../lib/calendars/routes.test.mjs) |
| `follows.test` | [Source](../lib/companies/follows.test.mjs) |
| `reviews.test` | [Source](../lib/companies/reviews.test.mjs) |
| `slug.test` | [Source](../lib/companies/slug.test.mjs) |
| `greeting.test` | [Source](../lib/greeting.test.mjs) |
| `content.test` | [Source](../lib/help/content.test.mjs) |
| `route.test` | [Source](../lib/help/route.test.mjs) |
| `home-next-action.test` | [Source](../lib/home-next-action.test.mjs) |
| `equity.test` | [Source](../lib/jobs/equity.test.mjs) |
| `filters.test` | [Source](../lib/jobs/filters.test.mjs) |
| `internships.test` | [Source](../lib/jobs/internships.test.mjs) |
| `manual.test` | [Source](../lib/jobs/manual.test.mjs) |
| `reports.test` | [Source](../lib/jobs/reports.test.mjs) |
| `saved-searches.test` | [Source](../lib/jobs/saved-searches.test.mjs) |
| `sync.test` | [Source](../lib/jobs/sync.test.mjs) |
| `learning.test` | [Source](../lib/learning/learning.test.mjs) |
| `india.test` | [Source](../lib/matching/india.test.mjs) |
| `history.test` | [Source](../lib/notifications/history.test.mjs) |
| `job-alert-routes.test` | [Source](../lib/notifications/job-alert-routes.test.mjs) |
| `job-alerts.test` | [Source](../lib/notifications/job-alerts.test.mjs) |
| `reminders.test` | [Source](../lib/notifications/reminders.test.mjs) |
| `routes.test` | [Source](../lib/notifications/routes.test.mjs) |
| `cron.test` | [Source](../lib/operations/cron.test.mjs) |
| `readiness.test` | [Source](../lib/operations/readiness.test.mjs) |
| `status.test` | [Source](../lib/operations/status.test.mjs) |
| `page-guide.test` | [Source](../lib/page-guide.test.mjs) |
| `routes.test` | [Source](../lib/plans/routes.test.mjs) |
| `server.test` | [Source](../lib/plans/server.test.mjs) |
| `evidence.test` | [Source](../lib/portfolio/evidence.test.mjs) |
| `practice.test` | [Source](../lib/practice/practice.test.mjs) |
| `discovery.test` | [Source](../lib/public/discovery.test.mjs) |
| `routes.test` | [Source](../lib/recruiter/routes.test.mjs) |
| `validation.test` | [Source](../lib/recruiter/validation.test.mjs) |
| `resource-provider.test` | [Source](../lib/resources/resource-provider.test.mjs) |
| `ats.test` | [Source](../lib/resume/ats.test.mjs) |
| `benchmarking.test` | [Source](../lib/salaries/benchmarking.test.mjs) |
| `site-url.test` | [Source](../lib/site-url.test.mjs) |
| `server.test` | [Source](../lib/supabase/server.test.mjs) |
| `ux-theme.test` | [Source](../lib/ux-theme.test.mjs) |
| `backup-database.test` | [Source](../scripts/backup-database.test.mjs) |
| `verify-backup.test` | [Source](../scripts/verify-backup.test.mjs) |
| `account_data_security` | [Source](../supabase/tests/account_data_security.sql) |
| `account_suspension_security` | [Source](../supabase/tests/account_suspension_security.sql) |
| `admin_roles_security` | [Source](../supabase/tests/admin_roles_security.sql) |
| `application_history_security` | [Source](../supabase/tests/application_history_security.sql) |
| `billing_recovery_disputes_security` | [Source](../supabase/tests/billing_recovery_disputes_security.sql) |
| `calendar_sync_security` | [Source](../supabase/tests/calendar_sync_security.sql) |
| `core_user_data_security` | [Source](../supabase/tests/core_user_data_security.sql) |
| `dynamic_learning_security` | [Source](../supabase/tests/dynamic_learning_security.sql) |
| `employer_operations_security` | [Source](../supabase/tests/employer_operations_security.sql) |
| `evidence_portfolio_security` | [Source](../supabase/tests/evidence_portfolio_security.sql) |
| `hiring_applications_security` | [Source](../supabase/tests/hiring_applications_security.sql) |
| `interview_planner_security` | [Source](../supabase/tests/interview_planner_security.sql) |
| `interview_practice_security` | [Source](../supabase/tests/interview_practice_security.sql) |
| `job_alerts_security` | [Source](../supabase/tests/job_alerts_security.sql) |
| `job_reporting_security` | [Source](../supabase/tests/job_reporting_security.sql) |
| `launch_allowances_security` | [Source](../supabase/tests/launch_allowances_security.sql) |
| `my_day_security` | [Source](../supabase/tests/my_day_security.sql) |
| `notification_reminders_security` | [Source](../supabase/tests/notification_reminders_security.sql) |
| `plan_entitlements_security` | [Source](../supabase/tests/plan_entitlements_security.sql) |
| `public_discovery_security` | [Source](../supabase/tests/public_discovery_security.sql) |
| `recruiter_communications_security` | [Source](../supabase/tests/recruiter_communications_security.sql) |
| `recruiter_platform_security` | [Source](../supabase/tests/recruiter_platform_security.sql) |
| `resume_storage_security` | [Source](../supabase/tests/resume_storage_security.sql) |
| `revenue_foundation_security` | [Source](../supabase/tests/revenue_foundation_security.sql) |
| `skillpath_security` | [Source](../supabase/tests/skillpath_security.sql) |
| `support_tickets_security` | [Source](../supabase/tests/support_tickets_security.sql) |
| `user_added_opportunities_security` | [Source](../supabase/tests/user_added_opportunities_security.sql) |
| `worker_operations_security` | [Source](../supabase/tests/worker_operations_security.sql) |

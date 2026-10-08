# Job alerts and recruiter foundation batch

> Historical delivery evidence. Current pricing, activation, implementation status and provider limitations are defined by [Revenue operation](REVENUE-FOUNDATION.md), [current progress](../product/PRODUCTION-PROGRESS.md) and [implementation reference](../IMPLEMENTATION-REFERENCE.md).

Current continuation: `LAUNCH-PHASES-1-2.md` supersedes this historical foundation checkpoint for direct hiring and candidate privacy.

## Goal and checkpoint

Continue the existing backlog without restarting. This batch implements Features 16, 3, 4 and 6, plus Feature 5's company/postings dashboard. Feature 5 remains partial: real applicant pipeline metrics and recent applicant activity depend on direct in-app submissions and employer-side application management (Features 11/12). Private candidate trackers, notes and resumes are not recruiter submissions.

Implementation lives in `app/api/job-alerts`, `app/api/cron/job-alerts`, `lib/notifications/{job-alerts,delivery}.ts`, `app/(app)/profile/notification-preferences.tsx`, `lib/recruiter`, `app/api/recruiter`, `app/api/admin/company-verifications`, `app/(app)/recruiter`, and `app/(app)/company-verifications`. Existing login/callback, sidebar, jobs/equity, account export and reminder delivery paths are integrated.

## Production migration review

Two forward-only migrations are local-only until exact-file approval under `docs/development/MIGRATIONS.md`:

1. `supabase/migrations/20261005165535_job_alerts.sql`: adds ingestion/first-publication timestamps, private opt-in preferences, frozen daily digest snapshots and delivery status rows; client ownership RLS; client-disabled run/delivery writes; service-only atomic claims with bounded retries and deletion freeze. Existing moderation remains in the service-only jobs feed.
2. `supabase/migrations/20261005165631_recruiter_platform.sql`: adds private company registrations and evidence requests, atomic onboarding/re-review/admin decisions and direct posting mutations, owner-safe job discovery, verified-domain uniqueness only after approval, and deletion cleanup. Clients cannot grant themselves recruiter approval or mutate these records. Service-only RPCs are security invoker; a private service-only Auth identity helper reads only email/confirmation/admin flag, a private signed-in verification helper exposes one boolean, and a private trigger redacts deleted employer postings while retaining other candidates' application/history IDs. No broad Auth table grants are added.

Production dry-run lists only these two migrations. Apply them in order after approval, then verify remote RLS, grants, helper/RPC execution, published-only visibility and migration history. Code gracefully reports unavailability before schema rollout; new sections missing during export are marked explicitly. Existing discovery does not require new fields until direct JobPilot rows exist.

## Job alerts (Feature 16)

- Save searches in Find jobs, then opt into email and/or browser push from Profile. Channels are separate from interview reminders; push uses the existing browser connection. Email goes only to the confirmed account email and includes titles, companies and JobPilot links. Push is generic and opens only same-origin `/jobs`.
- New public, non-expired, non-moderated jobs match any saved search using existing filters and the existing profile/resume score. The saved search's minimum score overrides the profile threshold. Jobs from the candidate's current company are excluded, as in discovery. The same job appears once even if several searches match it. No private user-added jobs are sent.
- The first window starts when alerts are enabled. Turning both channels off and later on starts a new window. Source publication dates still drive posting-date filters; ingestion time drives alerts. A recruiter's first publication advances its alert availability timestamp, so old drafts are not missed when published. Later edits/republishing do not repeat alerts.
- A frozen daily snapshot keeps retries and Resend idempotency consistent. A retry is skipped if a listed item has since become hidden, expired or removed. Empty scans advance the window without sending. No saved searches or incomplete profile/preferences cause a skip. Old snapshots are not sent after alerts are re-enabled.
- Email shows up to twenty linked jobs and the total matches. The worker supports up to 100 saved searches, 5,000 newly available rows per account/run, ten existing browser devices and a four-minute budget. Exceeding a scan ceiling fails without advancing that account's cursor. Large backlogs can be reset by disabling/re-enabling alerts; a resumable queue is the upgrade path if these ceilings are reached.
- `/api/cron/job-alerts` runs daily at `30 3 * * *` UTC and requires `CRON_SECRET`. Timing is approximate on Hobby; cron invocations do not guarantee automatic retries. Check failed/incomplete runs and manually retry that UTC day with authorized headers. After a rollover, a previously frozen scan is not resent, so investigate failed delivery before the next day.
- Reuses reminder environment settings: confirmed Auth email, verified-domain Resend sender/key, VAPID pair, canonical HTTPS site and server Supabase credentials. The supplied Gmail address can receive email; it cannot replace a verified sender domain. No real email or push has been sent by this batch. See `REMINDERS.md` for activation.
- Three daily crons fit current Vercel limits: the official January 2026 change raised every plan to 100 jobs per project; Hobby remains once daily with timing jitter. This supersedes the older two-job limit in the installed cron skill. [Current limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [limit change](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan).

## Recruiter registration and verification (Features 3/4)

- Choose hiring during email/Google sign-in or open Hiring workspace from the sidebar. Candidate onboarding is separate; choosing hiring is navigation intent, never an authorization claim. Existing accounts can retain candidate features and register one company.
- Registration requires confirmed Auth email, contact name, company website, business-evidence HTTPS link and hiring-authority explanation. Corporate-email confirmation is derived server-side from Auth and the exact normalized website domain; user claims cannot forge it. Nonmatching email requires independent manual business review. Evidence is private to its owner and authorized admins, not fetched by the application.
- Pending registrations do not reserve a company's domain against other applicants; only approved companies have unique domains. Requesting verification grants no publishing rights and does not claim an existing company profile based on its name. One owner/company is supported; team invitations and ownership transfers are not implemented.
- Admins use `/company-verifications` (linked from scam moderation) for paginated approve/reject/revoke decisions with a required note and version conflict protection. Approval is manual review of identity and hiring authority, not a claim of independent legal certification. Rejected/revoked owners can submit revised evidence, up to three requests per rolling 24 hours.
- Revocation atomically pauses published jobs. Company identity/contact/evidence cannot be edited through browser table writes. Verified-company badges label direct JobPilot postings; unrelated aggregated jobs with the same company name are not treated as verified employer submissions.

## Postings dashboard and direct jobs (Features 5/6)

- Dashboard shows real full-table counts for draft/published/paused/closed jobs, paginated posting management and current update timestamps. Applicant pipeline is explicitly unavailable until Features 11/12; it displays no fabricated candidates or metrics.
- Create a draft first, then edit and publish after company approval. Structured annual salary, currency, ownership equity range and skills are validated. Descriptions render as plain text. Candidate discovery/saved-search equity filters and job details include employer disclosures.
- Publish requires an explicit accuracy confirmation. Pause hides the listing from candidate discovery and service feeds. Closing is terminal; create a new draft to hire again. Editing uses expected versions and per-company transaction locks. Up to 100 unclosed postings per company are supported; old closed postings remain paginated.
- Postings currently use an HTTPS external application destination. Human-confirmed in-app submissions remain Feature 11; recruiter applicant review remains Feature 12. Existing scam moderation still applies and publishing does not clear a hidden-job decision.
- Account export includes owner company/evidence/alert records and all owned direct postings via a server-side company filter. Account deletion purges company/evidence/alert records, redacts employer posting contents and retains closed invisible job IDs so other candidates' application/history records survive.

## Verification

Checkpoint: isolated full migration reconstruction, 17 SQL security files and security advisors pass. Node tests cover matching/filter inheritance, digest bounds, owner-bound notification and recruiter routes, origin/Auth/role/deletion guards, structured field validation, stale writes and generic service-worker destinations. Browser-only fixtures cover registration, draft salary/equity values, unverified publishing denial, verified edit/publish/pause/close, admin required notes/approve/revoke and alert preference availability/save. These fixtures do not certify real signed-in production sessions. 187 Node tests, lint, TypeScript and webpack production build pass. Code and validation checkpoint published on 2026-10-06; both migrations remain local-only pending explicit production approval. Next action: review/approve the two exact migrations, deploy and verify remote permissions, then complete activation and real-session release checks.

Remaining activation/release checks: approve/deploy both migrations; activate verified-domain email/VAPID providers; test real confirmed recruiter onboarding, admin decisions and candidate direct-job visibility, authenticated export and disposable employer deletion; verify real digest delivery. Existing calendar OAuth activation remains pending separately.

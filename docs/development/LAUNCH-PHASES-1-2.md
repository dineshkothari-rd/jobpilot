# Free launch: phases 1 and 2

> Historical delivery evidence. Current pricing, activation, implementation status and provider limitations are defined by [Revenue operation](REVENUE-FOUNDATION.md), [current progress](../product/PRODUCTION-PROGRESS.md) and [implementation reference](../IMPLEMENTATION-REFERENCE.md).

Checkpoint: 2026-10-06. Continue the existing implementation; stop after this batch for human review before Phase 3. No new paid API, cloud project, infrastructure upgrade or subscription was created.

## Phase 1 — existing product launch checks

- Updated existing Next.js and matching lint configuration to pinned 16.3.8; compatible lockfile fixes removed the recorded runtime advisories, including sharp 0.35.5 for the newly reported librsvg issue. Full dependency audit retains five high-severity findings in the development-only braces → micromatch → fast-glob → Next lint dependency chain. No forced framework downgrade is applied. Production-only audit has zero findings; this is not a complete security certification.
- Added `ALLOW_PAID_PROVIDERS=false` to the example environment. Unless exactly `true`, external interview AI returns the existing deterministic fallback and Resend is unavailable to preferences/dispatchers; the email sender also independently blocks provider calls. Browser push and existing authentication are unaffected. Do not enable the flag during the free launch. Hosting/database quotas still limit capacity; this code does not change provider billing settings.
- Existing sign-in page and new signed-out API guards verified locally. Account export now includes candidate visibility, direct employer applications and immutable activity, with explicit missing-schema warnings during rollout.
- Production read-only schema check confirms recruiter, alerts and direct applications are not deployed yet. The exact three pending migrations below are still local-only. No production mutation was performed.
- Real confirmed signup/reset delivery, authenticated resume upload/export/deletion, recruiter onboarding/admin approval/publication and cross-account hiring journey remain production acceptance checks after reviewed deployment. Browser-only fixtures and rollback SQL tests do not certify those sessions. Therefore Phase 1 is **release preparation complete; production activation/acceptance pending**, not a public-launch certification.

## Phase 2 — complete hiring workflow

Implemented Features 11, 12, 13, 5 and 25:

1. A candidate opens a verified direct JobPilot job, selects an owned resume, reviews the extracted text and optional cover note, optionally shares confirmed account email, and explicitly consents before submitting. Snapshot contains selected resume text, name, role, location and the chosen contact disclosure. It contains no original PDF path, unselected resumes, profile application facts, private tracker notes or private reminder data. Resume text itself may contain contact information, disclosed before consent.
2. Submission atomically snapshots reviewed content and creates immutable candidate activity. Repeated submissions to the same job return the original record without changing it. Maximum 20 new applications per candidate per rolling day. Closed/paused/expired/hidden/unverified jobs, self-application, foreign resumes, unconfirmed email and deleting accounts are blocked.
3. Verified owners review only their own company's explicitly submitted applicants. Lists are paginated and omit resume contents; one selected application's text is fetched on demand. Status/job/shortlist filters, full-company stage counts and recent real applicant activity complete the recruiter dashboard. The job selector uses the current posting page; All jobs still includes all company submissions.
4. Recruiters shortlist and move candidates forward through applied, screening, interview, offer or rejection. Offer/rejected/withdrawn are final recruiter stages. Reviews use expected versions, require bounded candidate-visible notes and record honest actor labels. No private recruiter notes are claimed. Maximum 100 recruiter updates per applicant per rolling day; candidate withdrawal is always allowed independently of that quota.
5. Candidates see authoritative employer stages and paginated immutable history in their Applications workspace and job details. The private tracker remains independently editable: existing private stages/notes are not overwritten. Only a missing private tracker is initialized at submission.
6. Candidates can withdraw, including after an offer/rejection or company closure. Resume text, account email and cover note are removed from the shared application; minimal name/role/location and status/history remain for recordkeeping. Previously downloaded/seen data cannot be recalled. Recruiters cannot reopen withdrawn applications.
7. Recruiter profile visibility defaults off. Opt-in shares name, target role, location and experience; contact email and a selected current resume are separate choices. Turning visibility off clears optional disclosures and immediately blocks subsequent profile API access. A selected shared resume can change as its owner edits it; submitted application snapshots remain fixed. Explicitly submitted applications require separate withdrawal. Recruiter search is Phase 3 / Feature 7, not claimed here. A recruiter can view an applicant's separately opted-in profile from review.

Browser tables have owner-only candidate reads and no client writes. Mutations use origin-checked, fresh-Auth server routes, deletion checks, bounded request bodies, whitelisted fields and service-only security-invoker RPCs. Company revocation blocks future recruiter reads/updates. Employer deletion preserves candidate submission/history with a null company association; candidate deletion cascades personal rows. No live messaging, SMS/email invitation, paid sourcing or candidate-search implementation is included.

## Exact migration review

Apply only after explicit approval under `MIGRATIONS.md`, in this order:

1. `supabase/migrations/20261005165535_job_alerts.sql` — existing alert timestamp/preferences/frozen digests and service-only delivery claims. Email stays disabled by the free-launch guard.
2. `supabase/migrations/20261005165631_recruiter_platform.sql` — previously reviewed company registration/verification and direct posting ownership, moderation and deletion safeguards.
3. `supabase/migrations/20261006100522_hiring_applications_privacy.sql` — three new owner-private tables: visibility preferences, immutable submitted content plus versioned stages, and immutable activity; authenticated SELECT only, service-only writes/RPCs; consent, identity, eligibility, ownership, version, quota, terminal stage, privacy and revocation checks. No new security-definer function, broad Auth-table grants, paid provider or Storage-sharing policy is introduced.

Production dry-run lists these three files only, with no seeds, role changes or vault writes. After approval, deploy with `--skip-vault`, verify remote permissions/function execution/history and run the signed-in release checklist. Do not claim deploy complete from code push.

## Files and verification

New paths: `app/api/hiring-applications`, `app/api/candidate-visibility`, `app/api/recruiter/{applications,candidates}`, `lib/recruiter/applications.ts`, `components/{hiring-applications,recruiter-applicants,candidate-visibility}.tsx`, the migration and `supabase/tests/hiring_applications_security.sql`. Integrated into existing job detail, Applications, Profile, recruiter dashboard and account export; reused server auth/body/error helpers and existing lifecycle stages.

Local validation: full migration reconstruction, 18 SQL security files and security advisors pass. Expanded hiring SQL verifies opt-in/default privacy, revocation, frozen resume snapshots, duplicate submission, owner reads, forged recruiter/client writes, null/stale versions, forward transitions, bounded updates with withdrawal bypass, company revocation and both account-deletion paths. 196 Node tests pass; lint and TypeScript pass. Browser-only actual-component fixtures verify consent-gated submission, history, withdrawal, recruiter screening/shortlisting and candidate-visible note, privacy opt-in and revocation; 390px viewport has no horizontal overflow or error overlay. Actual unsigned new APIs return 401, and the real login page exposes both account purposes. All temporary fixtures are removed.

Final production webpack build passes. Full local migration reconstruction, all 18 SQL files, lint, TypeScript and 196 Node tests pass after the final review-dialog, anonymous-mode and score-filter changes. Security advisors report no warning-level findings; read-only production preview confirms exactly the three listed migrations.

Next action: commit/push the validated batch, then stop for review. Production migration approval and real-session checks remain explicit blockers. Do not start Phase 3 automatically.

## Final scope details (2026-10-07)

Submission now opens an accessible review dialog showing the actual shared profile, selected extracted resume text, contact choice and cover note. The server computes the deterministic match score using existing matching logic, ignores client-provided scores and checks reviewed resume/profile timestamps and listing version in the database; concurrent changes require refreshed review. Recruiter minimum-score filters use this snapshot score as guidance, not a hiring-quality prediction.

Anonymous recruiter visibility hides name, contact and resume; role/location/experience remain visible to verified recruiters. Full privacy revokes the profile entirely. Submitted applications intentionally remain independent. Candidate realtime subscriptions are owner-filtered and the table is added to the existing Supabase publication; visible in-app notices accompany refreshed employer stages. No paid email or AI service is enabled. Real authenticated realtime delivery remains a production acceptance item. Earlier browser fixture checks covered submission/withdrawal, recruiter updates and privacy revocation; they do not constitute live production certification.

Final browser fixture checks also pass: the review modal blocks confirmation until consent, sends the exact reviewed timestamps/version, and anonymous mode disables resume/contact sharing and shows an anonymous preview. At 390px the document width remains 390px. These fixtures were removed before commit.


## Superseding checkpoint — 2026-10-07

The Phase 1–2 batch was committed/pushed as `a918f4b`. The user then authorized the next two phases and production database synchronization. All three listed pending migrations have now been applied. Earlier local-only/approval/next-action notes above are historical. Current implementation, deployment and acceptance limits: [production progress](../product/PRODUCTION-PROGRESS.md) and [Phase 3–4 handoff](./LAUNCH-PHASES-3-4.md).

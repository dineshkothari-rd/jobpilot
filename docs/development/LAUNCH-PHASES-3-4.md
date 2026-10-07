# Launch Phases 3–4 handoff

Checkpoint: 2026-10-07. Goal: continue the existing free-first-launch implementation, deliver two phases, synchronize the database, commit/push, then stop for review. No new runtime dependency, paid API, paid cloud project or infrastructure upgrade was added.

## Delivered scope

Phase 3: recruiter candidate search (#7), private sourcing shortlist (#8), participant-scoped in-app messages (#9), candidate-confirmed interview invitations (#10), profile/resume-view notices (#14). Phase 4: verified employer branding (#27), consolidated admin operations (#38). Admin enforcement remains partial: review flags/notes are implemented; suspension and role management are not.

Reused existing recruiter authentication, ownership checks, verification/moderation/support queues, application planner and account export. Existing application snapshots remain separate from optional current profile sharing. Anonymous sourcing excludes names/contact/resume and cannot initiate contact; active explicit applications can independently authorize contact. Candidate blocking and consent revocation are checked on subsequent recruiter requests. Messaging content is not granted directly to browser database roles; service RPCs enforce fresh participant/company checks. Notification realtime is owner-scoped. View notices deduplicate per company/candidate/day. Sends are idempotent and bounded by user/day and thread/minute quotas. Invitations require owned published current jobs, future timezone-aware times and version checks. Acceptance saves a private tracker when needed and creates a planner round; it never invents application submission or silently reuses an unrelated planner UUID.

Branding uses native cover palettes, plain text and bounded arrays; no cover upload subsystem. Only published/currently verified employer content is projected, without company evidence/contact/private IDs. Pages currently require sign-in; public acquisition/SEO belongs to Phase 5. Admin uses trusted server metadata plus private database identity checks. Account review flags do not suspend accounts or change roles. Export includes owned sourcing/branding/notices and only owned hiring threads/messages/invitations; deletion cascades those records.

## Relevant files

- New UI: `components/recruiter-talent.tsx`, `components/employer-branding.tsx`, `app/(app)/inbox/page.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/employers/[id]/page.tsx`.
- APIs: recruiter candidates/branding, hiring messages/invitations/notifications, admin operations and employer projection. Shared validation: `lib/recruiter/communications.ts`; existing recruiter server context reused.
- Existing recruiter dashboard/applicant review, sidebar, candidate privacy copy, company branding links and personal export extended.
- AI-generated JobPilot mark integrated in landing/sidebar: `public/brand/jobpilot-mark.png`. Proper 16/32/48/64 favicon ICO, 192px app icon and 180px Apple icon use the same mark.

## Database synchronization

Applied previously pending files: `20261005165535_job_alerts.sql`, `20261005165631_recruiter_platform.sql`, `20261006100522_hiring_applications_privacy.sql`.

Applied after exact dry-run and isolated reconstruction/security checks: `20261007022411_recruiter_discovery_communications.sql`, `20261007022625_employer_branding_admin_operations.sql`.

The requested sync was explicitly user-authorized. No seeds, Auth roles or vault values were changed. Production migration history, all eight new tables' RLS, browser grants, service-only function execution and notification publication verified read-only. No synthetic account/message fixtures were inserted into production.

## Verification

- 201 existing/new Node checks pass.
- 20 SQL security files pass after complete isolated migration reconstruction; invitation/planner collision, owner isolation, consent/blocking/revocation, quotas, exports/deletion and admin permissions covered.
- Full lint and final webpack production build (including TypeScript) pass. Final whitespace check passes.
- Browser-only local fixtures exercise real components: shortlist note save; candidate message/accept/block; recruiter timezone-aware invitation form; employer publish and rendered branding; admin account flag/note save. Inbox pagination overflow found at 390px, fixed and rechecked. Employer page fits at 390px.
- Fixtures removed; restored help page matches committed original. Real signed-out APIs return 401; icon/logo assets return 200.

## Limits and next action

Fixtures are not real signed-in production acceptance. Confirm two-party realtime, employer revocation/privacy behavior, account export/delete and admin refresh with actual pilot accounts. Reminder/alert sender and push activation and calendar OAuth/provider round-trip checks remain pending. Prior dependency report records five development-only advisories and zero runtime advisories at that checkpoint.

Current 41-feature inventory: **30 Complete / 4 Partial / 7 Not picked** in [production progress](../product/PRODUCTION-PROGRESS.md). Charging customers is not ready; seven monetization features are unpicked. Launch Phases 5–6 have not started. Stop after commit/push for user review before proceeding.

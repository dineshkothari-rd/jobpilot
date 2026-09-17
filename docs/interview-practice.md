# Interview Practice Studio

Entry points: `/practice`, sidebar/mobile More → Interview Practice, and existing `/jobs/[id]/interview` links from job preparation. Both entry points use the same studio.

## Delivered flow

Choose a role or an application job, topic, technical/behavioral/mixed mode and 10/20/30-minute guide. Profile role and primary-resume skills provide user-supplied context; job sessions use saved job skills and an explicitly labeled description excerpt. No invented employment facts or provider evaluation calls.

Write one response at a time, optionally draft JavaScript/SQL, review the supplied criteria, save privately and finish. Unchecked self-review criteria produce a focused retry session and technical Learning Studio links. History lists up to 100 retained sessions, all individually reviewable/resumable and deletable. The percentage counts user-checked rubric items; it is not an automatic correctness or readiness grade.

Timer expiry never submits or erases work. Navigation preserves answers. Versioned, owner-scoped `sessionStorage` holds minimal answer drafts and setup metadata, not tokens or job-description/question caches. Drafts recover after refresh; conflicting versions are not overwritten. Successful account saves remove the local draft; sign-out clears practice drafts. Browser storage failure and offline states are explicit. Tab-local drafts are not a durable backup and can disappear when the tab closes.

## Voice and code boundaries

Text is the complete default flow. Native MediaRecorder requests microphone access only on explicit interaction. Recordings are local, limited to five minutes/20 MB, not uploaded or persisted, and released on question changes/unmount. Optional browser speech recognition includes an external-processing disclosure and a text fallback. Real-device recording/transcription remains a manual compatibility check. Native API references: [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

Code/SQL is plain text with original expected cases and hints. No user code is executed on the app server. There are no paid APIs, AI dependencies, trial signups, infrastructure upgrades or new dependencies. Practice does not issue certifications or promise interview success.

## Database and release requirements

Local migration: `supabase/migrations/20260917140718_interview_practice.sql`. Applied to the existing production Supabase project on 2026-09-17. It adds only `interview_practice_sessions`, an owner/history index, RLS and owner-only reads. Anonymous access and direct authenticated writes are revoked. Writes use the existing server-only admin client after authentication, ownership checks, bounded streamed payloads, validation and optimistic version checks. No SECURITY DEFINER functions are introduced.

`supabase/tests/interview_practice_security.sql` passed against production as an administrator. Its synthetic data and claims rolled back (zero practice rows remained). It checks RLS, owner reads, other-owner isolation, anonymous denial and direct-write privileges. Supabase recorded migration name `interview_practice`, version `20260917142857`; do not reapply the local DDL solely because its generated timestamp differs.

Reuse `SUPABASE_SECRET_KEY` on the server; never use a NEXT_PUBLIC prefix or expose its value. No new environment variables. Without the migration/key, free tab-local preview works but account saving and durable history are unavailable. Existing production key setup does not configure a separate local environment.

Commit, push and production deployment were authorized for this release.

## Verification

- `node --test lib/practice/practice.test.mjs lib/ai/interview-engine.test.mjs lib/ai/interview-learning.test.mjs lib/learning/learning.test.mjs`: 17 tests passed. Includes question-bank consistency, size/ownership validation, self-review boundaries, timer safety, route authentication, idempotent creation, owner scoping, stale writes, retry and delete.
- Lint, TypeScript and webpack production build passed.
- Actual UI components in an isolated synthetic browser fixture: complete text session → saved review → single weak-question retry; failed-save preservation; cross-tab version conflict; refresh/draft recovery; denied microphone and unsupported speech fallback; offline save disabling; timer expiry without answer loss. No browser errors detected. 390px viewport/document width matched.
- Real database/RLS execution passed. Browser fixture is not a production signed-in end-to-end test; account save → refresh → resume → delete needs a signed-in production check.

## Existing security notices

No advisor findings concern the new practice table. Existing notices remain outside this release: [mutable search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) on `set_updated_at`, public [anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)/[authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) execution of the existing `handle_new_user` trigger function, and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Do not interpret the feature's passing checks as a whole-app security certification.

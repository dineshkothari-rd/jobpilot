# JobPilot: connected career companion roadmap

## Principles

Free-first: no paid APIs, purchases, trials or infrastructure upgrades. Reuse existing modules and native browser features. Preparation, user-confirmed submission, self-review and provider-verified credentials must remain distinct. External content permissions and employer security restrictions remain intact.

## Delivery order

| Phase | Deliverable | Release gate |
| --- | --- | --- |
| 0 — Reliability | Signed-in production journey checks, save/recovery checks, existing auth/function security findings | Profile → resume → prepare → user-confirmed tracking; learning save → refresh; practice save → resume → delete. Real-device extension/voice checks. Separate validation before changing auth. |
| 1 — My Day | Evolve Home: explainable priorities, saved learning/practice continuation, honest counts and owner-private skip/reschedule/undo | Prioritization, partial failure, stale-tab and ownership tests; mobile/browser checks; no automatic completion/submission |
| 2 — Interview planning | Interview dates and timezone-aware calendar export | Clear reminder semantics, migrations/RLS checks, no hiding overdue work silently |
| 3 — Better opportunities | User-added roles and permitted additional free sources, deduplication, freshness/expired-job handling | Source terms checked, URL validation, clear source/date and duplicate tests |
| 4 — Evidence portfolio | Private original projects, contribution notes and explicit reviewed resume reuse | No invented experience, explicit sharing, owner isolation and deletion checks |
| 5 — Deeper learning | Longer original lessons, licensed/eligible resources, stronger assessments and spaced revision | Content permissions, accessible reading/video fallback, no fabricated external certificate |
| 6 — Application assistance | More tested form patterns and simpler helper permissions/fallbacks | Real-device permission tests, no consent/captcha/security bypass, no automatic Submit |
| 7 — Career decisions | Offer comparison, negotiation preparation and decision notes | User-supplied facts, clear assumptions, no unverified salary promises |
| 8 — Accessibility & portability | Global search, user data export, Hindi/English, installable PWA | Keyboard/screen-reader checks, private-cache safeguards and free-tier limits |

## Current implementation boundary

Phase 1 is implemented. My Day derives suggestions from existing account data rather than creating a duplicate task system, chatbot or paid integration. Learning/practice availability is independent of core job-search availability. A link click never writes completion. Exact practice continuation uses the existing owner-checked session API; learning opens the last saved lesson or final project/check review through the existing workspace.

The remaining roadmap phases are planned, not implemented by this release. Phase 0 signed-in production and real-device checks are still outstanding and are not claimed complete by fixture tests. No blanket whole-app security certification is implied.

## Phase 1 validation

Implemented: explainable Home priorities, separate prepared/submitted counts, saved lesson/final-project continuation, exact saved practice continuation and application-specific follow-up/activity links. Zero-submission response rate shows an unknown marker instead of an implied outcome. Setup remains mandatory before personalized suggestions; it cannot be skipped. The plan is collapsed initially, renders six priorities at a time and keeps all remaining priorities eligible. Set-aside items remain visibly counted, openable and reversible. The clock updates locally every minute without additional network requests.

Planning uses one private preferences row per account in `my_day_preferences`. Only internal suggestion keys and return times are saved. Skip today means midnight in the browser's current timezone; choose a time supports a future local time within 30 days. Neither operation changes actual follow-up dates, employment facts, exercises, application status or submission. Undo restores a suggestion. Expired entries are pruned on writes. Optimistic version checks reject stale or concurrent edits. Save failures retain the existing plan and show an error outside the collapsed planner.

Migration `supabase/migrations/20260917173309_my_day_planning.sql` was applied to production under name `my_day_planning`. RLS restricts reads/inserts/updates to the owner, including an UPDATE ownership check. Anonymous access and client TRUNCATE/DELETE are revoked. The API uses the authenticated client, not a privileged admin key. Requests have a streamed 4KB bound, same-origin checks, fixed fields and validated destinations/times. No new secret, dependency, paid integration or browser permission is required.

`supabase/tests/my_day_security.sql` passed against production with rollback: owner access, foreign-account/anonymous denial, reassignment denial and no synthetic rows remaining. Existing function/auth advisories are unchanged: [mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)/[authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) trigger-function execution, and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No finding concerns the new table.

Runnable checks: `node --test lib/home-next-action.test.mjs lib/page-guide.test.mjs lib/practice/practice.test.mjs lib/learning/learning.test.mjs`, lint, TypeScript and production build. Synthetic browser checks confirmed exact practice-session opening, compact initial plan, skip → priority change → refresh persistence, reschedule, Undo, stale-tab error preservation, 390px no overflow/errors and usable core job search when progress APIs return 503. The native datetime value was tested using DOM input/change events because the automation tool's datetime fill did not retain its value. These checks are not authenticated production or real-device tests.

Release validation passed: all 15 focused tests, ESLint, TypeScript and the webpack production build (32 pages). Production deployment readiness and unauthenticated route protection are checked separately; signed-in/device checks remain outstanding.

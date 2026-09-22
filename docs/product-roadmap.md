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

Later roadmap phases remain planned unless documented below. Phase 0 signed-in production and real-device checks are still outstanding and are not claimed complete by fixture tests. No blanket whole-app security certification is implied.

## Phase 4 validation

Implemented: a private Evidence Portfolio for original projects and work samples, with problem, personal contribution, outcome, skills and optional public HTTPS evidence link. Users explicitly mark a record reviewed, then may copy a factual, labelled resume draft for manual use; editing the record resets review. Nothing is added to a resume, published or shared automatically. Owner-confirmed deletion removes the private record. The saved Learning Studio capstone can be added from its own path without trusting a client-supplied project or fabricated contribution; duplicate imports are refused. A project remains self-reported, not independently verified or employment experience.

Migration `supabase/migrations/20260921104434_evidence_portfolio.sql` was applied to production. Owner-scoped RLS, grants and an indexed owner feed deny anonymous and foreign-account access; the rollback security check covered owner create/read/update/delete, reassignment denial and foreign/anonymous denial without leaving a synthetic row. Supabase security advisories show the same four existing warnings and intentional answer-key INFO; no portfolio finding. Focused API/model/learning/guide tests, lint, TypeScript and a 36-route build pass. A synthetic 390px browser journey checked create → review → edit → review reset, with no horizontal overflow, overlay or console error. Real signed-in production/device journeys are still outstanding; a fixture is not a live-account test.

## Phase 3 validation

Implemented: signed-in users can add a job found on any public HTTPS employer or job-board page using verified facts: title, company, URL, location, country, employment type, skills, summary and optional closing date. These private rows use the same profile/resume scorer and the existing review, save, preparation and application flows. Explicitly added jobs stay visible even below the discovery threshold because adding the link is a deliberate user action; the score is still shown honestly.

Links are canonicalized by removing fragments and common tracking parameters, then deduplicated per owner. A request ID makes a network retry idempotent. The server rejects credentials, HTTP, local hosts/IPs, unknown fields, oversized text, duplicate skills and invalid dates. JobPilot stores user-entered facts but does not scrape blocked pages or claim they were verified by the employer.

Freshness has three honest states: current from recorded dates, older than 45 days (verify), and closed/expired. The company-form action is hidden for expired rows. Owners can mark their own listing closed and reopen it without deleting tracked application history; optimistic versions prevent stale-tab overwrite. Autopilot excludes expired roles.

Migration `supabase/migrations/20260920135904_user_added_opportunities.sql` was applied to production. It also closes a pre-existing policy gap: browser clients can no longer insert or modify shared Himalayas rows. Public-feed refresh now writes only through the existing server-only key. User rows are owner-visible/owner-writable; foreign and anonymous access, owner reassignment, feed mutation, delete and truncate are denied. The rollback security test passed and left zero synthetic/user rows. Existing advisor warnings are unchanged; no new warning concerns jobs.

## Phase 2 validation

Implemented: owner-private interview rounds inside each tracked application, with confirmed local time and IANA timezone, duration, venue/link, preparation notes, status, outcome and next steps. Home prioritizes the earliest scheduled round; once its duration has passed it asks the user to record the outcome. A single application remains one daily action even when it has several rounds, so interview preparation does not hide other work.

Calendar export uses a native `.ics` download with UTC start/end, stable UID/version, cancellation status, escaping and UTF-8 line folding. The calendar file contains the saved notes and venue. JobPilot does not claim to send notifications or keep imported calendar events synchronized; users set reminders in their calendar. DST gaps and repeated local times are rejected instead of guessed. Scheduling never changes application status or claims an interview occurred.

Migration `supabase/migrations/20260917225237_interview_planner.sql` was applied to production as `interview_planner`. RLS and grants allow signed-in owners to select, insert and update rounds only for their own application; anonymous/foreign access, reassignment, client delete and truncate are denied. The rollback security test passed with no synthetic row retained. Security advisors report no new warning for this table; the four pre-existing warnings and intentional answer-key INFO remain unchanged.

Focused tests cover India/Nepal/New York timezone conversion, DST ambiguity/gaps, input bounds, calendar injection/Unicode folding, owner and stale-write enforcement, and Home priority behavior. ESLint, TypeScript and the 33-page production build pass. A synthetic 390px browser flow confirmed add → save → edit → complete → reload persistence with no horizontal overflow or browser error. Real signed-in production and real-device notification/calendar compatibility remain outstanding.

## Phase 1 validation

Implemented: explainable Home priorities, separate prepared/submitted counts, saved lesson/final-project continuation, exact saved practice continuation and application-specific follow-up/activity links. Zero-submission response rate shows an unknown marker instead of an implied outcome. Setup remains mandatory before personalized suggestions; it cannot be skipped. The plan is collapsed initially, renders six priorities at a time and keeps all remaining priorities eligible. Set-aside items remain visibly counted, openable and reversible. The clock updates locally every minute without additional network requests.

Planning uses one private preferences row per account in `my_day_preferences`. Only internal suggestion keys and return times are saved. Skip today means midnight in the browser's current timezone; choose a time supports a future local time within 30 days. Neither operation changes actual follow-up dates, employment facts, exercises, application status or submission. Undo restores a suggestion. Expired entries are pruned on writes. Optimistic version checks reject stale or concurrent edits. Save failures retain the existing plan and show an error outside the collapsed planner.

Migration `supabase/migrations/20260917173309_my_day_planning.sql` was applied to production under name `my_day_planning`. RLS restricts reads/inserts/updates to the owner, including an UPDATE ownership check. Anonymous access and client TRUNCATE/DELETE are revoked. The API uses the authenticated client, not a privileged admin key. Requests have a streamed 4KB bound, same-origin checks, fixed fields and validated destinations/times. No new secret, dependency, paid integration or browser permission is required.

`supabase/tests/my_day_security.sql` passed against production with rollback: owner access, foreign-account/anonymous denial, reassignment denial and no synthetic rows remaining. Existing function/auth advisories are unchanged: [mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)/[authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) trigger-function execution, and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No finding concerns the new table.

Runnable checks: `node --test lib/home-next-action.test.mjs lib/page-guide.test.mjs lib/practice/practice.test.mjs lib/learning/learning.test.mjs`, lint, TypeScript and production build. Synthetic browser checks confirmed exact practice-session opening, compact initial plan, skip → priority change → refresh persistence, reschedule, Undo, stale-tab error preservation, 390px no overflow/errors and usable core job search when progress APIs return 503. The native datetime value was tested using DOM input/change events because the automation tool's datetime fill did not retain its value. These checks are not authenticated production or real-device tests.

Release validation passed: all 15 focused tests, ESLint, TypeScript and the webpack production build (32 pages). Production deployment readiness and unauthenticated route protection are checked separately; signed-in/device checks remain outstanding.

## Profile-driven follow-up

Practice now defaults to the signed-in user's role and actual resume/job skills, not Software Engineer/Frontend. Any user-entered profession is accepted within the existing input bounds; missing skills produce a clearly proposed role scenario. Existing specialist practice topics remain opt-in. Shared interview prompts and job preparation no longer assume every user writes software. Finance, recruiting, mechanical engineering, sales, nursing and a custom profession have runnable regression checks. Generic engineering/management title words no longer merge unrelated market samples.

Learning recommendations require actual role, resume-skill or related-job evidence. Unsupported roles receive an honest no-match state plus role practice/catalogue browsing, not the first three web courses. The seven original course outlines and their permitted resources are still curated source content, not dynamically generated complete courses for every profession. Expanding or database-managing that catalogue remains a separate content feature; this release must not be described as eliminating all static content throughout JobPilot.

Migration `20260917175709_profile_driven_practice.sql` adds only the role-driven topic to the existing constraint. It preserves sessions, RLS and grants; production still denies anonymous reads and authenticated direct inserts. The focused cross-profile suite passes 30 tests; lint, TypeScript and the production build pass. Authenticated production/device UX checks remain outstanding.

## Dynamic Learning Studio

Runtime courses, original readings and public knowledge-check questions now come from `learning_catalog`, not client-side course constants. `*-seed.ts` files retain only the original migration/test fixtures and are not imported by app code. The initial migration preserves all seven course IDs and lesson IDs, so existing enrollments, notes, attempts and credentials continue to refer to the same content. New reviewed courses can be published through administrator database access without a code deployment.

Users can save up to 20 skill goals and a 10–180 minute daily study budget. Recommendations combine these explicit goals, actual resume skills, profile role and related stored-job requirements; reasons and approximate study days are visible. Goal-focused courses outrank weaker matches. Profile/goal changes are evaluated on the next learning load and never reset enrollments. New enrollments inherit the current role and study budget; a started path retains its own saved choices. Unmatched goals/roles receive honest browsing/practice options, not invented lessons. This release is a dynamic catalogue/planning feature, not an unlimited AI course generator or proof of complete course coverage for every profession.

`learning_answer_keys` is separate and server-only; signed-in and anonymous readers have no privileges. Public question DTOs strip unknown fields. Grading also checks that private questions/options match the published public questions. User-private goals have owner-scoped SELECT and server-verified owner writes; versions reject stale edits. Original text remains plain strings, never executable HTML. Only valid HTTPS publisher links and explicit YouTube privacy-enhanced players are accepted; videos load only after Watch here. No provider restriction, payment, trial or submission is bypassed.

Publishing contract: use a stable slug (up to 64 characters), a complete path definition, original reading for every lesson, exactly three public questions, and a matching private answer key. Verify free access and publisher/player permission; do not copy proprietary course content. There is no browser-accessible publishing endpoint or added admin authorization claim. Any UPDATE/DELETE to an enrolled course or its answer key is rejected by an invoker trigger with a fixed search path. Publish a new ID for revised enrolled content rather than invalidating prior evidence. A new course in any profession needs the same data contract, not a new React page or role switch.

Migration `20260917180505_dynamic_learning_catalog.sql` was applied to production. `supabase/tests/dynamic_learning_security.sql` passed with rollback: catalogue access, owner-only goals, no browser write grant, hidden answer keys and enrolled-course/key immutability; no synthetic rows remain. Security advisories have the same four existing warnings. The new INFO-only RLS-with-no-policy finding for answer keys is intentional default-deny ([Supabase explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)); no permissive policy was added just to silence it.

Focused catalogue/model/API tests cover dynamic non-software entries, goal prioritization, URL/reading validation, failures, stale writes and goal changes preserving enrolled progress. Local synthetic browser checks at 390px confirm goal save → updated suggestions → reload persistence and keyboard save → 409 → retained draft, with no overflow or console errors. Real signed-in production and device checks remain outstanding. Catalogue loading is bounded to 500 courses; paginate before exceeding that scale. No new dependency, paid provider, infrastructure upgrade, secret or browser permission was added.

Release checks passed: 31 focused tests, ESLint, TypeScript and the 32-page webpack production build.

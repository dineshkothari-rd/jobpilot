# SkillPath — Learn & Certify

Seven original career-connected paths cover web foundations, JavaScript/TypeScript, React, backend APIs, SQL, Git and computer science. Each has four curated lessons, original practice tasks, a capstone and a short server-graded knowledge check. Suggestions use existing resume skills, target roles and sampled job requirements; they are not proof that a user lacks a skill.

Resources were manually checked on 2026-09-17. Dates, access conditions, alternatives and estimated study times are visible. Publicly accessible material is not automatically open-source. Official resources remain on their publishers' sites; only three verified freeCodeCamp YouTube videos offer opt-in official embeds. CS50 lectures stay external because their licence includes non-commercial restrictions. No videos are downloaded or rehosted. Provider availability and embedding permission can change; use the external link or alternative when blocked.

## User flow

Choose a path → save private lesson notes, bookmarks and self-reported exercises → build a project → pass the original three-question check → explicitly request a private JobPilot completion record. Print the record using the browser's Save as PDF, or download its HTML. This is not an accredited qualification, identity verification or a provider certificate. Sharing is optional, uses a user-selected public name and exposes no private project or notes. Stop sharing or permanently revoke a record at any time.

Official free provider certificate routes are separate: users must complete the provider's entire current requirements. Manually imported external credentials are clearly unverified. Project evidence can be copied and reviewed in Resume Studio; learning never silently adds experience or qualifications to a resume.

## Database setup

Local migration: `supabase/migrations/20260917075845_skillpath_learning.sql`. Applied to production after authorization on 2026-09-17; the management API recorded version `20260917121452` (`skillpath_learning`). It creates three account-owned tables with RLS, owner-only authenticated reads and server-only writes. Existing `SUPABASE_SECRET_KEY` is required; no new environment variables or dependencies are introduced. Authenticated clients cannot directly write assessment scores or credentials. Account deletion cascades private learning data.

Run `supabase/tests/skillpath_security.sql` as an administrator after applying the migration on other installations. The check requires one existing account, inserts only transaction-local synthetic records and rolls everything back. This check passed against production: owner reads, other-account isolation, anonymous privilege denial and authenticated client write denial across all three tables. No synthetic records remain. A missing schema/key shows setup pending rather than inventing saved progress.

## Verification and limits

Runnable application checks: `node --test lib/learning/learning.test.mjs lib/resources/resource-provider.test.mjs lib/ai/career-intelligence.test.mjs lib/site-url.test.mjs lib/ux-theme.test.mjs`, plus lint, TypeScript and a production build. Route tests cover ownership, validation, server grading, stale updates, idempotency, credential eligibility, private sharing and revocation. In-memory route tests are not proof of real database RLS.

Browser checks use real components and synthetic local API data, not production authentication or database writes. English-language curated paths are the initial scope. No paid AI, course purchases, trials, provider exam automation, arbitrary code execution or automated certificate claims. Catalogue refresh is manual. Assessment quotas are a bounded per-account abuse guard, not a concurrency-safe distributed limiter.

Results: 17 focused tests, lint, TypeScript and production build passed. Synthetic browser checks confirmed note persistence after refresh, cancelled navigation retaining unsaved notes, all four exercises → saved project → passing quiz → explicit private record issuance, no eagerly loaded video iframe, and no horizontal overflow or browser errors at 390px. Server-only question/answer strings were absent from built client chunks. Production migration and real database role checks passed; signed-in production browser verification remains pending. Security advisors reported no SkillPath table issue, but existing mutable-search-path/auth-trigger-execute warnings and disabled leaked-password protection remain outside this feature release.

# Feature inventory

Last reconciled: 2026-10-08 (source and automated checks; external acceptance is separate)

Statuses: **Implemented**, **Partial**, **Planned**, **Decision required**, **Out of scope**.

| Feature | Status | Purpose and entry | Workflow / dependencies | Data and APIs | Security, tests, limitations |
| --- | --- | --- | --- | --- | --- |
| Authentication | Implemented | Google and email/password sign-in at `/auth/login` | OAuth → callback → profile/dashboard | `profiles`, `job_preferences`; `/auth/callback` | Safe redirects and server session checks. Email/password UI is implemented; real account acceptance remains a launch check. |
| Profile | Implemented | Canonical candidate identity at `/profile` | Load/edit identity and links | `profiles`; browser Supabase | Owner RLS. No stale-write version. |
| Career preferences | Implemented | `/profile`, `/autopilot` | Roles, locations, mode, salary, thresholds | `job_preferences`, `autopilot_preferences` | Owner RLS; overlapping concepts exist. |
| Resume | Implemented | `/resume` | Validate PDF → parse → Storage upload → save | `resumes`, Storage `resumes`; `/api/resume/parse` | Private owner-prefix Storage, 5 MiB PDF bucket limit and SQL security coverage. No OCR; migration deployed. Real signed-in Storage acceptance remains a launch check. |
| Resume Studio | Implemented | `/resume/studio` | Duplicate → tailor → save/export | `resumes`, `saved_jobs` | Source file unchanged. Primary switch is not transactionally enforced. |
| ATS | Implemented | Resume Studio | Deterministic score and grounded edits | `lib/resume/ats.ts` | Tested; not an ATS guarantee. |
| Career Intelligence | Implemented | `/career` | Combine profile, resume, jobs and applications | `/api/career/intelligence` | Deterministic; insufficient market data is explicit. |
| Jobs | Implemented | `/jobs`, `/jobs/[id]` | Multi-source sync (Himalayas, Remotive, Arbeitnow) → store/filter/detail | `jobs`; job APIs | Jobs RLS enabled; source isolation, deduplication, attribution; advanced filters for experience, industry, salary floor, posting date, and hybrid/remote/on-site work. |
| Internships & Freshers | Implemented | `/internships` | Filter early-career pool → duration/stipend/category → apply/prepare | `jobs`; job APIs, `lib/jobs/internships.ts` | Dedicated campus/graduate discovery; duration windows, monthly stipend parsing, fresher career guidance. |
| Company Profiles & Directory | Implemented | `/companies`, `/companies/[slug]` | Browse companies → profile/stats → company-specific openings | `jobs`; `/api/companies`, `/api/companies/[slug]` | Deterministic aggregation from verified jobs; slug canonicalization, search, live openings. |
| Company Following & Alerts | Implemented | `/companies`, `/companies/[slug]` | Follow/unfollow companies → track hiring pipeline → new opening alerts | `company_follows`; `/api/companies/[slug]/follow`, `/api/companies/following` | Authenticated RLS, unique constraint, 7-day fresh openings detection, live follower count. |
| Employee Reviews & Ratings | Implemented | `/companies/[slug]` | Grounded 1-5 star ratings, dimension breakdowns (work-life, growth, culture), pros/cons | `company_reviews`; `/api/companies/[slug]/reviews` | Authenticated RLS, 1 review per user/company anti-abuse constraint, human-only reviews (no fabricated ratings). |
| Manual Opportunities | Implemented | `/jobs` | Validate URL → owner row → versioned close/reopen | `jobs`; `/api/jobs/manual` | Owner-only updates and immutable ownership. |
| Matching | Implemented | Job rankings | Role/skills/location/seniority/salary/country (with India tech hub recognition & LPA compensation) | `/api/jobs/match` | Explainable deterministic score; not certainty. |
| Saved Jobs | Implemented | `/saved-jobs` | Save/unsave → preparation | `saved_jobs`; `/api/jobs/save` | Owner RLS and unique pair. |
| Saved Searches | Implemented | `/jobs` | Save named filter criteria → manage/re-run in 1 click | `saved_searches`; `/api/jobs/saved-searches` | Owner RLS, sanitized criteria validation, one-click load/delete. |
| Applications | Implemented | `/applications` | Prepare/track → explicit confirmation → follow-up/interview | `applications`, `application_submissions`; `/api/applications` | Fail-closed `saved` default, explicit submission intent, legal transitions and optimistic version. Owner-private `application_events` stores lifecycle history; recruiter application history remains separately authorized. |
| Application Facts | Implemented | Application workspace | Confirm facts → versioned JSONB update | `profiles.application_facts`; `/api/applications/answers` | Bounded, owner-scoped, stale-write protected. |
| Application Copilot | Implemented | `/jobs/[id]/copilot` | Ground profile/resume into reviewable answers | `/api/jobs/[id]/copilot` | Never submits or verifies acceptance. |
| Autofill extension | Implemented | Applications workspace | Reviewed contacts → temporary storage → exact empty fields | `extensions/autofill/` | Never files, consent, legal answers, overwrite, analytics, or Submit. |
| Follow-up | Partial | Application details | Reminder plus stage-aware copy | `applications.follow_up_at` | Does not send email or prove contact. |
| Autopilot | Implemented as preparation | `/autopilot`, cron | Sync → eligibility → lock → prepare → review | Autopilot tables/APIs | Secret cron, lock, limits, idempotency. No submission provider. |
| Interview Planner | Implemented | Application details | Schedule/reschedule/export/outcome | `application_interviews`; `/api/interviews` | Owner/application checks, DST validation, versions. |
| Interview Preparation | Implemented | `/jobs/[id]/prepare` | Grounded topics/questions/resources | preparation/AI/resource APIs | Deterministic by default; optional AI. |
| Interview Practice | Implemented | `/practice` | Configure → answer → self-review → save/retry | `interview_practice_sessions`; `/api/practice` | Versioned server writes; self-review is not certification. |
| Learning / SkillPath | Implemented | `/learn`, `/learn/[path]` | Paths → exercises → assessment/project | learning tables; `/api/learn` | Answer keys server-only; provider availability may change. |
| Completion Records | Implemented | Learning and `/verify/learning/[id]` | Issue private record → optional public share | `skillpath_credentials` | Not accredited, identity-verified, or provider-issued. |
| Portfolio / Evidence | Implemented | `/portfolio` | Record/import real contribution → review/copy | `portfolio_evidence`; `/api/portfolio` | Owner RLS and versions. |
| My Day | Implemented | Dashboard | Rank → defer/undo | `my_day_preferences`; `/api/my-day` | Does not change application progress. |
| Dashboard | Implemented | `/dashboard` | Aggregate next actions | Multiple domains | Cross-domain consumer and large client module. |
| AI platform | Partial | Interview actions | Factory selects provider or fallback | `/api/ai/interview`, `lib/ai/providers/` | Bounded/fallback behavior; other `lib/ai` modules may be deterministic. |

Relevant tests: `lib/**/*.test.mjs`, `supabase/tests/*.sql`.

## Production backlog additions

Recruiter verification, candidate discovery/privacy, messaging, employer applications/invitations, branding, moderation, alerts/reminders, admin roles/suspension, account export/deletion, plan entitlements and billing are covered individually in [all 41 feature names/statuses](PRODUCTION-PROGRESS.md), with [source and domain references](../IMPLEMENTATION-REFERENCE.md). Billing is code-complete but externally inactive; real email/calendar/device acceptance is pending. Avoid interpreting this engineering inventory as income activation.

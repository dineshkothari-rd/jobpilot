# Feature inventory

Last verified: 2026-09-27

Statuses: **Implemented**, **Partial**, **Planned**, **Decision required**, **Out of scope**.

| Feature | Status | Purpose and entry | Workflow / dependencies | Data and APIs | Security, tests, limitations |
| --- | --- | --- | --- | --- | --- |
| Authentication | Partial | Google sign-in at `/auth/login` | OAuth → callback → profile/dashboard | `profiles`, `job_preferences`; `/auth/callback` | Safe redirects and server session checks. Email/password UI is not implemented. |
| Profile | Implemented | Canonical candidate identity at `/profile` | Load/edit identity and links | `profiles`; browser Supabase | Owner RLS. No stale-write version. |
| Career preferences | Implemented | `/profile`, `/autopilot` | Roles, locations, mode, salary, thresholds | `job_preferences`, `autopilot_preferences` | Owner RLS; overlapping concepts exist. |
| Resume | Partial | `/resume` | Validate PDF → parse → Storage upload → save | `resumes`, Storage `resumes`; `/api/resume/parse` | Private owner-prefix Storage, 5 MiB PDF bucket limit and SQL security coverage. No OCR; production migration remains pending approval. |
| Resume Studio | Implemented | `/resume/studio` | Duplicate → tailor → save/export | `resumes`, `saved_jobs` | Source file unchanged. Primary switch is not transactionally enforced. |
| ATS | Implemented | Resume Studio | Deterministic score and grounded edits | `lib/resume/ats.ts` | Tested; not an ATS guarantee. |
| Career Intelligence | Implemented | `/career` | Combine profile, resume, jobs and applications | `/api/career/intelligence` | Deterministic; insufficient market data is explicit. |
| Jobs | Implemented | `/jobs`, `/jobs/[id]` | Multi-source sync (Himalayas, Remotive, Arbeitnow) → store/filter/detail | `jobs`; job APIs | Jobs RLS enabled; source isolation, deduplication, attribution; advanced filters for experience, industry, salary floor, posting date, and hybrid/remote/on-site work. |
| Internships & Freshers | Implemented | `/internships` | Filter early-career pool → duration/stipend/category → apply/prepare | `jobs`; job APIs, `lib/jobs/internships.ts` | Dedicated campus/graduate discovery; duration windows, monthly stipend parsing, fresher career guidance. |
| Manual Opportunities | Implemented | `/jobs` | Validate URL → owner row → versioned close/reopen | `jobs`; `/api/jobs/manual` | Owner-only updates and immutable ownership. |
| Matching | Implemented | Job rankings | Role/skills/location/seniority/salary/country (with India tech hub recognition & LPA compensation) | `/api/jobs/match` | Explainable deterministic score; not certainty. |
| Saved Jobs | Implemented | `/saved-jobs` | Save/unsave → preparation | `saved_jobs`; `/api/jobs/save` | Owner RLS and unique pair. |
| Applications | Partial | `/applications` | Prepare/track → explicit confirmation → follow-up/interview | `applications`, `application_submissions`; `/api/applications` | Fail-closed `saved` default, explicit submission intent, legal transitions and optimistic version. Current state only; no event history. |
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

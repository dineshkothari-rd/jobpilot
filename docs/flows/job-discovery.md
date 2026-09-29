# Job discovery flow

Last verified: 2026-09-27

## Entry condition

An authenticated user has a profile and job preferences and opens `/jobs` or Dashboard.

## Steps

1. `POST /api/jobs/sync` optionally refreshes Himalayas results using up to three target roles and the first preferred country.
2. Provider rows are normalized, deduplicated by external ID, and upserted as global jobs.
3. `GET /api/jobs/match` loads the profile, primary resume, preferences, and up to 100 visible jobs.
4. The deterministic scorer produces role, skills, location, seniority, salary, and country components.
5. The user filters, opens `/jobs/[id]`, saves a job, or enters preparation.
6. Alternatively, the user adds a public HTTPS opportunity; `/api/jobs/manual` creates an owned `source=user` job.

Database effects: feed upserts `jobs` through a service-role client; manual opportunities are owner rows; save/unsave changes `saved_jobs`.

Security checks: user authentication, job RLS, explicit context ownership, strict manual URL/field validation, immutable manual ownership, and versioned close/reopen.

Failure states: incomplete profile/preferences, missing server key, provider timeout/outage, empty results, stale/expired job, duplicate manual URL, or stale manual version.

Exit condition: the user has evaluated, saved, or opened an opportunity. A match score is explainable compatibility guidance, not hiring probability.

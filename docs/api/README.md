# API inventory

Last verified: 2026-09-27

All paths are Next.js route handlers. User APIs authenticate with Supabase `getUser()`. Responses are JSON unless noted. RLS applies to cookie-scoped clients; service-role calls require explicit ownership checks because they bypass RLS.

## Authentication and resume

### `GET /auth/callback`

- Purpose: exchange OAuth code, inspect onboarding completeness, and redirect.
- Auth/input: public OAuth callback; `code`, provider `error`, optional safe `next` query.
- Validation: canonical site URL and internal-path allowlist.
- Output/errors: redirect to Profile, requested route, or Login with a stable error code.
- Data: reads `profiles`, `job_preferences`; no service role.
- Side effects: session cookie exchange. OAuth code retry behavior belongs to Supabase.

### `POST /api/resume/parse`

- Purpose: extract and deterministically parse text from a PDF.
- Auth/input: signed-in user; multipart `file`.
- Validation: actual `File`, MIME `application/pdf`, at most 5 MB, readable non-empty text, extracted text at most 250,000 characters.
- Output: `{success,text,pages,parsedData}`; 400 invalid file, 422 unreadable/oversized text, 500 parse failure.
- Data/privilege: no DB write and no service role. The browser performs Storage/database writes separately.
- Idempotency/version/external: stateless; no version; no external provider.

## Jobs, matching, and resources

### `GET /api/jobs/match`

- Purpose: score up to 100 visible jobs with the deterministic matching engine.
- Input/output: no body; returns sorted jobs, score breakdown and configured threshold.
- Data: `profiles`, `job_preferences`, primary `resumes`, `jobs`; no service role.
- Errors: 401, `PROFILE_REQUIRED`, `PREFERENCES_REQUIRED`, or 500.
- Ownership: profile/preferences/resume are user-filtered; jobs visibility is enforced by RLS.
- Side effects/idempotency/version/external: read-only; no version or external call.

### `POST /api/jobs/sync`

- Purpose: refresh public Himalayas jobs for the authenticated user's roles/preferences.
- Input/output: no body; returns fetched/filtered/upserted counts.
- Data: reads user `profiles`/`job_preferences`; service-role upserts global `jobs`.
- Validation/ownership: authentication and user-scoped context; provider rows are normalized and unsafe application URLs discarded.
- Errors: 401, 503 missing server key, 500 provider/storage failure.
- Idempotency: upsert on `external_id`; no optimistic version.
- External: Himalayas search API with timeout. Architectural improvement: rate/abuse policy and privileged client should be centralized.

### `GET /api/jobs/[id]`

- Purpose: return one visible job plus the user's saved/application context.
- Input: bounded route `id`.
- Data: `jobs`, `saved_jobs`, `applications`; no service role.
- Output/errors: job, `saved`, application; 400, 401, 404, 500.
- Ownership: RLS plus explicit `user_id` on user relationships. Read-only.

### `POST /api/jobs/manual`

- Purpose: create a user-owned opportunity.
- Input: bounded JSON containing UUID request ID, title, company, public HTTPS URL, optional description/location/country/type/skills/expiry.
- Validation: streamed 32 KB limit, strict keys, URL canonicalization, field/list/date bounds, same-origin/cross-site rejection.
- Data: inserts `jobs` with `source=user` and `created_by=user.id`; no service role.
- Output/errors: 201 created, idempotent retry result, 400/401/403/409/413/503.
- Idempotency: hashed request ID plus owner/application URL uniqueness.

### `PATCH /api/jobs/manual`

- Purpose: close or reopen an owned manual opportunity.
- Input: `{id,closed,version}` with strict keys and 32 KB limit.
- Data: version-filtered update of owner/source-matched `jobs`.
- Errors: 400/401/403/409 stale/413/503.
- Stale-write protection: yes; increments `version`.

### `POST /api/jobs/save`

- Purpose: save or remove a visible job.
- Input: JSON `{jobId,action:"save"|"remove"}`.
- Validation: body object, bounded ID, job visibility/existence.
- Data: `jobs`, `saved_jobs`; no service role; explicit owner filters.
- Output/errors: `{success,saved}`; 400/401/404/500.
- Idempotency: save uses conflict-ignore; remove is naturally repeatable. No stale version.
- Improvement: add consistent body-byte/origin policy.

### `GET /api/jobs/[id]/prepare`

- Purpose: build the full deterministic preparation hub.
- Input: job route ID.
- Data: `jobs`, `profiles`, primary `resumes`, `job_preferences`, `applications`; no service role.
- Output: preparation, readiness, study plan, topics, questions, revision and provenance.
- Errors: 401/404/500. Read-only and repeatable; no external call.

### `GET /api/jobs/[id]/copilot`

- Purpose: generate grounded application guidance and reusable answer context.
- Data: `jobs`, `profiles`, `resumes`, preferences, saved state and application; no service role.
- Output/errors: Copilot package or 401/404/500.
- Ownership: user data filtered; job visibility through RLS. Read-only.

### `GET /api/jobs/[id]/interview`

- Purpose: return a grounded interview session for a job.
- Data: job, profile, resume, preferences and application; no service role.
- Output/errors: session/preparation context or 401/404/500. Read-only.

### `POST /api/jobs/[id]/interview`

- Purpose: deterministically evaluate a bounded answer against one generated question.
- Input: action/question ID/answer expected by the route; bounded and checked against generated context.
- Data: same user/job context as GET; no persistent write or service role.
- Output: evaluation; errors 400/401/404/500. Repeatable; no external AI.

### `GET /api/resources/interview`

- Purpose: return role/topic learning resources.
- Input: `jobId`, optional bounded topic/query context.
- Data: visible `jobs`; no service role.
- External: YouTube API when configured, otherwise curated first-party links and safe search links.
- Errors: 400/401/404/500. Provider results are normalized; factory caches by bounded query.

## Applications and interviews

### `GET /api/applications`

- Purpose: return the user's application pipeline, packages, facts, resumes and recalculated match context.
- Data: `applications`, `profiles`, `job_preferences`, `resumes`, `application_submissions`, `autopilot_preferences`; no service role.
- Output/errors: composite private workspace response or 401/500.
- Ownership: every user-owned query is filtered by user ID and RLS. Read-only.

### `POST /api/applications`

- Purpose: create a tracker record or explicitly advance an existing prepared `saved` record.
- Input: `jobId`, optional status (defaults `saved`), notes, resume, follow-up, explicit `submissionConfirmed`, and current version when confirming an existing saved row.
- Validation: new rows start `saved` unless `applied` is explicitly confirmed; visible job, owned resume, bounded notes and parseable date.
- Data: inserts/updates `applications`; no service role.
- Output/errors: created/existing application; 400/401/404/409/500.
- Idempotency/concurrency: unique user/job record; unchanged repeats return the existing row; saved-to-applied confirmation compares and increments version or returns `409`.

### `PATCH /api/applications`

- Purpose: update status, notes, follow-up, or selected resume.
- Validation: current positive version, centralized legal transition, explicit confirmation for `saved → applied`, allowed fields/values and owned resume.
- Data: owner-filtered `applications`; automatic follow-up may be added/cleared.
- Errors: 400/401/404/409 stale/500.
- Stale-write protection: owner and version are part of the conditional update; successful mutations increment version.

### `PUT /api/applications/answers`

- Purpose: save explicitly confirmed reusable application facts.
- Input: exact known fields, factual-confirmation flag, and previous version/current facts.
- Validation: bounded request/keys/strings and same-origin checks.
- Data: owner-filtered `profiles.application_facts`; no service role.
- Errors: 400/401/403/409 stale/413/503.
- Stale-write protection: yes, using stored fact version/current JSON.

### `GET /api/interviews`

- Purpose: list rounds for an owned application or upcoming rounds.
- Input: optional validated `application` query.
- Data: `application_interviews`, `applications`; no service role.
- Ownership: explicit user/application checks plus RLS. Errors 400/401/503.

### `POST /api/interviews`

- Purpose: create or update an interview round.
- Input: strict interview object including IDs, local time, IANA timezone, duration, status/outcome and version.
- Validation: streamed body bound, same-origin, application ownership, DST/ambiguous-time rejection and field bounds.
- Data: `application_interviews`; no service role.
- Errors: 400/401/403/404/409 stale/413/503.
- Idempotency/version: client UUID makes create retry-safe; updates require matching version.

## Autopilot, career, and planning

### `GET /api/autopilot`

- Purpose: settings, setup health, usage, background status, actions, prepared packages and follow-ups.
- Data: Autopilot tables plus profile/preferences/resume/applications; no service role for interactive read.
- Errors: 401/500. Read-only.

### `PATCH /api/autopilot`

- Purpose: normalize and save Autopilot preferences.
- Input: settings object; numeric/list/text bounds; `autoSubmit` always stored false.
- Data: owner `autopilot_preferences`; no service role.
- Errors: 400/401/500. Upsert is idempotent; no stale version.

### `POST /api/autopilot`

- Purpose: run or retry preparation for the signed-in user.
- Input: optional bounded `retryId`.
- Data: jobs, profile/preferences/resume, applications and all Autopilot tables.
- Ownership: user ID is passed through every operation; cookie-scoped client/RLS.
- Side effects: action log, prepared package, saved application/job relationship.
- Idempotency: active-run unique index, prepared/submitted skip, unique user/job package, daily limit.
- Errors: 400/401/409 active run/500. Does not mark employer submission.

### `GET /api/cron/autopilot`

- Purpose: daily background refresh and preparation for enabled users.
- Auth: constant-time bearer comparison with `CRON_SECRET`.
- Data/privilege: service role across Autopilot, job, profile, preference, resume and application tables.
- Side effects: feed upserts, action logs, packages and saved tracker rows.
- Idempotency: completed scheduled run per UTC day, per-user active lock, package uniqueness.
- External: Himalayas. A feed failure does not block evaluation of existing jobs.
- Errors: 401/503; bounded four-minute worker budget. Future resumable batching is scale-dependent.

### `GET /api/career/intelligence`

- Purpose: deterministic completeness, readiness, gaps and next actions.
- Data: `profiles`, `job_preferences`, `resumes`, `jobs`, `saved_jobs`, `applications`; no service role.
- Output/errors: grounded intelligence or 401/500. Market demand is marked insufficient without reliable data.

### `GET /api/my-day`

- Purpose: load private deferral preferences/version.
- Data: `my_day_preferences`; owner RLS. Returns defaults when absent.

### `POST /api/my-day`

- Purpose: save/undo a bounded deferral.
- Input: action href, optional date, current version; same-origin and strict validation.
- Data: insert/update `my_day_preferences`; no service role.
- Errors: 400/401/403/409 stale/503. Version protected; never mutates application progress.

## Learning, practice, portfolio, and AI

### `GET /api/learn`

- Purpose: load catalog recommendations, goals, enrollments, attempts and credentials.
- Input: optional path selection.
- Data: learning tables plus profile/resume/jobs; normal client for readable owner/catalog data.
- Output includes storage readiness; errors 400/401/503.

### `POST /api/learn`

- Purpose: save goals/progress, grade assessments, create/import/share/revoke completion records.
- Input: strict action-specific bounded payload and client request IDs/versions where applicable.
- Data/privilege: authenticated user context followed by service-role writes; answer keys read only on the server.
- Ownership: every privileged query includes user ID; catalog IDs are validated.
- Errors: 400/401/403/404/409/503. Progress is versioned; request IDs/unique constraints make issuance/import retry-safe.

### `GET /api/learn/certificate`

- Purpose: render/download an authenticated user's JobPilot completion record as escaped HTML.
- Input: validated credential UUID and optional `download=1`.
- Data: owner `skillpath_credentials` and profile; no service role.
- Security: restrictive CSP, `nosniff`, escaped content, no-store.
- Errors: 400/401/404/503/500.

### `GET /api/practice`

- Purpose: load session/history and profile/resume/application context.
- Input: optional validated session ID.
- Data: practice, profile, resume, applications and jobs; no privileged read required.
- Errors: 400/401/404/503. Owner filters and RLS.

### `POST /api/practice`

- Purpose: create, save, retry, or delete a private practice session.
- Input: action-specific JSON, streamed maximum 700 KB, same-origin, strict IDs and model validation.
- Data/privilege: authenticated user context; service-role writes scoped by user ID.
- Idempotency/version: client UUID create retry, maximum 100 sessions, optimistic version on save.
- Errors: 400/401/403/404/409/413/429/503.

### `GET /api/portfolio`

- Purpose: return up to 100 latest evidence records.
- Data: owner `portfolio_evidence`; no service role. Read-only.

### `POST /api/portfolio`

- Purpose: create manual evidence or import a saved learning project.
- Input: 32 KB bounded evidence fields or exact learning action/path.
- Data: `portfolio_evidence`, `skillpath_enrollments`; no service role.
- Errors: 400/401/403/404/409 duplicate/413/503. Learning source uniqueness provides retry safety.

### `PATCH /api/portfolio`

- Purpose: edit or mark evidence reviewed.
- Input: strict fields, ID and version.
- Data: owner/version-filtered update; edits clear review state.
- Errors: 400/401/403/409 stale/413/503. Version protected.

### `DELETE /api/portfolio`

- Purpose: delete an owner/version-matched evidence record.
- Errors: 400/401/403/409/413/503. Version protected.

### `POST /api/ai/interview`

- Purpose: run one optional provider-backed interview action with deterministic fallback.
- Input: bounded action and identifiers/answer grounded against server-loaded job/profile/resume data.
- Data: `jobs`, `profiles`, `resumes`, `job_preferences`; no service role.
- External: OpenAI-compatible chat completions when configured.
- Output: normalized result plus provider/fallback status. Malformed/provider failure falls back rather than failing the workflow.

## Cross-cutting improvement list

- Centralize authentication and service-role construction.
- Apply consistent byte limits, origin checks, no-store headers, validation and error envelopes.
- Add optimistic versions to profile/resume settings only when those stale-tab risks are prioritized; applications are version protected.
- Extend the locally implemented fail-closed application lifecycle only when new product transitions are approved; production still requires the pending Phase 2 migration.
- Keep API changes backward-compatible or phase them with current clients.

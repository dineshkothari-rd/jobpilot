# Interview flow

Last verified: 2026-09-27

## Entry condition

The user has a target job/application and enters `/jobs/[id]/prepare`, `/jobs/[id]/interview`, `/practice`, or the planner inside `/applications`.

## Preparation and practice

JobPilot combines job requirements, profile role, resume skills and current application context into deterministic topics, questions, weak areas, study plans and revision. Optional `/api/ai/interview` actions may enhance a selected explanation/evaluation and fall back deterministically. `/api/resources/interview` supplies YouTube results when configured or curated links.

Practice sessions at `/practice` are private, owner-scoped records. The user selects role/job, topic, mode and time guide, answers one question at a time, self-reviews rubric coverage, saves, finishes, or retries weak questions. Scores represent checked rubric coverage—not objective correctness or readiness certification.

## Planner

Inside an application, `GET/POST /api/interviews` loads and saves rounds. Local date/time plus IANA timezone is converted to an exact UTC instant; invalid, nonexistent, or ambiguous DST times are rejected. The user may export ICS and record status/outcome.

Database effects: `application_interviews` and `interview_practice_sessions`; preparation itself is read-only.

Security: authentication, owner/application validation, RLS, bounded payloads, service-role practice writes scoped by user, and optimistic versions. Voice recording remains local; optional browser speech recognition may use browser/vendor processing and is disclosed.

Failure states: missing job/profile/resume, provider fallback, invalid timezone/DST time, stale version, offline save, microphone denial, or storage unavailable.

Exit condition: the user has a plan, saved interview round, completed/self-reviewed practice, or focused retry—not a fabricated outcome.

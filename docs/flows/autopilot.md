# Autopilot flow

Last verified: 2026-09-27

## Entry condition

The authenticated user configures `/autopilot`; scheduled runs additionally require enabled preferences, `CRON_SECRET`, `SUPABASE_SECRET_KEY`, and the Vercel schedule.

## Steps

1. User saves roles, locations, work modes, salary, authorization, notice period, companies, industries, daily limit, and threshold.
2. Manual Run now calls `POST /api/autopilot`; scheduled work calls `GET /api/cron/autopilot` with a bearer secret.
3. A unique partial index prevents overlapping active runs for one user.
4. Existing prepared/submitted packages and already tracked jobs are evaluated to avoid duplication.
5. Jobs are matched against profile, resume and preferences.
6. Eligible jobs receive deterministic, grounded application packages.
7. `application_submissions`, `automation_actions`, a `saved` application and saved-job relationship are written.
8. The user reviews and submits externally through the application flow.

Security: cron uses constant-time secret comparison; service-role worker queries are user-scoped; interactive runs use the user's client/RLS; unsafe links and missing required facts fail safely. `auto_submit` is normalized to false.

Idempotency/failure: active-run lock, unique package, daily cap and completed daily scheduled-run check prevent ordinary duplication. Feed failure retains existing jobs. Per-user failure does not stop later users. Four-minute budget exhaustion returns 503 for operator attention.

Exit condition: jobs are skipped/need review or packages are prepared. No employer application is submitted or represented as submitted.

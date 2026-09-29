# Troubleshooting

Last verified: 2026-09-27

## OAuth returns to Login

- Confirm `NEXT_PUBLIC_SITE_URL` matches the exact production origin.
- Confirm Supabase Site URL and redirect allowlist include `/auth/callback`.
- Confirm Google redirects to the Supabase Auth callback, not directly to JobPilot.
- Check whether the Google OAuth app is still in Testing mode.

## Resume parses but upload fails

The parser and Storage are separate steps. A fresh local reset creates the private `resumes` bucket and owner object policies; production still requires the pending Phase 2 migrations. Confirm the target project has those migrations before diagnosing uploads. Do not make the bucket public as a workaround.

## Resume PDF has no readable text

Image-only/scanned PDFs are unsupported. Export a text-based PDF. OCR is not implemented.

## Background Autopilot says setup pending

Confirm server-only `SUPABASE_SECRET_KEY` and `CRON_SECRET` are configured in the correct environment. Preview deployments do not run Vercel cron. Prepared packages still require user review/submission.

## Learning/practice is preview-only or storage unavailable

Privileged durable writes require `SUPABASE_SECRET_KEY`. Confirm migrations are applied and restart the local server after adding the variable. Never expose the key to the browser.

## AI/resource provider unavailable

This is expected when optional keys are absent or providers fail. Interview actions use deterministic fallback; resource search uses curated documentation/safe search. Check server variables only if connected behavior is required.

## Stale-tab conflict

Applications, application facts, manual jobs, interview rounds, practice, learning, My Day and portfolio use optimistic versions. Preserve/copy unsaved text, reload the latest record, and reapply the intended change. Profile and resume metadata do not yet consistently detect stale tabs. Application version protection is implemented locally but remains pending the Phase 2 production migration.

## SQL tests require data

Run `npx supabase db reset --local` first. `supabase/seed.sql` creates deterministic accounts/job/application used by security assertions. Ensure Docker/local Supabase is running.

## Next build or Node test module warnings

Node may warn when `.mjs` tests import TypeScript files in a package without `type: module`. The verified suite still passes; do not change package/module configuration solely to hide a warning without a separate compatibility review.

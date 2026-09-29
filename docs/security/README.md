# Security model

Last verified: 2026-09-27

## Threat model

JobPilot protects one user's profile, resume, applications, plans, practice, learning, and evidence from other users and anonymous clients. It also protects service-role credentials, assessment answer keys, OAuth destinations, cron execution, uploaded files, external links, and AI/provider boundaries. It does not claim to secure employer sites or verify external submissions.

## Authentication and sessions

Google OAuth is implemented through Supabase. `proxy.ts` refreshes the session and redirects unauthenticated page requests. Every user API independently calls `auth.getUser`; the cron route instead requires `Authorization: Bearer <CRON_SECRET>`.

OAuth redirects use a canonical site URL and `safeInternalPath`, rejecting external and protocol-relative destinations.

## Authorization, RLS, and ownership

User-owned public tables have RLS and policies based on `auth.uid()`. Core legacy grants are reduced to product-required operations; anonymous access and authenticated `TRUNCATE` are revoked. API queries commonly add explicit owner filters. Jobs distinguish global rows (`created_by is null`) from user-created rows; a trigger prevents ownership transfer. Production verification confirms jobs RLS is enabled.

## Service-role boundary

`SUPABASE_SECRET_KEY` is server-only and bypasses RLS. Current privileged paths include scheduled Autopilot, job ingestion, learning/practice writes, and public shared-record verification. They authenticate the user or validate explicit public-sharing state and then apply ownership filters. The key must never enter a client module, response, log, or `NEXT_PUBLIC_` variable.

## Privileged database resources

`learning_answer_keys` has RLS enabled, intentionally has no browser policy, revokes privileges from `public`, `anon`, and `authenticated`, and grants access only to `service_role`. The remaining Supabase advisor INFO is accepted and intentional.

`handle_new_user` is `SECURITY DEFINER` because an `auth.users` trigger must create the initial profile. It uses a fixed search path and explicit public-table reference. Direct execution is revoked from `PUBLIC`, `anon`, and `authenticated`.

## Input and URL boundaries

- Resume parse accepts authenticated PDF uploads up to 5 MiB, rejects empty/image-only text extraction, and caps extracted text. The private bucket independently enforces the size and PDF MIME allowlist; object insert/delete policies enforce the authenticated user's path prefix.
- Manual job links require public HTTPS URLs and reject credentials, localhost, local suffixes, and IP literals.
- Navigation URLs are normalized before use; server-side provider calls use fixed provider origins.
- Newer write routes stream and cap request bytes. Older routes have less consistent origin/body-size enforcement.

## AI boundary

External AI input is bounded and labeled as untrusted data. Output is parsed and normalized; failure uses deterministic fallback. AI output is a suggestion, never a confirmed candidate or employer fact.

## Stale writes

Optimistic versions protect applications, application facts, manual opportunities, interview rounds, practice sessions, learning progress, My Day preferences, and portfolio evidence. Profile, resume metadata, and Autopilot preference updates do not consistently have stale-write protection.

## Browser extension boundary

The extension trusts messages only from the configured production Applications page, uses top-frame checks and temporary session storage, accepts a fixed contact-field allowlist, requests temporary Lever permission only on user action, and never submits, uploads files, answers consent/legal questions, or overwrites existing fields.

## SQL security verification

The local database reconstructs from migrations and all nine SQL security files pass. They cover core user data, resume Storage, dynamic learning, portfolio, interview planner/practice, My Day, SkillPath, and user-created opportunities. The four Phase 2 migrations are local-only until separately approved for production.

## Accepted / platform limitations

Supabase leaked-password protection is unavailable on the project's current Free plan. It is not claimed as enabled. Google OAuth remains the current sign-in UI, so this limitation mainly affects any password authentication enabled outside the current application flow.

## Known security/correctness gaps

- The new Storage, application lifecycle, and core-grant migrations are not deployed until separately approved.
- Storage delete authorization is covered through policy metadata in pgTAP because Supabase blocks direct SQL deletion; production rollout still needs a real Storage API owner/cross-owner smoke test.
- Service-role construction and same-origin/body-limit patterns are duplicated.
- Browser direct writes rely on RLS and database constraints; some fields lack strong DB size constraints.
- No application-level rate-limiting service exists; several features use bounded counts/timeouts instead.
- No codebase audit is a guarantee against all vulnerabilities; production configuration must remain part of release review.

Relevant code: `proxy.ts`, `lib/supabase/`, `lib/learning/server.ts`, `app/api/`, `extensions/autofill/`, `supabase/migrations/`, `supabase/tests/`.

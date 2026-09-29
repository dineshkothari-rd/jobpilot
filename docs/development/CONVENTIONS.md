# Engineering conventions

Last verified: 2026-09-27

## TypeScript and naming

- Keep strict TypeScript and narrow `unknown` at trust boundaries.
- Use domain language already present in the product; avoid generic base repositories/services.
- Database fields remain snake_case at the Supabase boundary; application-facing models may use established camelCase.
- Prefer native Web/Node/React/Next.js features and installed dependencies.

## Feature boundaries

- `app/` currently contains substantial feature code, but new work should avoid increasing route coupling.
- Follow `docs/architecture/FEATURE-BOUNDARIES.md` only in approved incremental phases.
- Dashboard, career intelligence and Autopilot consume domains; lower-level domains must not import them.
- Do not introduce `src/`, a DI framework, event bus, generic repository hierarchy, or broad barrel chain without demonstrated need.

## Server/client boundaries

- Treat every client component as public browser code.
- Secrets and service-role clients require server-only modules.
- Authenticate at each API; do not rely on proxy for APIs.
- A service-role query must explicitly enforce ownership/public-sharing intent.
- Return minimal fields needed by the client.

## Validation and errors

- Validate exact keys, types, lengths, URLs, dates, IDs and collection sizes at external boundaries.
- Bound streamed request bytes for potentially large writes.
- Fail closed for trust-sensitive states such as submission, credentials and legal answers.
- Preserve user input on recoverable failures; do not expose internal/database/provider details.

## Imports and shared code

- Reuse existing domain utilities before creating new ones.
- Use `@/` for repository-root imports and relative imports within a tight domain where already established.
- `shared/` is for real multi-feature reuse, not miscellaneous code.

## Tests

- Non-trivial domain branches require the smallest runnable check that would catch regression.
- Security/database changes require SQL assertions where applicable.
- Preserve deterministic tests and avoid real provider/network dependencies.

## Migrations and security

- Follow `MIGRATIONS.md`; applied migrations are immutable.
- RLS is not a replacement for explicit scoping in service-role code.
- Do not log resume/profile/application content, secrets, tokens, or employer answers.
- Prepared, generated, copied and opened are not submitted/sent/verified.

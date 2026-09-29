# Product and architecture roadmap

Last verified: 2026-09-27

This is prioritization, not a promise that every item will ship. P3 is optional product expansion.

## P0 — correctness and trust

- **Implemented locally, pending production approval:** private `resumes` bucket configuration, owner-prefix policies and security tests.
- **Implemented locally, pending production approval:** fail-closed application creation, explicit submission intent, legal transitions and optimistic versions.
- **Implemented locally, pending production approval:** least-privilege grants and SQL isolation coverage for core user-owned tables.
- Future `application_events` history remains deliberately deferred until durable history is a product requirement.

## P1 — architecture and maintainability

- Establish shared authenticated-user and server-only admin-client boundaries.
- Progressively move cohesive domain logic behind feature APIs without a giant refactor.
- Keep privileged service-role ownership assumptions covered at the application layer; service role bypasses RLS by design.
- Add database-enforced primary-resume integrity.
- Reduce duplicated career/Autopilot preference concepts.
- Standardize body bounds, origin checks, errors, and optimistic versions incrementally.

## P2 — UX and operations

- Add consistent route loading/error/empty states.
- Add correlation IDs and privacy-safe structured diagnostics.
- Add browser smoke tests for responsive and accessible core flows.
- Add pagination when current collection ceilings become constraints.

## P3 — optional product expansion

- Verified employer submission providers
- Calendar synchronization and email/reminder delivery
- OCR for image-only resumes
- Reliable external labor-market datasets
- External credential verification
- Resumable background queues at demonstrated scale

P3 requires separate product, privacy, provider, and cost decisions.

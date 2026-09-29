# ADR 003: Keep learning answer keys service-only

**Status:** Accepted
**Last verified:** 2026-09-27

## Context

Learning assessments need answer keys for scoring, but exposing those keys to authenticated browser clients would invalidate assessment results. Catalogue definitions and questions can be readable while scoring material remains privileged.

## Decision

Answer keys remain in service-only storage and are accessed only through trusted server paths using the service role. Browser clients never receive answer keys, service-role credentials or unrestricted catalogue records. Row-level security remains the primary database boundary for user-owned attempts and progress.

## Alternatives considered

- Store keys with browser-readable lesson content. Rejected because network inspection would reveal answers.
- Obfuscate keys in client code. Rejected because obfuscation is not an authorization boundary.
- Score entirely in the browser. Rejected because the client controls both the submitted answer and scoring logic.

## Consequences

- Assessment scoring requires a trusted server path.
- Service-role use must stay narrow and never accept ownership claims from the request without verification.
- Database advisor output may report intentional service-only access as informational; the documented boundary and denial tests determine whether it is acceptable.

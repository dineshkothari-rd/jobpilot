# ADR 002: Preserve deterministic AI fallbacks

**Status:** Accepted
**Last verified:** 2026-09-27

## Context

AI-assisted features need useful output when no model key is configured, a provider is unavailable or a response is malformed. Core job-search workflows should not become unavailable because an optional generation service fails.

## Decision

AI modules keep deterministic, locally generated fallbacks. Provider output is treated as untrusted input and accepted only after feature-specific validation. Failure falls back to predictable output rather than exposing provider errors or leaving the interface unusable.

## Alternatives considered

- Require a configured model for every AI surface. Rejected because it couples core product availability to an optional service.
- Return raw provider output. Rejected because shape, content and safety are not guaranteed.
- Hide AI features when generation fails. Rejected where an existing deterministic result can still help the user.

## Consequences

- Local development and tests remain useful without paid AI access.
- Users receive degraded but coherent output during provider failures.
- Each generated feature must maintain validation and a fallback alongside its prompt.
- Fallback quality is intentionally bounded; it is not presented as equivalent to model-generated personalization.

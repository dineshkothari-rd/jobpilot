# Learning flow

Last verified: 2026-09-27

## Entry condition

An authenticated user opens `/learn`, optionally from a detected skill gap, practice retry, or career recommendation.

## Steps

1. `GET /api/learn` returns the authenticated-readable catalog plus private goals, enrollments, attempts, and credentials.
2. The user chooses a path and opens `/learn/[path]`.
3. The user reads original JobPilot lessons, follows optional external resources, stores notes/bookmarks, and self-confirms exercises.
4. A project summary/evidence URL is saved.
5. `POST /api/learn` reads the service-role-only answer key and grades the fixed three-question assessment.
6. After eligibility, the user explicitly requests a private JobPilot completion record.
7. The user may print/download it, enable a public record with a chosen name, stop sharing, or revoke it.

Database effects: `learning_goals`, catalog/keys, `skillpath_enrollments`, `skillpath_attempts`, and `skillpath_credentials`.

Security: owner reads, server-only writes for scored/credential state, answer-key privileges revoked from browser roles, bounded/versioned progress, request IDs/unique constraints, escaped certificate HTML and restrictive CSP.

Failure states: unavailable service key/storage, invalid/stale progress, incomplete requirements, failed assessment, unavailable external resource/video, or revoked/private record.

Exit condition: progress is saved or a JobPilot completion record is issued. It is explicitly not accredited, identity-verified, independently assessed, or issued by an external resource provider.

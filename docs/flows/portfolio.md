# Portfolio and evidence flow

Last verified: 2026-09-27

## Entry condition

An authenticated user opens `/portfolio` or chooses to add a saved Learning Studio project as evidence.

## Steps

1. `GET /api/portfolio` loads up to 100 latest owner records.
2. User adds manual evidence describing a real problem, personal contribution, outcome, skills and optional HTTPS evidence URL; or imports a learning project with a sufficiently detailed saved contribution.
3. User edits the record; edits clear previous review status.
4. User explicitly marks evidence reviewed.
5. User may copy a grounded resume-ready draft or delete the record.

Database effects: CRUD on `portfolio_evidence`; learning import reads `skillpath_enrollments` and catalog data.

Security: authentication, RLS and explicit user filters, strict 32 KB request cap, bounded fields/URLs/skills, unique learning source, optimistic version on edit/review/delete, and same-origin write check.

Failure states: missing/short learning contribution, duplicate learning source, invalid URL/fields, stale tab, or unavailable storage.

Exit condition: evidence remains private and unreviewed/reviewed, is copied as a suggestion, or is deleted. Generated wording does not create experience; it summarizes user-recorded evidence.

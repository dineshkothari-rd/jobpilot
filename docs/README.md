# JobPilot documentation

Last verified: 2026-09-27

This directory is the detailed source of truth for current JobPilot behavior. The root README is the concise entry point. Documents marked historical explain individual deliveries and must not override the current product, architecture, API, database, or security references.

## Product

- [Product scope and trust model](product/README.md) — authoritative
- [Feature inventory](product/FEATURES.md) — authoritative
- [Prioritized roadmap](product/ROADMAP.md) — authoritative planning; P3 is optional

## Architecture

- [System architecture](architecture/README.md) — authoritative
- [Feature boundaries](architecture/FEATURE-BOUNDARIES.md) — approved direction, not implemented structure
- [Directory structure](architecture/DIRECTORY-STRUCTURE.md) — current structure and target direction

## API, database, security, and AI

- [API inventory](api/README.md)
- [Database architecture](database/README.md)
- [Security model](security/README.md)
- [AI and deterministic behavior](ai/README.md)

## User flows

- [Authentication](flows/authentication.md)
- [Onboarding](flows/onboarding.md)
- [Resume](flows/resume.md)
- [Job discovery](flows/job-discovery.md)
- [Application](flows/application.md)
- [Autopilot](flows/autopilot.md)
- [Interview](flows/interview.md)
- [Learning](flows/learning.md)
- [Portfolio](flows/portfolio.md)
- [My Day](flows/my-day.md)

## Development

- [Local setup](development/SETUP.md)
- [Environment variables](development/ENVIRONMENT.md)
- [Testing and quality gates](development/TESTING.md)
- [Migration workflow](development/MIGRATIONS.md)
- [Engineering conventions](development/CONVENTIONS.md)
- [Troubleshooting](development/TROUBLESHOOTING.md)
- [Deployment](../DEPLOYMENT.md)

## Architecture decision records

- [ADR 001: Human-in-the-loop applications](adr/001-human-in-the-loop-applications.md)
- [ADR 002: Deterministic AI fallback](adr/002-deterministic-ai-fallback.md)
- [ADR 003: Learning answer-key security](adr/003-learning-answer-key-security.md)
- [ADR 004: Background Autopilot](adr/004-background-autopilot.md)

## Correctness designs implemented locally

These designs are implemented and verified in the local Phase 2 baseline. Their migrations remain pending separate production deployment approval.

- [Resume Storage reproducibility](design/resume-storage-reproducibility.md)
- [Application lifecycle](design/application-lifecycle.md)

## Existing-document classification

These files remain useful, but release-specific counts, filenames, or security observations may be superseded by the authoritative references above.

| Document | Classification | How to use it |
| --- | --- | --- |
| [Deployment](../DEPLOYMENT.md) | Authoritative | Current production checklist; environment and migration detail is integrated with the development references. |
| [Assisted applications](assisted-applications.md) | Historical; needs integration | Delivery evidence. Resolve current behavior through the application flow and ADR 001. |
| [Interview Practice](interview-practice.md) | Historical | Delivery evidence. Older security notices are superseded by the current security baseline. |
| [SkillPath](skillpath.md) | Historical | Delivery evidence. Read migration timestamps alongside the current migration directory. |
| [Original product roadmap](product-roadmap.md) | Superseded | Retained planning context; `product/ROADMAP.md` is authoritative. |
| [UX audit](ux-audit.md) | Historical | Point-in-time evidence, not a current accessibility certification. |

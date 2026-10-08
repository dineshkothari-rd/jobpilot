# Product scope

Last reconciled: 2026-10-08 (source and automated checks; external acceptance is separate)

Status: authoritative current product definition.

## Vision

JobPilot is a human-in-the-loop Career Operating System. It organizes reliable career work around user facts, explicit decisions, explainable automation, and next actions rather than maximizing feature count.

## Target user

A job seeker who wants one private workspace for profile, resume, opportunities, applications, interviews, learning, and evidence while retaining control over external submissions and sensitive answers.

## Problems addressed

- Career information is fragmented across resumes, job boards, notes, and reminders.
- Match scores and AI suggestions often hide their assumptions.
- Application automation can overclaim submission or invent answers.
- Interview preparation and learning are often disconnected from real jobs and evidence.
- Users need a clear next action rather than another undifferentiated dashboard.

## Career lifecycle

Profile → Career Goal → Resume → Career Intelligence → Job Discovery → Matching → Save/Evaluate → Application Preparation → Human-reviewed Submission → Tracking → Follow-up → Interview → Practice → Learning → Evidence → Improved Career Profile → Next Action

## Trust model

- **User/account/profile fact:** entered or supplied by the authenticated user.
- **Resume/evidence fact:** extracted from or explicitly recorded in user-owned material.
- **Database-derived state:** an application, preference, plan, or completion stored by JobPilot.
- **Suggestion:** deterministic or AI-assisted guidance that requires review.

JobPilot must not invent candidate experience, skills, employer activity, market demand, interview results, or third-party credentials.

## Human-in-the-loop philosophy

Preparation is automation; external action is not. JobPilot can discover, rank, draft, copy, autofill reviewed contacts, and schedule follow-up. The user verifies employer context, legal answers, uploaded documents, consent, and final submission. A prepared package is never proof of submission.

## Scope boundaries

### Implemented

Google sign-in, profile/preferences, resume and ATS tooling, jobs and matching, application preparation/tracking, Autopilot preparation, interviews, practice, learning, portfolio evidence, My Day, and optional AI/resource providers.

### Partial

Authentication methods, application lifecycle history, notification delivery, market intelligence, observability, and browser E2E/accessibility verification. Resume Storage and application lifecycle migrations are deployed. Current provider-dependent gaps are tracked in PRODUCTION-PROGRESS.md.

### Planned

Incremental feature boundaries, consistent server data access, production rollout of the reviewed P0 Storage/application migrations, and stronger production diagnostics.

### Decision required

Employer submission integrations, application-event retention model, calendar synchronization, OCR, and external credential verification.

### Out of scope

Silent form submission, inferred sensitive/legal answers, fabricated facts, fake market statistics, and presenting JobPilot records as accredited third-party certificates.

Relevant code: `app/`, `lib/`, `extensions/autofill/`, `supabase/migrations/`.

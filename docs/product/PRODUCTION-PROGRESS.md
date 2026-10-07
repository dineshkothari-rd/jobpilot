# Production feature progress

Checkpoint: 2026-10-07. Original backlog: 41 features.

**30 Complete · 4 Partial · 7 Not picked**

Complete = scoped implementation and relevant database deployment ready. This does not certify production delivery, all real signed-in journeys, legal compliance or public launch. Older dated deployment blockers in the backlog are superseded by this checkpoint.

| # | Feature name | Status | Remaining scope / limit |
|---|---|---|---|
| 1 | Job aggregation from multiple sources | Complete | Real-user production acceptance remains a launch gate. |
| 2 | India-focused job coverage | Complete | Real-user production acceptance remains a launch gate. |
| 3 | Employer and recruiter registration | Complete | Real-user production acceptance remains a launch gate. |
| 4 | Company verification | Complete | Real-user production acceptance remains a launch gate. |
| 5 | Recruiter dashboard | Complete | Real-user production acceptance remains a launch gate. |
| 6 | Direct job posting | Complete | Real-user production acceptance remains a launch gate. |
| 7 | Searchable candidate and resume database | Complete | Real-user production acceptance remains a launch gate. |
| 8 | Recruiter shortlisting | Complete | Real-user production acceptance remains a launch gate. |
| 9 | Recruiter–candidate messaging | Complete | Real-user production acceptance remains a launch gate. |
| 10 | Recruiter-issued interview invitations | Complete | Real-user production acceptance remains a launch gate. |
| 11 | Human-confirmed applications within JobPilot | Complete | Real-user production acceptance remains a launch gate. |
| 12 | Employer-side application management | Complete | Real-user production acceptance remains a launch gate. |
| 13 | Recruiter-confirmed application status updates | Complete | Real-user production acceptance remains a launch gate. |
| 14 | Profile-view and resume-view notifications | Complete | Profile/resume preview notices; no separate new resume-download feature. |
| 15 | Saved job searches | Complete | Real-user production acceptance remains a launch gate. |
| 16 | Personalized email and push job alerts | Partial | Email sender/browser push activation and real delivery pending. |
| 17 | Advanced job filters: experience, industry, salary, posting date, and hybrid work | Complete | Real-user production acceptance remains a launch gate. |
| 18 | Company profiles and company-specific job listings | Complete | Real-user production acceptance remains a launch gate. |
| 19 | Company following and new-opening alerts | Complete | Real-user production acceptance remains a launch gate. |
| 20 | Employee reviews and company ratings | Complete | Real-user production acceptance remains a launch gate. |
| 21 | Source-backed salary benchmarking by role, location, and experience | Complete | Real-user production acceptance remains a launch gate. |
| 22 | Equity and ESOP compensation details | Complete | Real-user production acceptance remains a launch gate. |
| 23 | Dedicated internships and fresher jobs section | Complete | Real-user production acceptance remains a launch gate. |
| 24 | Internship duration, stipend, and availability filters | Complete | Real-user production acceptance remains a launch gate. |
| 25 | Recruiter-visible candidate profiles with privacy controls | Complete | Real-user production acceptance remains a launch gate. |
| 26 | Featured candidates and paid profile visibility | Not picked | Scheduled after the first free launch. |
| 27 | Employer branding pages | Complete | Cover palettes; no uploaded cover photos. Currently signed-in pages; public acquisition/SEO is Phase 5. |
| 28 | Paid recruiter job-posting packages | Not picked | Scheduled after the first free launch. |
| 29 | Paid candidate-database access | Not picked | Scheduled after the first free launch. |
| 30 | Free and paid subscription plans | Not picked | Scheduled after the first free launch. |
| 31 | Payment checkout and subscription management | Not picked | Scheduled after the first free launch. |
| 32 | Billing history and invoices | Not picked | Scheduled after the first free launch. |
| 33 | Plan-based feature access and usage limits | Not picked | Scheduled after the first free launch. |
| 34 | Email and push reminders for interviews and follow-ups | Partial | Verified email sender, browser push configuration and real reminder delivery pending. |
| 35 | Two-way Google Calendar and Outlook Calendar synchronization | Partial | Google/Outlook OAuth setup and real-provider round-trip acceptance pending. |
| 36 | Email/password or alternative sign-in | Complete | Real-user production acceptance remains a launch gate. |
| 37 | Job scam reporting and moderation | Complete | Real-user production acceptance remains a launch gate. |
| 38 | Admin dashboard | Partial | Admin queues, metrics and account review cases complete; account suspension and role management not implemented. |
| 39 | Help centre and customer support | Complete | Real-user production acceptance remains a launch gate. |
| 40 | Account deletion and personal-data export | Complete | Real-user production acceptance remains a launch gate. |
| 41 | Detailed application activity history | Complete | Real-user production acceptance remains a launch gate. |

## This batch: launch Phases 3–4

- Complete: #7 searchable talent/resume database, #8 recruiter shortlisting, #9 recruiter–candidate messaging, #10 interview invitations, #14 profile/resume-view notifications, #27 employer branding.
- Partial: #38 admin dashboard; operational queues/counts/account reviews are delivered, enforcement controls remain.
- Extra: JobPilot logo, multi-size favicon, app icon and Apple touch icon.

## Database synchronization

Applied earlier pending migrations: `20261005165535_job_alerts.sql`, `20261005165631_recruiter_platform.sql`, `20261006100522_hiring_applications_privacy.sql`. Applied this batch: `20261007022411_recruiter_discovery_communications.sql`, `20261007022625_employer_branding_admin_operations.sql`. Migration history and RLS/service-only permissions verified after deployment; no test fixtures inserted into production.

## Income-ready production gates

Charging customers is not ready: the seven monetization features above have not been implemented. The agreed first launch remains free, without a new paid API or infrastructure dependency.

- Launch Phase 5 not started: public job/company acquisition pages, indexing/structured data, landing content, legal/support launch readiness.
- Launch Phase 6 not started: actual candidate/recruiter/admin pilot, accessibility/security release checks, backup/recovery and error visibility, free-tier quota review.
- Existing provider-dependent partial features require configuration and delivery acceptance. A Gmail address alone is not a verified sending domain.
- Existing runtime dependency audit was clean in the preceding batch; five development-only dependency findings remain recorded in the Phase 1–2 report.

## Validation and handoff

201 Node tests, 20 SQL security files, lint and webpack production build pass. Isolated full migration reconstruction passes. Browser-only local fixtures cover sourcing note save, candidate message/accept/block, recruiter invitation creation, branding publication and admin account review. Mobile inbox overflow was fixed and checked at 390px; employer page fits at that width. Unsigned real GET APIs return 401; all four icon/logo assets return 200. Local fixture removed before build and commit. Real authenticated realtime/provider delivery is not certified by these fixtures.

Stop after commit/push for user review before launch Phases 5–6.

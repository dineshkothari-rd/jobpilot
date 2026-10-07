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
| 27 | Employer branding pages | Complete | Cover palettes; no uploaded cover photos. Published verified pages are now publicly readable with canonical metadata; real employer pilot pending. |
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

## This batch: launch Phases 5–6

These phases extend launch readiness around existing backlog features; they do not add new entries to the original 41 or inflate its completion counts.

| Feature / launch capability | Status | Remaining work |
|---|---|---|
| Public job discovery: title/location search and pagination | Complete | Live deployment smoke; real user acceptance |
| Public job details and source/application links | Complete | Live deployment smoke; ongoing source availability |
| Public verified employer branding pages | Complete | Real verified employer pilot |
| Canonical metadata, source-aware robots/sitemap and eligible direct JobPosting markup | Complete | Search Console/rich-result verification; no Google Jobs submission for source feeds |
| Candidate/employer landing and free-launch messaging | Complete | Real acquisition feedback |
| Privacy/Terms and public support contact | Partial | Published product notices; legal/jurisdiction/entity review and support inbox test pending |
| Safe error references and security headers | Complete | Hosting logs retained; no central alerting service added |
| Read-only launch smoke checker | Complete | Local production passes; run after deployment |
| Manual private backup/checksum tool and recovery guide | Partial | Tool tested; actual production backup/off-site copy/isolated restore not done |
| Production pilot and full accessibility verification | Partial | Public mobile flows checked; real candidate/recruiter/admin and provider journeys pending |
| Free-tier usage/commercial-hosting readiness | Partial | Hobby plan verified; current usage review and compliant commercial hosting decision pending |

Business/service name: **JobPilot**. Owner-authorized public support: **dineshkothari2021@gmail.com**. See [Phase 5–6 handoff](../development/LAUNCH-PHASES-5-6.md) and [operations/pilot runbook](../development/LAUNCH-OPERATIONS.md).

## Database synchronization

Applied earlier pending migrations: `20261005165535_job_alerts.sql`, `20261005165631_recruiter_platform.sql`, `20261006100522_hiring_applications_privacy.sql`. Applied this batch: `20261007022411_recruiter_discovery_communications.sql`, `20261007022625_employer_branding_admin_operations.sql`. Phase 5 migration `20261007025737_public_launch_discovery.sql` also applied. Migration history and RLS/service-only permissions verified after deployment; no test fixtures inserted into production. Public projection verification found zero private/expired leaks (92 active listings at the read-only checkpoint).

## Income-ready production gates

Charging customers is not ready: the seven monetization features above have not been implemented. The agreed first launch remains free, without a new paid API or infrastructure dependency.

- Launch Phase 5 implementation delivered: public job/employer pages, source-aware metadata, landing and factual legal/support notices. Source licences/indexing restrictions and final legal adequacy remain release checks.
- Launch Phase 6 Partial: error visibility, security headers, read-only smoke checks, backup tooling and operator runbook delivered. Actual candidate/recruiter/admin pilot, full accessibility, provider delivery and backup/restore remain pending.
- Existing hosting is Vercel Hobby, which restricts commercial use. Choose compliant hosting before revenue operation; no paid upgrade was enabled. [Vercel policy](https://vercel.com/docs/plans/hobby).
- Existing provider-dependent partial features require configuration and delivery acceptance. A Gmail address alone is not a verified sending domain.
- Existing runtime dependency audit was clean in the preceding batch; five development-only dependency findings remain recorded in the Phase 1–2 report.

## Validation and handoff

206 Node tests, 21 SQL security files, full lint, TypeScript-inclusive webpack production build and isolated complete migration reconstruction pass. Local security advisors report no WARN issues; current runtime dependency audit has zero findings. Manual backup safety/permissions contract test passes; this is not an actual production dump/restore certification.

Local production runtime uses a working existing server credential and passes 13 public/protected-route smoke checks. Actual public browser journey validates search, source job detail, external apply link, private match/save login return, canonical domain and 390px layout. Source jobs have no JobPosting markup, noindex metadata and are excluded from the direct-job sitemap. No paid provider was enabled. After the initial deployed public-page smoke failed, the existing production server credential variable was corrected using a verified existing credential; no project keys were rotated/revoked. Real authenticated realtime/provider delivery and human pilot are not certified by these checks.

Implementation `7829824` is pushed and deployed. A follow-up deployment must activate the corrected existing server variable and pass live smoke before handoff. Then stop for review. Revenue readiness remains blocked by the seven unpicked monetization features and the release gates above.

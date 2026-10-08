# Production feature progress

Checkpoint: 2026-10-08. Original backlog: 41 features.

**32 Complete · 9 Partial · 0 Not picked**

Latest income-launch batch: resume editing/save status, application preparation journey and recruiter task navigation refined; native Netlify deployment settings and an owner-action/first-customer revenue plan added. Merchant onboarding, real provider acceptance, destination hosting/runtime/schedules and signed-in pilots remain open. No provider spend or live charging activated.

Whole-app layout revision: compact dark sidebar, open page headings, warm canvas, custom CSS perspective graphics, resume/hiring section shortcuts and two-column inbox delivered. The 38 production pages plus one development-only preview are source-inventoried; browser acceptance is bounded as documented in [UI assessment](../ux-audit.md). This does not remove the nine provider/activation gates.

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
| 16 | Personalized email and push job alerts | Partial | Browser push keys configured; confirmed-device delivery and verified email sender/API remain pending. |
| 17 | Advanced job filters: experience, industry, salary, posting date, and hybrid work | Complete | Real-user production acceptance remains a launch gate. |
| 18 | Company profiles and company-specific job listings | Complete | Real-user production acceptance remains a launch gate. |
| 19 | Company following and new-opening alerts | Complete | Real-user production acceptance remains a launch gate. |
| 20 | Employee reviews and company ratings | Complete | Real-user production acceptance remains a launch gate. |
| 21 | Source-backed salary benchmarking by role, location, and experience | Complete | Real-user production acceptance remains a launch gate. |
| 22 | Equity and ESOP compensation details | Complete | Real-user production acceptance remains a launch gate. |
| 23 | Dedicated internships and fresher jobs section | Complete | Real-user production acceptance remains a launch gate. |
| 24 | Internship duration, stipend, and availability filters | Complete | Real-user production acceptance remains a launch gate. |
| 25 | Recruiter-visible candidate profiles with privacy controls | Complete | Real-user production acceptance remains a launch gate. |
| 26 | Featured candidates and paid profile visibility | Partial | Featured consent, labelled Pro priority and expiry implemented; paid Pro/provider activation and real pilot pending. |
| 27 | Employer branding pages | Complete | Cover palettes; no uploaded cover photos. Published verified pages are now publicly readable with canonical metadata; real employer pilot pending. |
| 28 | Paid recruiter job-posting packages | Partial | Posting products, atomic first-publication credits and refund reversal implemented; real-provider acceptance and paid activation pending. |
| 29 | Paid candidate-database access | Partial | Plan-gated discovery/profile/contact implemented; paid activation gate stays off and real paid-plan pilot pending. |
| 30 | Free and paid subscription plans | Partial | Complimentary tiers plus priced subscription/paid-period entitlement foundation implemented; actual paid provider acceptance inactive. |
| 31 | Payment checkout and subscription management | Partial | Test/live hosted checkout, signed canonical verification, owner-bound ambiguity recovery, immediate/cycle-end cancellation and dispute holds implemented; merchant configuration, real-provider acceptance and commercial-host deployment pending. |
| 32 | Billing history and invoices | Partial | Private billing history, receipt PDF and provider invoice links implemented; merchant/tax invoice issuance and actual provider acceptance pending. |
| 33 | Plan-based feature access and usage limits | Complete | Complimentary and live-mode effective entitlements, expiry/fallback, atomic usage/posting limits and refund-aware posting credits enforced; real pilot pending. |
| 34 | Email and push reminders for interviews and follow-ups | Partial | Browser push configured; actual consented-device receipt and verified email sender/API remain pending. |
| 35 | Two-way Google Calendar and Outlook Calendar synchronization | Partial | Google/Outlook OAuth setup and real-provider round-trip acceptance pending. |
| 36 | Email/password or alternative sign-in | Complete | Real-user production acceptance remains a launch gate. |
| 37 | Job scam reporting and moderation | Complete | Real-user production acceptance remains a launch gate. |
| 38 | Admin dashboard | Complete | Audited roles, native suspension/restore, session revocation and fresh access checks delivered; real admin pilot remains a launch gate. |
| 39 | Help centre and customer support | Complete | Real-user production acceptance remains a launch gate. |
| 40 | Account deletion and personal-data export | Complete | Real-user production acceptance remains a launch gate. |
| 41 | Detailed application activity history | Complete | Real-user production acceptance remains a launch gate. |

## Latest completion batch

All nine partial items have implemented code paths. They remain **Partial for production activation** because provider credentials/consent and genuine delivery are not available; 32 Complete / 9 Partial / 0 Not picked is deliberately unchanged. Do not count a mocked payment or email as completed production delivery.

- Billing recovery, disputes/chargebacks, test/live mode activation, immediate cancellation and subscription-safe account deletion delivered. New migration applied to production and browser write/RPC denials verified.
- Public subscription/package prices and customer-paid wording corrected. Free launch means zero operator provider-subscription spend, not permanently free customer plans. No paid provider purchase made.
- Email activation separated from paid AI with `EMAIL_DELIVERY_ENABLED`; free allowance can be enabled after sender setup without enabling paid AI.
- Landing redesigned with interactive three-step 2D preview, bounded motion/depth, correct resume-login return, pricing navigation and human-confirmed application reassurance. Desktop/mobile and reduced-motion behavior checked. Overall signed-in UX remains a real-user pilot gate.
- Documentation reconciled with source: every route handler, migration table creation, environment setting, automated test and all 41 backlog items have an indexed reference. Detailed module guides retain honest external/runtime limitations.

Validation: 229 Node tests and 28 SQL security files passed for the billing batch; later 39 targeted notification/billing/account checks passed after the email activation change. Full lint passed. Production migration `20261008004447` present; dispute RLS true, browser mutation privileges false, subscription deletion guard present, paid gate false and no checkout/dispute test rows. Final UI-inclusive build/deployment evidence is recorded after execution.

Revenue activation is not certified: gateway merchant/KYC/settlement/plans, compliant zero-cost commercial hosting, real checkout/renewal/refund/dispute receipt and merchant invoice adequacy remain pending. Existing Vercel Hobby cannot be used commercially. Email sender, actual consented push receipt and Google/Outlook OAuth round trips remain pending. Production backup/off-device restore, legal review and signed-in candidate/recruiter/admin pilot remain broader launch gates.

See [Revenue operation](../development/REVENUE-FOUNDATION.md), [UI assessment](../ux-audit.md), [complete implementation reference](../IMPLEMENTATION-REFERENCE.md) and [deployment](../../DEPLOYMENT.md).

## Historical delivery chronology

> Everything below records older batches. Counts, test-only restrictions, free-customer messaging and dated blockers are superseded by the latest checkpoint above.

## This batch: launch Phases 5–6

These phases extend launch readiness around existing backlog features; they do not add new entries to the original 41 or inflate its completion counts.

| Feature / launch capability | Status | Remaining work |
|---|---|---|
| Public job discovery: title/location search and pagination | Complete | Live smoke passed; real user acceptance |
| Public job details and source/application links | Complete | Live smoke passed; ongoing source availability |
| Public verified employer branding pages | Complete | Real verified employer pilot |
| Canonical metadata, source-aware robots/sitemap and eligible direct JobPosting markup | Complete | Search Console/rich-result verification; no Google Jobs submission for source feeds |
| Candidate/employer landing and free-launch messaging | Complete | Real acquisition feedback |
| Privacy/Terms and public support contact | Partial | Published product notices; legal/jurisdiction/entity review and support inbox test pending |
| Safe error references and security headers | Complete | Hosting logs retained; no central alerting service added |
| Read-only launch smoke checker | Complete | Local and live production: 13 checks pass |
| Manual private backup/checksum tool and recovery guide | Partial | Tool tested; actual production backup/off-site copy/isolated restore not done |
| Production pilot and full accessibility verification | Partial | Public mobile flows checked; real candidate/recruiter/admin and provider journeys pending |
| Free-tier usage/commercial-hosting readiness | Partial | Hobby plan verified; current usage review and compliant commercial hosting decision pending |

Business/service name: **JobPilot**. Owner-authorized public support: **dineshkothari2021@gmail.com**. See [Phase 5–6 handoff](../development/LAUNCH-PHASES-5-6.md) and [operations/pilot runbook](../development/LAUNCH-OPERATIONS.md).

## Database synchronization

Applied earlier pending migrations: `20261005165535_job_alerts.sql`, `20261005165631_recruiter_platform.sql`, `20261006100522_hiring_applications_privacy.sql`. Applied this batch: `20261007022411_recruiter_discovery_communications.sql`, `20261007022625_employer_branding_admin_operations.sql`. Phase 5 migration `20261007025737_public_launch_discovery.sql` also applied. Migration history and RLS/service-only permissions verified after deployment; no test fixtures inserted into production. Public projection verification found zero private/expired leaks (92 active listings at the read-only checkpoint).

## Income-ready production gates

Charging customers is not ready: all five formerly unpicked monetization features now have code foundations, but test-provider/merchant/invoice/dispute acceptance remains pending. Live collection is blocked in code. The agreed first launch remains free, without a new paid API or infrastructure dependency.

- Launch Phase 5 implementation delivered: public job/employer pages, source-aware metadata, landing and factual legal/support notices. Source licences/indexing restrictions and final legal adequacy remain release checks.
- Launch Phase 6 Partial: error visibility, security headers, read-only smoke checks, backup tooling and operator runbook delivered. Actual candidate/recruiter/admin pilot, full accessibility, provider delivery and backup/restore remain pending.
- Existing hosting is Vercel Hobby, which restricts commercial use. Choose compliant hosting before revenue operation; no paid upgrade was enabled. [Vercel policy](https://vercel.com/docs/plans/hobby).
- Existing provider-dependent partial features require configuration and delivery acceptance. A Gmail address alone is not a verified sending domain.
- Existing runtime dependency audit was clean in the preceding batch; five development-only dependency findings remain recorded in the Phase 1–2 report.

## Validation and handoff

207 Node tests, 21 SQL security files, full lint, TypeScript-inclusive webpack production build and isolated complete migration reconstruction pass. Local security advisors report no WARN issues; current runtime dependency audit has zero findings. Manual backup safety/permissions contract test passes; this is not an actual production dump/restore certification.

Local production runtime uses a working existing server credential and passes 13 public/protected-route smoke checks. Actual public browser journey validates search, source job detail, external apply link, private match/save login return, canonical domain and 390px layout. Source jobs have no JobPosting markup, noindex metadata and are excluded from the direct-job sitemap. No paid provider was enabled. After the initial deployed public-page smoke failed, the existing production server credential variable was corrected using a verified existing credential; no project keys were rotated/revoked. Real authenticated realtime/provider delivery and human pilot are not certified by these checks.

Implementation `7829824`, follow-up `48650df` and runtime correction `c330d03` are pushed. The corrected implementation deployed successfully and all 13 live public/protected-route checks pass. Live browser verification confirms 24 public search results, actual job detail, source application links, private sign-in return, canonical links, source noindex/follow and 390px layout without overflow.

The initial public 500 remained after correcting the existing server credential. Hosting logs identified the actual cause: the isomorphic-dompurify server DOM dependency failed to load on the hosting runtime. Public descriptions now render plain extracted text through React; private rich descriptions retain DOMPurify sanitization directly in the browser. Removed the unnecessary server DOM dependency. Final 207 tests, lint, webpack production build/TypeScript and zero-finding production dependency audit pass. Local Turbopack worker-port permissions prevented that local build; the automatic hosting deployment succeeds.

Prior checkpoint: paid monetization and release gates remained pending; see the newest batch below.


## This batch: launch Phases 7–10

Original 41-feature count remains **30 Complete / 4 Partial / 7 Not picked**. These phases add free-launch operational capabilities; they do not complete paid plans/payment/access features.

| Phase | Feature name | Implementation | Remaining acceptance |
|---|---|---|---|
| 7 | Admin launch-readiness dashboard | Complete | Real admin pilot; provider setup/delivery and release checks remain pending |
| 8 | Daily worker monitoring, overlap protection and bounded run history | Complete | Observe actual scheduled production execution; external proactive alerts not implemented |
| 9 | Candidate alert/reminder delivery history | Complete | Actual email/push delivery remains Partial; provider acceptance is not receipt |
| 10 | Automatic backup integrity checks and read-only recovery snapshot | Complete | Production backup/off-device copy/isolated restore remains Partial |

212 Node tests, 22 SQL security files, lint and final webpack/TypeScript build pass. Mobile component/refresh/state checks pass with local-only fixtures removed. Six pre-existing database performance init-plan warnings remain; no new monitoring security warnings. No paid provider, cloud project or runtime dependency was added. Database migration `20261007073217_launch_operations_runs.sql` deployed after exact dry run and isolated reconstruction. Final production history/grant and deployment checks are recorded in the [Phase 7–10 handoff](../development/LAUNCH-PHASES-7-10.md).


Phase 7–10 implementation `efc9dc8` is pushed and deployed successfully. All 15 live read-only checks pass, including authentication protection on admin readiness and candidate delivery history. Production migration/RLS/grants verified; no production test records or notification sends. Actual scheduled execution and authenticated real-user/provider/recovery acceptance remain pending. Stop for review.


## This batch: launch Phases 11–14

**30 Complete / 6 Partial / 5 Not picked** in the original 41-feature inventory. Free-plan foundations move features 30 and 33 to Partial; role management reduces feature 38's remaining scope to account suspension.

| Phase | Feature name | Implementation | Remaining acceptance |
|---|---|---|---|
| 11 | Public ₹0 launch plan and transparent allowances | Complete | Real-user acceptance; paid tiers intentionally absent |
| 12 | Server-enforced free daily usage limits and posting cap | Complete | Real scheduled/user acceptance; paid entitlements absent |
| 13 | Owner-private usage/remaining/reset dashboard | Complete | Real authenticated candidate/recruiter pilot |
| 14 | Audited admin-role changes and fresh database role permissions | Complete | Real two-admin pilot; suspension remains pending |

Allowances: 5 Autopilot attempts, 50 candidate search page requests, 100 interview AI actions per UTC day, and 100 nonclosed postings per recruiter company. Daily reset: 00:00 UTC / 05:30 IST. Admitted failed attempts count; manual/scheduled Autopilot share one counter. Interview allowance is not a universal AI credit system. Existing safety caps remain. Usage is owner-exportable and cascades on account deletion.

Both migrations `20261007080231_free_launch_allowances.sql` and `20261007080241_admin_role_controls.sql` are synchronized to production. Read-only verification confirms all four policies, both migration records, browser write/consume RPC denial and zero stale JWT admin policies. No production accounts had roles changed and no synthetic usage was inserted.

Validation: 216 Node tests, 24 SQL security files, lint, TypeScript-inclusive production build and isolated migration reconstruction. Local database advisors report no issues. Public plan page and 390px usage/role components checked; private checks used local-only fixtures, restored before the final build. Production signed-in journeys remain pending. Deployment results are recorded in [Phase 11–14 handoff](../development/LAUNCH-PHASES-11-14.md).

Partial features: **16** personalized email/push alerts, **30** free/paid plans, **33** plan-based access/usage, **34** reminders, **35** calendar synchronization, **38** admin dashboard (suspension).
Not picked: **26** paid profile visibility, **28** paid posting packages, **29** paid candidate database access, **31** checkout/subscription management, **32** invoices/billing history.

Income-ready production remains pending payment/billing/paid-entitlement implementation, actual provider delivery, real candidate/recruiter/admin pilot, production backup/restore, legal/entity review and compliant commercial hosting. No paid service or upgrade enabled. Stop for review after this four-phase batch.

Implementation `027424a` is committed, pushed and deployed successfully. All 18 live read-only public/protected-route checks pass. Live `/plans` renders all allowances with the production canonical URL and no overflow at 390px. Local validation database stopped with data retained; temporary browser fixtures removed. Real authenticated role/usage/provider and recovery acceptance remain pending.


## Partial-feature closeout batch

Current original scope: **32 Complete / 4 Partial / 5 Not picked**. Two of the six partial features closed in implementation: #33 plan-based access/usage and #38 admin dashboard. Four remain honestly Partial; no external delivery or paid subscription was fabricated.

| Feature | This batch delivered | Remaining blocker |
|---|---|---|
| 16 Personalized email/push job alerts | Production VAPID setup for no-cost push; suspended recipients skipped | Email API/verified sender absent; real user browser consent/receipt unverified |
| 30 Free/paid plans | Candidate Pro, Recruiter Starter/Growth/Enterprise complimentary catalog; audited 1–90 day assignments | Paid pricing/subscriptions inactive; first launch stays ₹0 |
| 33 Plan-based access/usage | Effective tier quotas, automatic expiry/fallback, retained usage across tier changes, per-tier posting caps, private dashboard/export | Complete in scoped implementation; real pilot pending, no purchased-credit billing |
| 34 Email/push reminders | No-cost push configured; suspended accounts cannot claim delivery | Same sender/API and real device receipt gaps as #16 |
| 35 Google/Outlook calendar sync | Existing encrypted OAuth, conditional send/import and conflict handling retained; suspended connection claims blocked | Production Google/Outlook client credentials absent; real consent/round-trip pending |
| 38 Admin dashboard | Reasoned suspension/restore, audit, stale-state conflict checks, self/admin protection, refresh-session revocation | Complete in scoped implementation; real two-admin pilot pending |

Suspension uses native Auth bans and restrictive fresh-account policies on private tables/Storage; shared server authentication also checks current access. Existing public anonymous pages remain public. Refresh-session deletion alone is not trusted to invalidate JWTs. No production account was suspended, upgraded or granted a plan in testing.

Production migrations `20261007083145_account_suspension_controls.sql` and `20261007083436_plan_entitlement_controls.sql` synchronized. Read-only verification: both migration records, four tiers, browser mutation RPCs denied, 54 restrictive policies and zero account suspension/plan assignment events. VAPID keys added as production secrets; temporary key files removed. No paid provider flag, pricing activation or purchase enabled.

219 application tests, 26 SQL security files, lint and TypeScript-inclusive production build pass; isolated advisors report no issues. Existing-calendar suspension, verified recruiter posting cap, expiry/fallback and forged-actor checks pass. Mobile local controls and real public tier catalog render without overflow; temporary private fixtures removed. See [closeout handoff](../development/PARTIAL-FEATURE-CLOSEOUT.md) for live deployment results.

Implementation `4322923` committed, pushed and deployed successfully. All 20 live read-only public/protected-route checks pass. Live 390px `/plans` displays all four complimentary tiers, production canonical URL and no overflow. Working tree clean at implementation checkpoint; isolated validation database stopped with data retained; no production accounts changed. Real push/email receipt, OAuth round-trip and paid subscriptions remain unverified/unavailable as specified above.

## Remaining-feature implementation batch

Current inventory: **32 Complete / 9 Partial / 0 Not picked**. All original features are now picked up. External acceptance is not relabelled Complete: #16 alerts, #26 paid visibility, #28 posting packages, #29 paid database, #30 subscriptions, #31 checkout/management, #32 invoices, #34 reminders and #35 calendar sync remain Partial.

[Feature-name implementation and blocker report](../development/REVENUE-FOUNDATION.md) records the delivered flows, zero-spend defaults, money/privacy checks, production synchronization and deployment.

Final revenue checkpoint: 2026-10-08. Implementation `b5adac2` is pushed and deployed successfully. 225 application tests, 27 SQL security files, lint, TypeScript/production build and no-issue local advisors pass. Production migrations/privacy/default-off policy verified; 22 live smoke checks plus disabled webhook and protected checkout checks pass. Real signed-in provider/merchant/device/calendar/recovery acceptance remains pending. No charge or paid upgrade enabled.

Final current Node command (`node --test $(rg --files lib scripts -g "*.test.mjs")`): **228 tests pass**. The previous 229-count validation is retained as historical evidence; current reproducible source-suite count is 228. Documentation coverage: 66 handlers / 106 HTTP methods, 63 table creation references, 35 settings, 90 runnable check files, all 41 original feature rows and 375 repository links pass.

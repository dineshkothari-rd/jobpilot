# JobPilot: Production Readiness & Revenue Backlog

## Overview & Execution Strategy
This checklist maps all 41 features from the product backlog in strict dependency order across three phases:
1. **Core Candidate & Discovery Foundation** (Features 1, 2, 17, 23, 24, 15, 18, 19, 20, 21, 22, 37, 41, 36, 40, 39, 34, 35, 16)
2. **Employer & Recruiter Platform** (Features 3, 4, 5, 6, 27, 25, 7, 8, 11, 12, 13, 9, 10, 14, 38)
3. **Monetization & Commercial Plans** (Features 30, 33, 28, 29, 26, 31, 32)

Execution proceeds **one feature at a time**: implement → validate → review → commit → push → verify push → next feature.

---

### Dependency-Ordered Checklist

- [x] **Feature 1: Job aggregation from multiple sources**
  - *Dependencies:* None (builds on existing single-source Himalayas sync).
  - *Acceptance Criteria:* Ingest from multiple verified public sources (Himalayas, Remotive, Arbeitnow), normalize schemas, isolate source failures, deduplicate by external ID and URL, store source tags, and provide source filtering and attribution in the jobs UI.
  - *Status:* Completed, validated (93 tests passing, lint clean, typecheck clean), committed (`44cca0f`), and pushed to `origin/main`.
- [x] **Feature 2: India-focused job coverage**
  - *Dependencies:* Feature 1.
  - *Acceptance Criteria:* India location recognition (top tech hubs: Bengaluru, Hyderabad, Pune, Delhi-NCR, Mumbai, Chennai, etc.), INR currency & LPA compensation parsing and formatting, Indian tech market job query targeting, city alias matching in scorer.
  - *Status:* Completed, validated (96 tests passing, lint clean, typecheck clean), committed (`bda566d`), and pushed to `origin/main`.
- [x] **Feature 17: Advanced job filters: experience, industry, salary, posting date, and hybrid work**
  - *Dependencies:* Feature 1.
  - *Acceptance Criteria:* Multi-faceted filters in Job discovery UI for experience level, industry categories, minimum salary range, date posted (<24h, <7d, <30d), and workplace type (remote, hybrid, on-site).
  - *Status:* Completed, validated (101 tests passing, lint clean, typecheck clean), committed (`425e9b8`), and pushed to `origin/main`.
- [x] **Feature 23: Dedicated internships and fresher jobs section**
  - *Dependencies:* Feature 17.
  - *Acceptance Criteria:* Dedicated `/internships` view/section curated for college students and fresh graduates with role matching and qualification tags.
  - *Status:* Completed, validated (106 tests passing, lint clean, typecheck clean), committed (`7236a0b`), and pushed to `origin/main`.
- [x] **Feature 24: Internship duration, stipend, and availability filters**
  - *Dependencies:* Feature 23.
  - *Acceptance Criteria:* Filter internships by duration (1-6 months), minimum monthly stipend, and immediate vs seasonal availability.
  - *Status:* Completed, validated (106 tests passing, lint clean, typecheck clean), committed (`7236a0b`), and pushed to `origin/main`.
- [x] **Feature 15: Saved job searches**
  - *Dependencies:* Feature 17.
  - *Acceptance Criteria:* Ability to save complex filter configurations and query criteria, manage saved searches, and rerun with one click.
  - *Status:* Completed, validated (109 tests passing, lint clean, typecheck clean), committed (`6b7d4ef`), and pushed to `origin/main`.
- [x] **Feature 18: Company profiles and company-specific job listings**
  - *Dependencies:* Feature 1.
  - *Acceptance Criteria:* Dedicated company page (`/companies/[slug]`) displaying company overview, domain, verified jobs at that company, and hiring activity.
  - *Status:* Completed, validated (112 tests passing, lint clean, typecheck clean), committed (`849a3e7`), and pushed to `origin/main`.
- [x] **Feature 19: Company following and new-opening alerts**
  - *Dependencies:* Feature 18.
  - *Acceptance Criteria:* Follow/unfollow company action, followed companies management in user profile, and in-app indicators for new postings from followed companies.
  - *Status:* Completed, validated (115 tests passing, lint clean, typecheck clean), committed (`a9bb879`), and pushed to `origin/main`.
- [x] **Feature 20: Employee reviews and company ratings**
  - *Dependencies:* Feature 18.
  - *Acceptance Criteria:* Structured user reviews (1-5 star ratings, pros, cons, role category, verified user badge) associated with companies, with owner RLS and anti-abuse limits.
  - *Status:* Completed, validated (120 tests passing, lint clean, typecheck clean), committed (`646ec95`), and pushed to `origin/main`.
- [x] **Feature 21: Source-backed salary benchmarking by role, location, and experience**
  - *Dependencies:* Feature 1, Feature 17.
  - *Acceptance Criteria:* Dedicated salary insights explorer (`/salaries`) displaying aggregated distributions, percentiles, and source citations without fabricated figures.
  - *Status:* Implementation ready: `/salaries`, sidebar navigation, role/location/currency filters, midpoint percentiles, experience groups with minimum samples, source listing links, pagination, expired/private-job exclusion, strict currency separation, and error handling. Eight focused tests pass; lint and TypeScript pass. Production build passes with `--webpack` (default Turbopack is blocked by an environment port restriction). Live signed-in/browser verification remains a release check.
- [x] **Feature 22: Equity and ESOP compensation details**
  - *Dependencies:* Feature 21.
  - *Acceptance Criteria:* Structured equity/ESOP ranges on job listings, equity filter, and vesting guidance for candidates.
  - *Status:* Implemented source-description disclosures: explicit ownership percentage ranges and nonnumeric equity/ESOP mentions on discovery cards and job details, equity filters (mentioned / percentage disclosed), saved-search persistence, original listing evidence, and sourced vesting guidance. No fabricated valuation or grant terms; parser supports explicit English disclosures only. 131 tests pass; lint/typecheck pass. Production build passes with `--webpack`; live signed-in/browser verification remains a release check.
- [ ] **Feature 37: Job scam reporting and moderation**
  - *Dependencies:* Feature 1.
  - *Acceptance Criteria:* Report job action on every job card, scam reporting categories, admin moderation flag queue, automatic hiding upon confirmed reports.
- [ ] **Feature 41: Detailed application activity history**
  - *Dependencies:* Core applications table.
  - *Acceptance Criteria:* `application_events` audit table logging timestamped stage transitions, user notes, and recruiter updates, rendered in an interactive timeline in the application workspace.
- [ ] **Feature 36: Email/password or alternative sign-in**
  - *Dependencies:* Supabase Auth.
  - *Acceptance Criteria:* Complete email/password registration and login UI alongside existing Google OAuth, including validation, password reset flow, and error states.
- [ ] **Feature 40: Account deletion and personal-data export**
  - *Dependencies:* Supabase Auth, profiles.
  - *Acceptance Criteria:* Self-service GDPR-compliant "Export My Data" (downloadable JSON archive of profile, applications, resumes, reviews) and "Delete Account" (cascade purge with confirmation).
- [ ] **Feature 39: Help centre and customer support**
  - *Dependencies:* None.
  - *Acceptance Criteria:* Comprehensive `/help` centre with searchable documentation, FAQs, and a support ticket submission form.
- [ ] **Feature 34: Email and push reminders for interviews and follow-ups**
  - *Dependencies:* Core applications, interviews.
  - *Acceptance Criteria:* Notification preferences, scheduled reminder dispatcher for upcoming follow-up deadlines and interview rounds.
- [ ] **Feature 35: Two-way Google Calendar and Outlook Calendar synchronization**
  - *Dependencies:* Feature 34.
  - *Acceptance Criteria:* Calendar provider integration allowing direct sync of scheduled interview rounds to user Google/Outlook calendars beyond static `.ics`.
- [ ] **Feature 16: Personalized email and push job alerts**
  - *Dependencies:* Feature 15, Feature 34.
  - *Acceptance Criteria:* Periodic alert digests delivering newly synced jobs matching saved searches and user preferences.

---

### Phase 2: Employer & Recruiter Platform

- [ ] **Feature 3: Employer and recruiter registration**
  - *Dependencies:* Feature 36.
  - *Acceptance Criteria:* Dual-role registration flow (Candidate vs Recruiter/Employer), company association, recruiter onboarding.
- [ ] **Feature 4: Company verification**
  - *Dependencies:* Feature 3, Feature 18.
  - *Acceptance Criteria:* Company verification requests (corporate email domain verification, business documentation), verification badge, review queue.
- [ ] **Feature 5: Recruiter dashboard**
  - *Dependencies:* Feature 3, Feature 4.
  - *Acceptance Criteria:* Dedicated `/recruiter` dashboard with active postings, candidate pipeline metrics, and recent applicant activity.
- [ ] **Feature 6: Direct job posting**
  - *Dependencies:* Feature 5.
  - *Acceptance Criteria:* Recruiter form to create, edit, publish, pause, and close verified direct job listings with structured salary, equity, and skills.
- [ ] **Feature 27: Employer branding pages**
  - *Dependencies:* Feature 6, Feature 18.
  - *Acceptance Criteria:* Customizable company branding profile (cover banner, perks, culture, tech stack, leadership).
- [ ] **Feature 25: Recruiter-visible candidate profiles with privacy controls**
  - *Dependencies:* Feature 3.
  - *Acceptance Criteria:* Candidate privacy settings (Public to verified recruiters, Anonymous mode, or Fully Private) with owner-controlled profile visibility.
- [ ] **Feature 7: Searchable candidate and resume database**
  - *Dependencies:* Feature 25, Feature 5.
  - *Acceptance Criteria:* Recruiter talent search interface filtering opted-in candidates by role, skills, experience, and location with resume preview.
- [ ] **Feature 8: Recruiter shortlisting**
  - *Dependencies:* Feature 7.
  - *Acceptance Criteria:* Recruiter candidate pipeline (Shortlist, In Review, Contacted, Passed) with private recruiter notes.
- [ ] **Feature 11: Human-confirmed applications within JobPilot**
  - *Dependencies:* Feature 6.
  - *Acceptance Criteria:* Apply directly to JobPilot-hosted recruiter listings with explicit human review modal (attaching resume, reviewing answers, explicit confirmation).
- [ ] **Feature 12: Employer-side application management**
  - *Dependencies:* Feature 11, Feature 5.
  - *Acceptance Criteria:* Recruiter applicant review workspace: view incoming submissions, evaluate resumes/answers, filter by score, change applicant stages.
- [ ] **Feature 13: Recruiter-confirmed application status updates**
  - *Dependencies:* Feature 12, Feature 41.
  - *Acceptance Criteria:* Status transitions made by recruiters update candidate application status in real-time with notifications and audit history.
- [ ] **Feature 9: Recruiter–candidate messaging**
  - *Dependencies:* Feature 8, Feature 11.
  - *Acceptance Criteria:* Secure in-app messaging threads between verified recruiters and applicants/shortlisted candidates.
- [ ] **Feature 10: Recruiter-issued interview invitations**
  - *Dependencies:* Feature 9, Feature 12.
  - *Acceptance Criteria:* Recruiter schedules an interview invitation; candidate receives prompt to accept, suggest reschedule, or decline; accepted rounds populate candidate's interview planner.
- [ ] **Feature 14: Profile-view and resume-view notifications**
  - *Dependencies:* Feature 7, Feature 25.
  - *Acceptance Criteria:* Candidate receives notification when a verified recruiter views their profile or downloads their resume.
- [ ] **Feature 38: Admin dashboard**
  - *Dependencies:* Feature 4, Feature 37.
  - *Acceptance Criteria:* Internal admin portal to review company verifications, moderate reported jobs, view platform metrics, and manage user accounts.

---

### Phase 3: Monetization & Commercial Plans

- [ ] **Feature 30: Free and paid subscription plans**
  - *Dependencies:* Core platform maturity.
  - *Acceptance Criteria:* Defined tiers for Candidates (Free vs Pro) and Recruiters (Starter, Growth, Enterprise) with transparent feature limits.
- [ ] **Feature 33: Plan-based feature access and usage limits**
  - *Dependencies:* Feature 30.
  - *Acceptance Criteria:* Access control guards checking user plan limits (autopilot volume, active job posts, candidate searches, AI credits).
- [ ] **Feature 28: Paid recruiter job-posting packages**
  - *Dependencies:* Feature 6, Feature 30.
  - *Acceptance Criteria:* Job posting credit system allowing recruiters to purchase single or bulk listing packages.
- [ ] **Feature 29: Paid candidate-database access**
  - *Dependencies:* Feature 7, Feature 30.
  - *Acceptance Criteria:* Gated recruiter resume database requiring active recruiter subscription/credits to view contact details and initiate messaging.
- [ ] **Feature 26: Featured candidates and paid profile visibility**
  - *Dependencies:* Feature 25, Feature 30.
  - *Acceptance Criteria:* Candidate Pro feature to spotlight profile at the top of recruiter candidate searches with a "Featured" badge.
- [ ] **Feature 31: Payment checkout and subscription management**
  - *Dependencies:* Feature 30, Feature 33.
  - *Acceptance Criteria:* End-to-end checkout flow (Stripe/payment gateway), webhook handler, subscription activation/cancellation, and customer portal.
- [ ] **Feature 32: Billing history and invoices**
  - *Dependencies:* Feature 31.
  - *Acceptance Criteria:* Dedicated billing settings view showing current plan, renewal date, past payment receipts, and downloadable PDF invoices.

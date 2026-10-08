# Layout revision and competitor R&D — 8 October 2026

Resume/preparation/recruiter detail pass: visible editing/save state reuses the resume save handler; role-specific preparation links show the human-confirmed application journey; hiring shortcuts target existing sections only when a company exists. No simulated saving or automatic submission was added.

Jobs and Applications refinement: workplace quick filters reuse the existing filter state; role review and tracked-application links are visible without opening match details. Application stage buttons reuse the existing status filter and real counts. Desktop pipeline lanes scroll horizontally inside the workspace, with keyboard focus and scroll snapping; mobile lanes stack. Lifecycle transitions, submission confirmation, reminders and unsaved-edit guards remain in the existing handlers. The development-only preview includes an explicitly illustrative application board.

Latest detail pass: framed desktop workspace with rounded navigation/content areas, richer sage/peach hero lighting and subtle dot texture, polished perspective artwork, stronger headings, contained journey shortcuts and shorter mobile artwork. Changes use the existing shared CSS across actual screens and the local preview; no dependencies or account behavior were added.

The user rejected the previous layout. This revision replaces its visual direction rather than treating the earlier score as acceptance. Previous scores and screenshots below are historical; no new claim of a world-best UI or measured usability score is made.

## Research evidence

Official sources were inspected on 8 October 2026. Only Huntr and Simplify public pages were visually inspected in the browser; private competitor accounts were not accessed. Teal's visual page was blocked by Cloudflare, and Welcome to the Jungle returned a browser access error. The other comparisons use official product/help documentation, not claims of hands-on private app use.

| Reference | Observed pattern | JobPilot decision |
|---|---|---|
| [Huntr public tracker](https://huntr.co/product/job-tracker) and [dashboard guide](https://help.huntr.co/en/articles/10393367-your-huntr-dashboard) | Product screenshot dominates the public page; tracker separates stages, activities and documents | Show a custom visual focal point, keep discovery distinct from application progress, reduce competing navigation |
| [Simplify public product](https://simplify.jobs/) and [dashboard guide](https://help.simplify.jobs/en/articles/6390631-navigating-your-dashboard) | Large typography and product-led hero; dashboard groups matches, preferences and curated feeds | Open headings, stronger typography, fewer permanent tools, clear next action; no fabricated hiring claims or streaks |
| [Teal tracker](https://www.tealhq.com/tools/job-tracker) and [dashboard guide](https://help.tealhq.com/en/articles/9524944-exploring-the-dashboard) | Documented grid overview, grouping, sorting and editable tracked fields | Keep factual application details and existing list/pipeline modes accessible; remove decorative header boxes |
| [Rezi organisation update](https://www.rezi.ai/posts/new-dashboard-features-list-view-sorting-and-sections) | Documented compact list, sorting and document sections | Improve resume navigation with direct section links; retain actual versions and review controls |
| [Kickresume editor guide](https://www.kickresume.com/en/help-center/resume/) | Documents and editing tools are grouped around the resume task | Keep editing and download actions near the resume rather than placing every tool in the main navigation |
| [Jobscan tracker](https://www.jobscan.co/job-tracker) | Centralised application information and activity | Keep conversations, application progress and follow-up actions visually distinct but easy to reach |

Inference: strong layouts balance an expressive introduction with restrained work areas. This research does not establish that 3D graphics cause better task completion. All JobPilot artwork is original code; competitor artwork, trademarks and screenshots are not bundled into the app.

## Implemented layout

- Shared private workspace: 224px dark teal desktop sidebar, four primary tasks, native expandable supporting groups, active-route highlighting, mobile bottom navigation and scrollable More dialog. Role-gated admin access is preserved.
- Headers: open typography and a quiet divider replace the repeated large gradient cards. Tool switching uses normal internal links, so existing link-based unsaved-edit protections remain applicable. Help is an optional compact disclosure in the top bar; Escape closes it and returns focus.
- Canvas and cards: warm neutral background, deep teal actions, lime/peach/periwinkle accents and understated content surfaces. Dark appearance remains available. Borders/backgrounds continue to use semantic tokens for utility controls.
- Dashboard: factual next-step logic and real metrics retained; custom perspective artwork sits beside the next action, with three concise journey links below. No invented scores, offers or achievements.
- Resume: direct native anchors to seven real sections; decorative artwork in the first-upload state. Editing/save/upload constraints remain intact.
- Recruiter: native shortcuts for company, branding, talent, applicants and postings; existing verification, consent and billing restrictions remain intact.
- Inbox: conversations on the left and selected message/invitation workspace on the right at desktop widths; stacked layout on mobile. Messages distinguish the account's own messages; notifications follow the conversation workspace. Send/block/invitation behavior and unsent-draft guards retain their existing handlers.
- Public pages and authentication inherit the revised theme. Landing and desktop authentication also use the custom artwork; the editor, learning, portfolio, practice, discovery, billing and admin retain their real workflows under the new shared layout.

## Graphics and motion

[CareerScene](../components/career-scene.tsx) is decorative and hidden from assistive technology. It uses native CSS perspective, a layered resume, opportunity card, shaded sphere, orbit and icons from the already installed set. It carries no invented user data. Entry effects finish within approximately one second; hover changes occur only on capable devices. Nothing in the scene loops. The existing reduced-motion rule suppresses animation duration; the scene still works as static art. No canvas, paid asset service, rendering library or new dependency is required.

This is 3D-style CSS artwork, not a WebGL model viewer. A model viewer is unnecessary for the current resume/discovery/task workflows. Graphics are concentrated in introduction/next-action areas to keep forms and conversations readable.

## Local review and verification

Run the existing development server and visit `/design-preview`. Dashboard, jobs, resume and recruiter tabs contain clearly labelled illustrative content using the actual shared layout and artwork. Links to actual workspaces require ordinary sign-in; preview cards themselves make no account changes. Both proxy and page return 404 outside `NODE_ENV=development`. The preview is not in production navigation or sitemap. The runnable preview-boundary check is in [page-guide tests](../lib/page-guide.test.mjs).

Inspected: desktop preview and real landing at 1440px; mobile preview at 390px and 320px; jobs/resume/recruiter preview layouts; dark mobile appearance; mobile More focus containment; help Escape dismissal; reduced-motion scene duration. No horizontal overflow was found in the checked views. Actual InboxPage was temporarily mounted in the local preview for browser-only sample GET responses; desktop layout and disabled composer were inspected without any real message/invitation/action. That temporary mount was removed. No auth/client replacement or production API fixture ships.

The four illustrative screens are a design review tool, not proof of all private workflows. Real candidate/recruiter/admin task completion, successful saves, resume exports, screen-reader coverage and live provider flows still require acceptance. Global/shared-layout coverage is source-verified for the 38 production pages; the 39th page is the development-only preview. Final validation: all 230 Node tests passed, lint passed, production webpack build and TypeScript passed, documentation source/link checks passed (39 pages, 66 handlers, 63 table creation references, 35 settings, 90 check files).

Feature status remains [32 Complete / 9 Partial / 0 Not picked](product/PRODUCTION-PROGRESS.md). Layout changes do not activate merchant, email, calendar or commercial-host configuration.

---

## Previous shared UI revision (superseded design)

# Whole-app UI/UX update — 8 October 2026

This update continues the existing application. Shared components cover every private workspace route; public routes share their public layout; sign-in, password recovery and Help have dedicated presentation updates. No paid dependencies or provider upgrades were added. The previous landing-only estimate below is historical and must not be treated as a whole-app score.

## Delivered

| Area | Current implementation |
|---|---|
| Navigation | Grouped desktop tools; persistent mobile primary destinations; scrollable accessible More dialog; breadcrumb and native workspace switcher; accurate route-specific help |
| Visual system | Restored card boundaries, spacing, icons and depth by removing flattening overrides; common page headers; section accents; existing semantic light/dark tokens |
| Appearance | Workspace toggle stores only `jobpilot:theme`; first visit follows the system preference; storage restrictions do not block use. Server initial appearance can briefly precede the browser preference. |
| Dashboard | Real next-action hierarchy, separate stats cards and native Resume / Discover / Track progress links; no invented achievements or completion scores |
| Job discovery | Individually readable result cards, spacious search actions, salary prefix correction |
| Applications | Larger labels and readable pipeline/list metadata; existing confirmation and submission safeguards retained |
| Resume, profile and editor | Restored existing surfaces, icons and stat cards; readable mobile inputs; existing section editing, sticky save and version controls retained |
| Recruiter, inbox, company and admin tools | Shared hierarchy and surfaces; clearer role-specific help; admin section selection exposes pressed state; role gating retained |
| Billing | Dedicated page introduction; allowance progress uses actual returned usage; public copy accurately states basic tools plus optional paid plans |
| Learning, practice, portfolio and career | Shared visual hierarchy and tool grouping; error/status surfaces; existing real workflows retained |
| Public and authentication | Warm public background and shared header cards; branded two-column desktop sign-in; compact mobile sign-in; Help guide cards and touch-friendly summaries |
| Motion/accessibility | Short CSS interactions and 2D journey icons, reduced-motion handling, native controls, labels, keyboard focus and mobile touch targets; no continuous animation |

## Browser evidence and limits

Desktop screenshots were inspected for dashboard, jobs, resume, applications, recruiter and sign-in. Mobile 390×844 checks covered dashboard, jobs, resume, applications, recruiter, billing, learning, practice, admin, inbox, companies, internships, salaries, profile, portfolio, saved jobs and resume studio. These inspected views had no horizontal overflow. The mobile More dialog fits the viewport, contains keyboard focus and closes with Escape. Career was inspected in its unavailable-data state; its populated state and Autopilot still require signed-in acceptance. Dynamic job/company/learning details and other role-specific states have source/shared-layout coverage, not full browser acceptance.

Private visual previews used temporary, local-only illustrative data inside the actual page components. Preview account/auth/API replacements were restored before final checks and are not shipped. Their `/help?screen=...` URL meant breadcrumbs and active navigation were illustrative; the real workspace uses its actual pathname. No real applications, payments, messages or account updates were performed during these visual checks. Screenshots shown in the conversation are captured artifacts, not a permanent preview endpoint.

Whole-product heuristic estimate: **about 7/10**, up from approximately 6/10 before this shared update. This is not a measured global ranking. The product is visually more coherent, but calling it better than every competitor requires real task-completion evidence, accessibility checks and candidate/recruiter feedback. Huntr's public tracker visual and Teal/Simplify official workflow docs informed the comparison; private competitor apps were not accessed. The landing-only comparison is preserved below.

## Acceptance and documentation

The complete source inventory is in [implementation reference](IMPLEMENTATION-REFERENCE.md), including all 38 page files and their shared layout scope. Runnable checks cover route guidance, native controls and salary formatting; final lint passed; the production webpack build and TypeScript check passed; all 229 Node checks passed. Documentation coverage validates all 38 page sources as well as 66 handlers, 63 table creations, 35 settings and 90 check files. Real sign-in, resume upload/save, hiring conversations, checkout/cancellation, consented notifications and calendar round trips remain production acceptance work. Feature status stays **32 Complete / 9 Partial / 0 Not picked**; visual work does not activate payment, email, calendar or commercial hosting credentials. See [feature names and remaining gates](product/PRODUCTION-PROGRESS.md).

---

# Current UI/UX assessment

2026-10-08. This is a bounded heuristic review, not an industry ranking, user interview study or complete accessibility certification. We compared the actual JobPilot landing at 1440px and 390px, its existing workflow/navigation source, Huntr's public tracker page, and official Teal/Simplify workflow documentation. Teal's public visual page was blocked by Cloudflare; private competitor dashboards were not accessed.

## Score and competitive alignment

| Dimension (equal weight) | Before /10 | Updated landing /10 | Evidence / remaining limit |
|---|---:|---:|---|
| Visual hierarchy and product understanding | 5 | 7 | Clearer main promise, resume CTA and interactive three-step explanation; real product screenshots could strengthen understanding |
| Visual identity, warmth and depth | 4 | 7 | Brand color, warm background, substantial preview surface, 2D icons and restrained perspective; no new render dependency |
| Guided task flow and accurate actions | 5 | 7 | Resume action preserves `/resume` through login, public jobs route, direct employer entry and pricing; full signed-in conversion is unmeasured |
| Interaction and feedback | 4 | 7 | Three user-controlled stages, pressed state and live content updates, short transitions; not a full in-app interaction redesign |
| Responsive and accessibility basics | 7 | 8 | Desktop/mobile without overflow, focusable controls, visible focus styling, reduced-motion disables animation/transform; no full screen-reader/contrast certification |
| **Mean** | **5.0** | **7.2** | **Landing scope only; conservative whole-product estimate remains approximately 6/10 until signed-in usability testing** |

[Huntr's public tracker](https://huntr.co/product/job-tracker) uses a prominent product screenshot, clear workflow and colored framing; that visible presentation sets a stronger product-demonstration reference than the previous text-only JobPilot landing. [Teal's workflow](https://www.tealhq.com/how-it-works) emphasizes resume/tracker continuity. [Simplify's dashboard guide](https://help.simplify.jobs/en/articles/6390631-navigating-your-dashboard) emphasizes daily matches, preferences and goals. These are reference patterns, not measured peer scores or proof that animation produces better conversion. JobPilot now follows clearer task entry and product explanation; end-to-end polish and real user feedback remain the main gap.

## Delivered interaction and motion

`components/career-preview.tsx` is the small client island inside the server landing page. The resume → role → progress controls update local content with native buttons, `aria-pressed` and a polite live region. The preview is explicitly labelled, contains no personal data, fake candidates, job offers, endorsements or invented success scores. Links go to actual existing workflows. The server still preserves OAuth `code`/`error` redirects.

CSS uses existing semantic tokens and float-in animation. Entry/content effects finish in 250–600ms; hover perspective is restricted to hover-capable devices. Nothing automatically loops. `prefers-reduced-motion: reduce` disables landing animation, transition and transforms. Existing private navigation, helper interactions and workflow forms retain their prior patterns; adding a landing preview does not certify their usability.

## Verification and next evidence

Actual browser checks: desktop 1440px and mobile 390px screenshots inspected; all three preview content states update; mobile no horizontal overflow; correct resume login-return link; keyboard focus reaches the native stage button; reduced-motion emulation reports `animation:none` and `transform:none`. Existing lint and targeted feature checks pass. No real sign-in, payment or employer submission was performed for the visual review.

Before assigning a whole-product score above this estimate, run real candidate/recruiter/admin journeys: first resume upload, relevant-job comparison, human-confirmed application, rejection/retry/empty/loading cases, interview scheduling, private messaging, actual mobile checkout and cancellation. Measure task completion/errors and obtain user feedback. Remaining legal/provider/hosting gates are in [current progress](product/PRODUCTION-PROGRESS.md).

## Historical audit

# JobPilot UX audit — 17 September 2026

> Historical point-in-time audit. It is not a current acceptance checklist; use the maintained [feature inventory](product/FEATURES.md) and flow documentation instead.

## Method and scope

Heuristic review of the production app's route structure, labels, actions, loading/error states and application lifecycle; comparison with the user-supplied screenshots; targeted browser checks using isolated sample data. This is not an interview study or proof that every user will find the app easy. No production applications were submitted for testing.

The main journey is: set up profile and resume → find a relevant job → review and apply → confirm submission → track replies and follow-ups. Autopilot prepares applications; career planning and interview practice are optional supporting tools.

Research basis: [NN/g usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), and [visible navigation](https://www.nngroup.com/articles/hamburger-menus/). Applied as design guidance, not as measured JobPilot usability results.

## Findings and changes

| Area | Problem | Change |
| --- | --- | --- |
| Shared theme | Semantic CSS colors were defined but not registered with Tailwind v4; primary buttons lacked color and dialogs were transparent | Map existing tokens through `@theme inline`, fixing shared contrast and opaque surfaces without page-specific overrides |
| App navigation | Eight destinations compete; Dashboard, Career and Autopilot suggest overlapping entry points | Four primary destinations: Home, Find jobs, Applications, Autopilot; saved jobs, profile, resume and career plan remain available under supporting tools |
| Mobile | Applications is hidden behind More while Resume gets a permanent slot | Applications becomes a visible primary tab; More uses the existing accessible dialog with focus containment and Escape dismissal |
| Home | Sends incomplete users to jobs; future reminders are treated as the next action; saved roles counted as submitted applications | Setup/resume → due follow-up → ready application → job discovery priority; explicit loading/error states; submitted metrics exclude saved roles |
| First use | No short explanation of the sequence | Optional three-step guide on Home with real links; sidebar explains the basic journey |
| Find jobs | Dense desktop controls precede results; abstract AI branding | Plain task-oriented title; filters and sorting behind a labelled disclosure; applied-filter indicator and clear action remain visible |
| Saved jobs | Unclear distinction between shortlist and applications | Plain name and explicit explanation that saved roles are not submitted |
| Applications | Pipeline board is intimidating by default | Simple list default; pipeline remains available; desktop filters collapsed; ready-to-apply primary action preserved |
| Application workspace | Normal apply, companion, embedded form and helper compete; unrelated tracking tools follow immediately | One normal company-form action; optional autofill and in-app form grouped separately; tracking/reminders/tools collapsed for saved roles |
| Job detail | Confirmation opens employer page and records Applied in the same click | Company-form link separated from explicit submission checkbox; confirm disabled until checked; every opener resets confirmation |
| Application Copilot | Can record Applied without an explicit success confirmation | Native confirmation at the shared mutation handler; no automatic submission claim |
| Autopilot | Large settings form and long activity log dominate; duplicated apply/review paths | Application queue first; settings collapsed for configured users and opened for incomplete setup; advanced preferences and logs disclosed on demand; ready jobs point to the shared Applications workspace |
| Autopilot terminology | “Packages”, “approval”, “grounded” unclear; next action suggests interview practice before application | “Ready to apply”, “Needs your answers”, explicit prepare-versus-submit explanation, appropriate application next action |
| Profile | Long edit form requires scrolling back to Save | Plain setup instructions, accessible error dismissal, sticky Save action in edit mode |
| Resume | “Intelligence” and “ATS Studio” require product knowledge | “Your resume” and “Review & download”; upload/check/Primary instructions; secondary review action |
| Resume review | Export and destructive version tools compete with editing | Save as PDF primary export with honest browser-print instructions; other exports and version management grouped |
| Career plan | Another command center with many mandatory-looking scores and roadmaps | Explicitly optional career plan; deeper market/skills/roadmap content collapsed |
| Interview/preparation | Multiple specialist tools can look like prerequisites for applying | Retained existing job-specific back links and section navigation; entry points grouped as optional tools rather than primary job-search destinations |
| Accessibility | Desktop active location and mobile modal semantics inconsistent | Current-page indicators, labelled navigation landmarks, skip-to-content link, existing accessible dialog for mobile More |

## Acceptance checks

- First-time user can identify profile and resume setup before job discovery.
- Configured user can reach a prepared application from Home or Applications.
- Mobile user can reach Applications without opening More.
- Employer-form opening never automatically records Applied.
- Confirmation is opt-in and resets when opening another application.
- Advanced controls remain reachable; hiding them does not delete data or change API contracts.
- Existing auth, ownership checks, background scheduling and free-service constraints remain unchanged.

## Remaining evidence needed

Browser fixture checks demonstrate interface behaviour, not production authentication/database end-to-end success. Validate upload/edit/download with a real signed-in account, and test installed Chrome helper permissions on-device. Run a short usability session with first-time users: ask them to set up, shortlist a role, find a ready application, and track a submission without instructions. Measure task completion and wrong turns before asserting a quantified usability improvement. External employer forms, login, captcha, file upload and final submission remain employer-controlled.

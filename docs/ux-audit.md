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

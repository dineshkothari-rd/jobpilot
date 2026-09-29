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

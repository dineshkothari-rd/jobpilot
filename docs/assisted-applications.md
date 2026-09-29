# Guided application assistant — implementation review

> Historical delivery record. For current behavior and decisions, see [Application flow](flows/application.md), [Autopilot flow](flows/autopilot.md), [ADR 001](adr/001-human-in-the-loop-applications.md), and the [application lifecycle proposal](design/application-lifecycle.md).

## Feasibility and scope

| Step | Free automation | Limit |
| --- | --- | --- |
| Resume selection | Reuse prepared resume, allow changing the actual tracker selection | User reviews/downloads and uploads it on employer form |
| Reusable answers | Save optional phone, company, portfolio, annual CTC and expected compensation on own profile | Explicit factual confirmation; no guessing |
| Authorization / notice period | Reuse current existing Autopilot preferences instead of a duplicate answer store | User confirms country-specific legal/employer answers manually |
| Contact autofill | Existing Chrome helper v1.2, exact unambiguous empty fields and per-field report | Toolbar permission, unfamiliar labels stay manual |
| Embedded form | Existing allowlisted Lever forms and temporary permission | Cross-origin DOM is inaccessible without helper; framing can be blocked |
| Refresh progress | Per-account/application session marker, expires after 24 hours | Only link-opening metadata; never facts, review approval or submission confirmation |
| Submission and next job | Explicit confirmation, existing tracking timestamp, follow-up and next application | No automatic Submit or provider-verified claim |

The UI presents Review details → Company form → Confirm & track. Review opens first; company tools stay collapsed until review. Missing resume links to upload, missing identity links to Profile, extra answers stay optional, and helper/copy errors remain visible outside collapsed steps. Selecting another resume or editing facts invalidates review; changing applications resets confirmation.

Saved-answer PUT validates an explicit factual confirmation, fixed keys and bounded strings, authenticates with `getUser`, scopes UPDATE to the signed-in profile, and checks previous JSON facts to prevent stale-tab overwrites. Sensitive values are not logged or put in JWT metadata/browser progress. Server and existing profile RLS both enforce ownership. Current CTC and legal facts are excluded from autofill; existing values, consent, captcha, files and Submit are never changed.

## Database storage

[Applied migration](../supabase/migrations/20260917074214_application_facts_storage.sql) adds one bounded JSONB column to existing private profiles. Existing authenticated own-profile SELECT/INSERT/UPDATE policies remain unchanged. Browser-role TRUNCATE permissions were revoked because TRUNCATE bypasses RLS. Production verification passed owner read/write, other-user isolation, anonymous read denial, stale update rejection and invalid JSON constraint enforcement; synthetic test updates were rolled back. GET still tolerates an absent column on other installations; normal applying works while saved-answer editing reports setup pending.

No new environment variables, application dependencies, paid services or infrastructure upgrades. Employer submission/API integration, broader host permissions and automatic resume upload are intentionally excluded.

## Validation

- Runnable checks: `node --test lib/applications/*.test.mjs lib/autopilot/*.test.mjs lib/home-next-action.test.mjs lib/ux-theme.test.mjs`.
- `npm run lint`, `npx tsc --noEmit`, `npx next build --webpack`.
- Isolated browser preview uses real built components with synthetic local API data; it does not exercise production RLS/auth or installed helper permissions. No real application is submitted.
- Production database role/ownership verification passed; real Chrome helper permission E2E remains pending. Fixture success is not proof of installed-device permissions or a signed-in production browser flow.
- Results: 27 focused tests passed; lint, TypeScript and production build passed. Sample browser checks confirmed saved-fact display after refresh, resume-change review invalidation, explicit submission → next-application reset, 390px no horizontal overflow, and unsaved edits retained when discard was denied. Review/confirmation are never restored from browser storage. Final Chrome permission/device checks remain outstanding.

References: [Chrome scripting permissions/results](https://developer.chrome.com/docs/extensions/reference/api/scripting), [sessionStorage lifetime](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [Supabase ownership RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [filtered updates](https://supabase.com/docs/reference/javascript/update).

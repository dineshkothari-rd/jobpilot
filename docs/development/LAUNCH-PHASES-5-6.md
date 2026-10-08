# Launch Phases 5–6 handoff

> Historical delivery evidence. Current pricing, activation, implementation status and provider limitations are defined by [Revenue operation](REVENUE-FOUNDATION.md), [current progress](../product/PRODUCTION-PROGRESS.md) and [implementation reference](../IMPLEMENTATION-REFERENCE.md).

Checkpoint: 2026-10-07. Continue the existing application, implement the next two phases, sync the database and commit/push, then stop for review. Previous batch: `fcb38dd`. No paid provider/infrastructure was enabled; original 41-feature inventory remains **30 Complete / 4 Partial / 7 Not picked** because these phases deliver launch readiness around existing features.

## Phase 5 — public acquisition implementation delivered

- Signed-out `/opportunities`: bounded title/location search, pagination, source labels and no signup wall.
- Public `/opportunities/[id]`: source description, application/source links, save/match sign-in return destination, direct employer link, source-backed salary/equity disclosures. Closed/expired/hidden/private jobs fail closed.
- `/employers/[id]` moved out of the private app shell and rendered server-side with published/verified branding and current openings. Existing API remains authenticated for private app usage; public pages call only safe server projections.
- Canonical metadata, source-aware robots/noindex, eligible direct JobPosting JSON-LD with script escaping and conservative factual location/date checks. Sitemap excludes private routes and aggregated source listings. No provider jobs are resubmitted to Google Jobs.
- Landing supports candidates and verified hiring, advertises the free first launch and links public browse/help/legal notices. Recruiter CTA uses the existing `/auth/login?next=/recruiter` contract.
- Privacy/Terms, sign-in notice links and public support email. JobPilot is the provisional business/service name chosen under owner authorization; the owner authorized the email; registered legal entity/jurisdiction and legal adequacy are not certified.

## Phase 6 — implemented release tooling; activation remains Partial

- Safe server error correlation and public/private retry references; removed the unsupported promise that a failing view never changed data.
- Native security headers deny framing/sniffing, constrain referrer exposure and unnecessary device permissions; same-origin microphone remains allowed for existing voice practice.
- Read-only public/protected-route smoke checker; manual private database-dump/checksum tool with unsafe-destination checks.
- Operational runbook for recovery, deletion replay, support, real-user pilot and native platform usage review.
- Actual human pilot, optional provider delivery, production backup/isolated restore drill, full accessibility and commercial-hosting acceptance remain outstanding. Do not label these complete from code/tests.

## Database

`20261007025737_public_launch_discovery.sql` adds a narrow service-only security-invoker projection over moderated jobs, excluding user-created, expired and unsupported-source records. Applied after isolated full reconstruction, SQL tests, advisors and an exact one-file production dry run. Remote history/grants verified: anon/authenticated direct SELECT false; service SELECT true; zero private/expired projection leaks. Read-only production snapshot contained 92 active public jobs. No seeds, roles, vault writes or synthetic production fixtures were applied.

## Verification

207 Node tests, 21 SQL security files, full lint and final webpack build including TypeScript pass. Runtime dependency audit: zero findings. Local security advisors: no WARN issues. Manual backup contract/permissions checks pass without making an actual production dump.

Local production server with a working existing credential passes 13 public/unsigned API smoke checks. Real public browser journey covers title search (React returned 9 matching listings), job detail, original-source apply link, private save/match login destination and canonical origin. Search/detail fit at 390px. Masked exported secrets were not treated as real keys, and production keys were not rotated or revoked. Existing third-party/new secret API credential did not authenticate in local diagnostics; the existing legacy service credential did. Production deployment smoke must verify the configured runtime rather than infer success from build alone.

Canonical production domain was verified via Vercel CLI: `jobpilot-murex.vercel.app`; getSiteUrl supports Vercel's native production-domain variable and preserves explicit NEXT_PUBLIC_SITE_URL precedence. Vercel connector returned 403; the mapped authenticated CLI fallback succeeded.

Current hosting plan is Hobby. Commercial use is restricted by Vercel policy; compliant hosting must be settled before revenue operation. No billing upgrade was made. Search Console indexing/rich-result validation and legal review remain operator release actions, not implementation claims.

## Production deployment and handoff

Implementation `7829824`, configuration/report follow-up `48650df` and runtime fix `c330d03` are pushed to main. The runtime fix deployed successfully. Live read-only smoke passes all 13 checks: public pages, sitemap/robots, branding assets and unsigned protected API denials. Browser verification on the production domain confirms 24 public search results and the actual FullStack Developer - Dotnet job detail, original Himalayas application links, private action sign-in destination, canonical domain, source noindex/follow with no JobPosting markup, and no horizontal overflow at 390px.

Initial public pages returned 500. Correcting the existing production server credential alone did not resolve this. Hosting logs proved the module-load failure: isomorphic-dompurify pulled jsdom whose CommonJS dependency required an ES module unsupported by the production runtime. Removed the unnecessary server DOM wrapper. Public descriptions now extract plain text rendered with React text nodes; private rich descriptions retain the same DOMPurify HTML sanitizer directly in the browser. A hostile-text/entity regression check passes, as does loading the browser sanitizer module with CommonJS ESM support disabled. No project credentials were created/rotated/revoked; only the existing production server variable was corrected to an existing verified credential, preserving Secret type.

Final local webpack production build and TypeScript pass. The local Turbopack build was blocked by its worker-port permission; the automatic hosting deployment succeeds. Final 207 Node tests and lint pass; production dependency audit has zero findings. The previously completed 21 SQL security files, full isolated migration reconstruction and database grants/advisors checks remain valid; no SQL changed in the runtime fix.

Stop for review. See [current feature report](../product/PRODUCTION-PROGRESS.md) and [operations/pilot checklist](./LAUNCH-OPERATIONS.md). Monetization, provider activation, admin suspension/roles and outstanding production pilot/recovery remain pending. No paid provider/infrastructure was enabled.

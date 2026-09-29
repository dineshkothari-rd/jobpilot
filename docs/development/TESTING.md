# Testing and quality gates

Last verified: 2026-09-27

## Test layers

### Node tests

Domain and selected route behavior use the built-in Node test runner. Coverage includes matching-related career logic, ATS, AI fallback, application trust boundaries, Autopilot idempotency, interviews/timezones, learning/answer keys, practice, portfolio, My Day, URLs and UI-source assertions.

```sh
node --test $(git ls-files | grep '.test.mjs')
```

The verified 2026-09-27 Phase 2 observation was 86 passing tracked tests plus the focused new lifecycle test file. Counts will evolve and are not a quality requirement.

### Static checks and production build

```sh
npm run lint
npm run build
git diff --check
```

The production build is also a TypeScript/Next.js integration gate and must generate the expected routes without errors. The latest sandbox run reached Turbopack but was blocked by the environment from creating a process/binding a port (`Operation not permitted`); TypeScript and lint passed independently.

### Supabase reconstruction and SQL security

```sh
npx supabase db reset --local
npx supabase test db --local supabase/tests
```

The verified Phase 2 baseline is nine SQL files, nine tests, PASS. They use deterministic seed accounts and roll back synthetic changes. A fresh reset confirms the complete migration chain, including the private Resume Storage bucket and policies.

### Database release checks

For schema work also review local/remote migration lists, run a production push dry run, and run relevant Supabase advisors. Do not automatically push.

## Browser/manual gaps

No general automated browser E2E framework is installed. Real OAuth, private resume Storage, installed extension permissions, microphone/speech compatibility, external embeds, responsive widths, keyboard behavior and production smoke tests remain explicit manual release checks until justified automation is approved.

## Failure policy

Fix failures caused by the proposed change. Never delete or weaken a test to make a refactor pass. Record environment/provider limitations separately from code failures.
